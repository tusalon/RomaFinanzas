-- FinanzasRoma: acepta identidades verificadas por la funcion Edge.
-- Ejecutar SOLO en el proyecto independiente FinanzasRoma y despues de 01-03.

begin;

alter table public.roma_finanzas_sessions
add column if not exists auth_source text not null default 'supabase-auth',
add column if not exists external_subject text;

create index if not exists idx_roma_finanzas_sessions_external
on public.roma_finanzas_sessions (auth_source, external_subject, expires_at desc);

create unique index if not exists uq_negocios_external_rservasroma
on public.negocios (external_negocio_id)
where external_negocio_id is not null;

create or replace function roma_finanzas_private.session_business_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business_id uuid;
    v_auth_source text;
    v_user_id uuid := auth.uid();
begin
    if coalesce(length(p_token), 0) < 32 then
        raise exception using message = 'Sesion invalida.', errcode = '28000';
    end if;

    update public.roma_finanzas_sessions
    set last_seen_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and revoked_at is null
      and expires_at > now()
      and (
          (user_id is not null and user_id = v_user_id)
          or (user_id is null and auth_source = 'rservasroma')
      )
    returning negocio_id, auth_source into v_business_id, v_auth_source;

    if v_business_id is null then
        raise exception using message = 'La sesion vencio. Entra de nuevo.', errcode = '28000';
    end if;

    if v_auth_source = 'rservasroma' then
        if not exists (
            select 1
            from public.negocios n
            where n.id = v_business_id
              and n.external_negocio_id is not null
              and n.acceso_finanzas = true
              and n.estado_finanzas in ('trial', 'activo')
              and (n.fecha_vencimiento_finanzas is null or n.fecha_vencimiento_finanzas >= now())
        ) then
            update public.roma_finanzas_sessions
            set revoked_at = now()
            where negocio_id = v_business_id
              and auth_source = 'rservasroma'
              and revoked_at is null;
            raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
        end if;
    elsif v_user_id is null or not exists (
        select 1
        from public.roma_finanzas_memberships m
        join public.negocios n on n.id = m.negocio_id
        where m.user_id = v_user_id
          and m.negocio_id = v_business_id
          and m.active = true
          and n.acceso_finanzas = true
          and n.estado_finanzas in ('trial', 'activo')
          and (n.fecha_vencimiento_finanzas is null or n.fecha_vencimiento_finanzas >= now())
    ) then
        raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
    end if;

    return v_business_id;
end;
$$;

revoke all on function roma_finanzas_private.session_business_id(text)
from public, anon, authenticated;

