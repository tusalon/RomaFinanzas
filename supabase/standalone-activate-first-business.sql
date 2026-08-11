-- PLANTILLA: edita los tres valores antes de ejecutar en el proyecto FinanzasRoma.
-- El usuario debe existir primero en Authentication > Users.
-- No uses este archivo en la base productiva de RservasRoma.

begin;

do $$
declare
    v_user_email text := 'CAMBIA-ESTE-CORREO@ejemplo.com';
    v_business_name text := 'CAMBIA-ESTE-NOMBRE';
    v_business_slug text := 'cambia-este-slug';
    v_user_id uuid;
    v_business_id uuid;
begin
    select id into v_user_id
    from auth.users
    where lower(email) = lower(v_user_email)
    limit 1;

    if v_user_id is null then
        raise exception 'No existe un usuario de Supabase Auth con el correo %', v_user_email;
    end if;

    insert into public.negocios (
        nombre, email, slug, plan, acceso_finanzas, estado_finanzas,
        fecha_activacion_finanzas
    ) values (
        v_business_name, lower(v_user_email), lower(v_business_slug), 'finanzas',
        true, 'activo', now()
    )
    on conflict (slug) do update
    set nombre = excluded.nombre,
        email = excluded.email,
        acceso_finanzas = true,
        estado_finanzas = 'activo',
        fecha_activacion_finanzas = coalesce(
            public.negocios.fecha_activacion_finanzas,
            excluded.fecha_activacion_finanzas
        ),
        updated_at = now()
    returning id into v_business_id;

    insert into public.roma_finanzas_memberships (
        user_id, negocio_id, role, active
    ) values (
        v_user_id, v_business_id, 'owner', true
    )
    on conflict (user_id, negocio_id) do update
    set role = 'owner', active = true, updated_at = now();
end;
$$;

commit;
