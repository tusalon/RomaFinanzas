-- Roma Finanzas independiente: Supabase Auth + membresias por negocio.
-- Ejecutar despues de standalone-01-bootstrap.sql y roma-finanzas-access.sql.

begin;

alter table public.roma_finanzas_sessions
add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_roma_finanzas_sessions_user
on public.roma_finanzas_sessions (user_id, expires_at desc);

-- Cada token financiero queda atado al usuario autenticado que lo creo.
create or replace function roma_finanzas_private.session_business_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business_id uuid;
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null or coalesce(length(p_token), 0) < 32 then
        raise exception using message = 'Sesion invalida.', errcode = '28000';
    end if;

    update public.roma_finanzas_sessions
    set last_seen_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and user_id = v_user_id
      and revoked_at is null
      and expires_at > now()
    returning negocio_id into v_business_id;

    if v_business_id is null then
        raise exception using message = 'La sesion vencio. Entra de nuevo.', errcode = '28000';
    end if;

    if not exists (
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
        update public.roma_finanzas_sessions
        set revoked_at = now()
        where user_id = v_user_id and negocio_id = v_business_id and revoked_at is null;
        raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
    end if;

    return v_business_id;
end;
$$;

revoke all on function roma_finanzas_private.session_business_id(text)
from public, anon, authenticated;

create or replace function public.start_roma_finanzas_auth_session()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid := auth.uid();
    v_business public.negocios%rowtype;
    v_token text;
    v_expires_at timestamptz := now() + interval '12 hours';
begin
    if v_user_id is null then
        raise exception using message = 'Debes iniciar sesion.', errcode = '28000';
    end if;

    select n.* into v_business
    from public.roma_finanzas_memberships m
    join public.negocios n on n.id = m.negocio_id
    where m.user_id = v_user_id
      and m.active = true
      and n.acceso_finanzas = true
      and n.estado_finanzas in ('trial', 'activo')
      and (n.fecha_vencimiento_finanzas is null or n.fecha_vencimiento_finanzas >= now())
    order by case m.role when 'owner' then 1 when 'admin' then 2 else 3 end,
             m.created_at
    limit 1;

    if v_business.id is null then
        raise exception using message = 'Tu usuario no tiene un negocio activo en Roma Finanzas.', errcode = '28000';
    end if;

    update public.roma_finanzas_sessions
    set revoked_at = now()
    where user_id = v_user_id and revoked_at is null;

    delete from public.roma_finanzas_sessions
    where expires_at < now() - interval '7 days'
       or revoked_at < now() - interval '7 days';

    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.roma_finanzas_sessions (
        token_hash, negocio_id, user_id, expires_at
    ) values (
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_business.id,
        v_user_id,
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

-- En el proyecto independiente no existe el catalogo ni las reservas de produccion.
create or replace function public.load_roma_finanzas(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business_id uuid;
begin
    v_business_id := roma_finanzas_private.session_business_id(p_token);

    return jsonb_build_object(
        'config', coalesce((
            select to_jsonb(c) - 'negocio_id'
            from public.roma_finanzas_config c
            where c.negocio_id = v_business_id
        ), '{}'::jsonb),
        'services', coalesce((
            select jsonb_agg(to_jsonb(s) - 'negocio_id' order by s.created_at)
            from public.roma_finanzas_services s
            where s.negocio_id = v_business_id and s.deleted_at is null
        ), '[]'::jsonb),
        'materials', coalesce((
            select jsonb_agg(to_jsonb(m) - 'negocio_id' order by m.created_at)
            from public.roma_finanzas_materials m
            where m.negocio_id = v_business_id and m.deleted_at is null
        ), '[]'::jsonb),
        'income_entries', coalesce((
            select jsonb_agg(to_jsonb(i) - 'negocio_id' order by i.date desc, i.created_at desc)
            from public.roma_finanzas_ingresos i
            where i.negocio_id = v_business_id and i.deleted_at is null
        ), '[]'::jsonb),
        'expense_entries', coalesce((
            select jsonb_agg(to_jsonb(e) - 'negocio_id' order by e.date desc, e.created_at desc)
            from public.roma_finanzas_gastos e
            where e.negocio_id = v_business_id and e.deleted_at is null
        ), '[]'::jsonb),
        'cost_sheets', coalesce((
            select jsonb_agg(to_jsonb(f) - 'negocio_id' order by f.effective_from desc, f.created_at desc)
            from public.roma_finanzas_fichas_costo f
            where f.negocio_id = v_business_id and f.deleted_at is null
        ), '[]'::jsonb),
        'inventory_movements', coalesce((
            select jsonb_agg(to_jsonb(im) - 'negocio_id' order by im.date desc, im.created_at desc)
            from public.roma_finanzas_inventory_movements im
            where im.negocio_id = v_business_id and im.deleted_at is null
        ), '[]'::jsonb),
        'catalog_services', '[]'::jsonb,
        'completed_bookings', '[]'::jsonb
    );
end;
$$;

-- El proyecto nuevo no usa hashes copiados ni login propio de RservasRoma.
drop function if exists public.login_roma_finanzas(text, text);
drop table if exists public.roma_finanzas_login_attempts;
alter table public.negocios drop column if exists password_hash;

-- Ya no se necesitan las tablas puente del primer paso.
drop table if exists public.servicios;
drop table if exists public.reservas;

alter table public.negocios enable row level security;
alter table public.negocios force row level security;
alter table public.roma_finanzas_memberships enable row level security;
alter table public.roma_finanzas_memberships force row level security;

revoke all on table public.negocios from public, anon, authenticated;
revoke all on table public.roma_finanzas_memberships from public, anon, authenticated;
revoke all on table public.roma_finanzas_sessions from public, anon, authenticated;

revoke all on function public.start_roma_finanzas_auth_session() from public, anon, authenticated;
revoke all on function public.resume_roma_finanzas_session(text) from public, anon, authenticated;
revoke all on function public.logout_roma_finanzas(text) from public, anon, authenticated;
revoke all on function public.load_roma_finanzas(text) from public, anon, authenticated;
revoke all on function public.apply_roma_finanzas_change(text, text, jsonb) from public, anon, authenticated;

grant execute on function public.start_roma_finanzas_auth_session() to authenticated;
grant execute on function public.resume_roma_finanzas_session(text) to authenticated;
grant execute on function public.logout_roma_finanzas(text) to authenticated;
grant execute on function public.load_roma_finanzas(text) to authenticated;
grant execute on function public.apply_roma_finanzas_change(text, text, jsonb) to authenticated;

commit;