create or replace function public.create_federated_roma_finanzas_session(p_identity jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_external_id uuid;
    v_business_id uuid;
    v_slug text := lower(btrim(coalesce(p_identity->>'slug', '')));
    v_status text := lower(btrim(coalesce(p_identity->>'estado_finanzas', 'sin_acceso')));
    v_token text;
    v_expires_at timestamptz := now() + interval '12 hours';
    v_business public.negocios%rowtype;
begin
    if coalesce(p_identity->>'source', '') <> 'rservasroma'
       or coalesce((p_identity->>'acceso_finanzas')::boolean, false) is false
       or v_status not in ('trial', 'activo')
       or v_slug = ''
       or length(v_slug) > 128 then
        raise exception using message = 'Identidad de RservasRoma invalida.', errcode = '28000';
    end if;

    begin
        v_external_id := (p_identity->>'external_negocio_id')::uuid;
    exception when others then
        raise exception using message = 'Identidad de RservasRoma invalida.', errcode = '28000';
    end;

    select id into v_business_id
    from public.negocios
    where external_negocio_id = v_external_id
    limit 1;

    if v_business_id is null then
        select id into v_business_id
        from public.negocios
        where lower(slug) = v_slug
          and external_negocio_id is null
        limit 1;
    end if;

    if exists (
        select 1
        from public.negocios
        where lower(slug) = v_slug
          and id is distinct from v_business_id
          and external_negocio_id is distinct from v_external_id
    ) then
        raise exception using message = 'El slug ya pertenece a otro negocio de FinanzasRoma.', errcode = '23505';
    end if;

    if v_business_id is null then
        insert into public.negocios (
            nombre, telefono, plan, email, especialidad, slug,
            color_primario, color_secundario, logo_url,
            external_negocio_id, integration_source,
            acceso_finanzas, estado_finanzas,
            fecha_activacion_finanzas, fecha_vencimiento_finanzas
        ) values (
            coalesce(nullif(btrim(p_identity->>'nombre'), ''), v_slug),
            nullif(btrim(p_identity->>'telefono'), ''),
            coalesce(nullif(btrim(p_identity->>'plan'), ''), 'finanzas'),
            nullif(lower(btrim(p_identity->>'email')), ''),
            nullif(btrim(p_identity->>'especialidad'), ''),
            v_slug,
            nullif(btrim(p_identity->>'color_primario'), ''),
            nullif(btrim(p_identity->>'color_secundario'), ''),
            nullif(btrim(p_identity->>'logo_url'), ''),
            v_external_id, 'rservasroma', true, v_status,
            nullif(p_identity->>'fecha_activacion_finanzas', '')::timestamptz,
            nullif(p_identity->>'fecha_vencimiento_finanzas', '')::timestamptz
        )
        returning id into v_business_id;
    else
        update public.negocios
        set nombre = coalesce(nullif(btrim(p_identity->>'nombre'), ''), nombre),
            telefono = nullif(btrim(p_identity->>'telefono'), ''),
            plan = coalesce(nullif(btrim(p_identity->>'plan'), ''), plan),
            email = nullif(lower(btrim(p_identity->>'email')), ''),
            especialidad = nullif(btrim(p_identity->>'especialidad'), ''),
            slug = v_slug,
            color_primario = nullif(btrim(p_identity->>'color_primario'), ''),
            color_secundario = nullif(btrim(p_identity->>'color_secundario'), ''),
            logo_url = nullif(btrim(p_identity->>'logo_url'), ''),
            external_negocio_id = v_external_id,
            integration_source = 'rservasroma',
            acceso_finanzas = true,
            estado_finanzas = v_status,
            fecha_activacion_finanzas = nullif(p_identity->>'fecha_activacion_finanzas', '')::timestamptz,
            fecha_vencimiento_finanzas = nullif(p_identity->>'fecha_vencimiento_finanzas', '')::timestamptz,
            updated_at = now()
        where id = v_business_id;
    end if;

    delete from public.roma_finanzas_sessions
    where expires_at < now() - interval '7 days'
       or revoked_at < now() - interval '7 days';

    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.roma_finanzas_sessions (
        token_hash, negocio_id, user_id, auth_source, external_subject, expires_at
    ) values (
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_business_id, null, 'rservasroma', v_external_id::text, v_expires_at
    );

    select * into v_business
    from public.negocios
    where id = v_business_id;

    return jsonb_build_object(
        'token', v_token,
        'expires_at', v_expires_at,
        'business', jsonb_build_object(
            'id', v_business.id,
            'external_negocio_id', v_business.external_negocio_id,
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

revoke all on function public.create_federated_roma_finanzas_session(jsonb)
from public, anon, authenticated;
grant execute on function public.create_federated_roma_finanzas_session(jsonb)
to service_role;

-- Las operaciones siguen protegidas por el token opaco de 256 bits.
grant execute on function public.resume_roma_finanzas_session(text) to anon, authenticated;
grant execute on function public.logout_roma_finanzas(text) to anon, authenticated;
grant execute on function public.load_roma_finanzas(text) to anon, authenticated;
grant execute on function public.apply_roma_finanzas_change(text, text, jsonb) to anon, authenticated;
do $$
begin
    if to_regprocedure('public.save_roma_finanzas_income(text,jsonb)') is not null then
        execute 'grant execute on function public.save_roma_finanzas_income(text, jsonb) to anon, authenticated';
    end if;
end;
$$;

commit;
