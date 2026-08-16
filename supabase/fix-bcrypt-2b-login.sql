-- Corrige login_roma_finanzas: pgcrypto en este proyecto no reconoce
-- el prefijo bcrypt $2b$ que genera SuperAdmin al cambiar una contrasena,
-- solo entiende $2a$. Cualquier negocio al que le hayan cambiado la clave
-- despues de que SuperAdmin empezo a generar hashes $2b$ quedaba sin poder
-- entrar a Roma Finanzas, aunque esa misma clave si funcionara en RservasRoma
-- (esa verificacion es en JavaScript, no en Postgres).
--
-- No toca ningun hash guardado: reescribe el marcador de version antes de
-- comparar. El cuerpo del hash (costo+sal+digesto) es identico entre
-- variantes 2a/2b - verificado con un hash de prueba antes de aplicar esto.

begin;

create or replace function public.login_roma_finanzas(
    p_username text,
    p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business public.negocios%rowtype;
    v_username text := lower(btrim(coalesce(p_username, '')));
    v_password text := coalesce(p_password, '');
    v_attempt public.roma_finanzas_login_attempts%rowtype;
    v_token text;
    v_expires_at timestamptz := now() + interval '12 hours';
    v_password_hash text;
begin
    if v_username = '' or v_password = '' then
        raise exception using message = 'Escribe tu usuario y contrasena.', errcode = '22023';
    end if;

    select * into v_attempt
    from public.roma_finanzas_login_attempts
    where username_normalized = v_username;

    if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
        raise exception using message = 'Demasiados intentos. Espera unos minutos.', errcode = '28000';
    end if;

    select * into v_business
    from public.negocios
    where lower(slug) = v_username
    limit 1;

    if v_business.id is null and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'negocios' and column_name = 'usuario'
    ) then
        execute 'select * from public.negocios where lower(usuario) = $1 limit 1'
        into v_business
        using v_username;
    end if;

    -- pgcrypto en este proyecto no reconoce el prefijo $2b$ (bcrypt moderno)
    -- que genera SuperAdmin al cambiar una contrasena; solo entiende $2a$.
    -- El cuerpo del hash (costo+sal+digesto) es identico entre variantes, asi
    -- que se reescribe el marcador antes de comparar en vez de tocar los
    -- hashes guardados. Verificado: mismo password, mismo hash, solo cambia
    -- si Postgres lo reconoce o no.
    v_password_hash := regexp_replace(v_business.password_hash, '^\$2[by]\$', '$2a$');

    if v_business.id is null
       or v_business.password_hash is null
       or extensions.crypt(v_password, v_password_hash) <> v_password_hash then
        insert into public.roma_finanzas_login_attempts (
            username_normalized, failed_count, window_started_at, locked_until
        ) values (
            v_username, 1, now(), null
        )
        on conflict (username_normalized) do update
        set failed_count = case
                when public.roma_finanzas_login_attempts.window_started_at < now() - interval '15 minutes' then 1
                else public.roma_finanzas_login_attempts.failed_count + 1
            end,
            window_started_at = case
                when public.roma_finanzas_login_attempts.window_started_at < now() - interval '15 minutes' then now()
                else public.roma_finanzas_login_attempts.window_started_at
            end,
            locked_until = case
                when (
                    case
                        when public.roma_finanzas_login_attempts.window_started_at < now() - interval '15 minutes' then 1
                        else public.roma_finanzas_login_attempts.failed_count + 1
                    end
                ) >= 8 then now() + interval '15 minutes'
                else null
            end;

        raise exception using message = 'Usuario o contrasena incorrectos.', errcode = '28000';
    end if;

    if coalesce(v_business.acceso_finanzas, false) is false
       or lower(coalesce(v_business.estado_finanzas, 'sin_acceso')) not in ('trial', 'activo')
       or (
            v_business.fecha_vencimiento_finanzas is not null
            and v_business.fecha_vencimiento_finanzas < now()
       ) then
        raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
    end if;

    delete from public.roma_finanzas_login_attempts
    where username_normalized = v_username;

    delete from public.roma_finanzas_sessions
    where expires_at < now() - interval '7 days'
       or revoked_at < now() - interval '7 days';

    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.roma_finanzas_sessions (
        token_hash, negocio_id, expires_at
    ) values (
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_business.id,
        v_expires_at
    );

    return jsonb_build_object(
        'token', v_token,
        'expires_at', v_expires_at,
        'business', jsonb_build_object(
            'id', v_business.id,
            'nombre', v_business.nombre,
            'email', v_business.email,
            'telefono', v_business.telefono,
            'slug', v_business.slug,
            'plan', v_business.plan,
            'logo_url', v_business.logo_url,
            'acceso_finanzas', v_business.acceso_finanzas,
            'estado_finanzas', v_business.estado_finanzas,
            'fecha_vencimiento_finanzas', v_business.fecha_vencimiento_finanzas
        )
    );
end;
$$;

commit;
