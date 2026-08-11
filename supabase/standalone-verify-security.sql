-- Verificacion de solo lectura para el proyecto independiente FinanzasRoma.

select
    to_regclass('public.negocios') is not null as businesses_ready,
    to_regclass('public.roma_finanzas_memberships') is not null as memberships_ready,
    to_regclass('public.roma_finanzas_ingresos') is not null as finance_tables_ready,
    to_regclass('public.servicios') is null as temporary_services_removed,
    to_regclass('public.reservas') is null as temporary_bookings_removed,
    to_regprocedure('public.login_roma_finanzas(text,text)') is null as copied_password_login_removed,
    to_regprocedure('public.start_roma_finanzas_auth_session()') is not null as auth_bridge_ready;

select
    not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'negocios'
          and column_name = 'password_hash'
    ) as password_hash_removed;

select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
      'negocios', 'roma_finanzas_memberships', 'roma_finanzas_config',
      'roma_finanzas_services', 'roma_finanzas_materials',
      'roma_finanzas_fichas_costo', 'roma_finanzas_ingresos',
      'roma_finanzas_gastos', 'roma_finanzas_inventory_movements',
      'roma_finanzas_sessions'
  )
order by c.relname;

select
    has_function_privilege('anon', 'public.start_roma_finanzas_auth_session()', 'EXECUTE') = false
        as anon_cannot_start_session,
    has_function_privilege('authenticated', 'public.start_roma_finanzas_auth_session()', 'EXECUTE')
        as authenticated_can_start_session,
    has_function_privilege('anon', 'public.load_roma_finanzas(text)', 'EXECUTE') = false
        as anon_cannot_load_finances,
    has_function_privilege('authenticated', 'public.load_roma_finanzas(text)', 'EXECUTE')
        as authenticated_can_load_finances,
    has_table_privilege('anon', 'public.negocios', 'SELECT') = false
        as anon_cannot_read_businesses,
    has_table_privilege('authenticated', 'public.roma_finanzas_ingresos', 'SELECT') = false
        as authenticated_cannot_bypass_rpc;

select
    count(*) as active_businesses,
    count(*) filter (where m.active) as active_memberships
from public.negocios n
left join public.roma_finanzas_memberships m on m.negocio_id = n.id
where n.acceso_finanzas = true
  and n.estado_finanzas in ('trial', 'activo');
