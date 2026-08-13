-- RservasRoma: proveedor de identidad para Roma Finanzas.
--
-- Ejecutar SOLO en el Supabase productivo de RservasRoma.
-- No copia hashes ni datos financieros. La contrasena se valida dentro de
-- RservasRoma y solo se devuelve la identidad publica del negocio.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.negocios
add column if not exists acceso_finanzas boolean default false,
add column if not exists estado_finanzas text default 'sin_acceso',
add column if not exists fecha_activacion_finanzas timestamptz,
add column if not exists fecha_vencimiento_finanzas timestamptz;

create schema if not exists roma_finanzas_auth_private;
revoke all on schema roma_finanzas_auth_private from public, anon, authenticated;

create table if not exists roma_finanzas_auth_private.login_attempts (
    slug_normalized text primary key,
    failed_count integer not null default 0,
    window_started_at timestamptz not null default now(),
    locked_until timestamptz
);

revoke all on table roma_finanzas_auth_private.login_attempts
from public, anon, authenticated;

create or replace function public.verify_roma_finanzas_identity(
    p_slug text,
    p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business public.negocios%rowtype;
    v_slug text := lower(btrim(coalesce(p_slug, '')));
    v_password text := btrim(coalesce(p_password, ''));
    v_attempt roma_finanzas_auth_private.login_attempts%rowtype;
begin
    if v_slug = '' or length(v_slug) > 128 or v_password = '' or length(v_password) > 512 then
        return jsonb_build_object(
            'ok', false,
            'error', 'invalid_credentials'
        );
    end if;

    select * into v_attempt
    from roma_finanzas_auth_private.login_attempts
    where slug_normalized = v_slug;

    if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
        raise exception using message = 'Demasiados intentos. Espera 15 minutos.', errcode = '28000';
    end if;

    select * into v_business
    from public.negocios
    where lower(slug) = v_slug
    limit 1;

    if v_business.id is null and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'negocios'
          and column_name = 'usuario'
    ) then
        execute 'select * from public.negocios where lower(usuario) = $1 limit 1'
        into v_business
        using v_slug;
    end if;

    if v_business.id is null
       or v_business.password_hash is null
       or extensions.crypt(v_password, v_business.password_hash) <> v_business.password_hash then
        insert into roma_finanzas_auth_private.login_attempts (
            slug_normalized, failed_count, window_started_at, locked_until
        ) values (
            v_slug, 1, now(), null
        )
        on conflict (slug_normalized) do update
        set failed_count = case
                when roma_finanzas_auth_private.login_attempts.window_started_at < now() - interval '15 minutes' then 1
                else roma_finanzas_auth_private.login_attempts.failed_count + 1
            end,
            window_started_at = case
                when roma_finanzas_auth_private.login_attempts.window_started_at < now() - interval '15 minutes' then now()
                else roma_finanzas_auth_private.login_attempts.window_started_at
            end,
            locked_until = case
                when (
                    case
                        when roma_finanzas_auth_private.login_attempts.window_started_at < now() - interval '15 minutes' then 1
                        else roma_finanzas_auth_private.login_attempts.failed_count + 1
                    end
                ) >= 8 then now() + interval '15 minutes'
                else null
            end;

        return jsonb_build_object(
            'ok', false,
            'error', 'invalid_credentials'
        );
    end if;

    if coalesce(v_business.acceso_finanzas, false) is false
       or lower(coalesce(v_business.estado_finanzas, 'sin_acceso')) not in ('trial', 'activo')
       or (
            v_business.fecha_vencimiento_finanzas is not null
            and v_business.fecha_vencimiento_finanzas < now()
       ) then
        raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
    end if;

    delete from roma_finanzas_auth_private.login_attempts
    where slug_normalized = v_slug;

    return jsonb_build_object(
        'ok', true,
        'source', 'rservasroma',
        'external_negocio_id', v_business.id,
        'nombre', v_business.nombre,
        'telefono', v_business.telefono,
        'plan', v_business.plan,
        'email', v_business.email,
        'especialidad', v_business.especialidad,
        'slug', v_business.slug,
        'color_primario', v_business.color_primario,
        'color_secundario', v_business.color_secundario,
        'logo_url', v_business.logo_url,
        'acceso_finanzas', v_business.acceso_finanzas,
        'estado_finanzas', v_business.estado_finanzas,
        'fecha_activacion_finanzas', v_business.fecha_activacion_finanzas,
        'fecha_vencimiento_finanzas', v_business.fecha_vencimiento_finanzas
    );
end;
$$;

revoke all on function public.verify_roma_finanzas_identity(text, text)
from public, anon, authenticated;
grant execute on function public.verify_roma_finanzas_identity(text, text)
to anon, authenticated;

-- COMPATIBILIDAD TEMPORAL DE PRODUCCION:
-- No se cambian aqui los permisos de public.negocios. Las apps antiguas de
-- RservasRoma todavia consultan password_hash desde el navegador. Ese acceso
-- se cerrara en un corte posterior, despues de migrar todos sus login al RPC.

commit;
