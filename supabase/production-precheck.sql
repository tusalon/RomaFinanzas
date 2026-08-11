-- Roma Finanzas: comprobación de solo lectura antes del corte de producción.
-- No modifica tablas, permisos, funciones ni datos.

-- 1. Identidad del proyecto y versión del servidor.
select current_database() as database_name,
       current_user as executed_by,
       version() as postgres_version,
       now() as checked_at;

-- 2. Columnas compartidas imprescindibles.
with required_columns(table_name, column_name) as (
    values
        ('negocios', 'id'),
        ('negocios', 'slug'),
        ('negocios', 'password_hash'),
        ('negocios', 'acceso_finanzas'),
        ('negocios', 'estado_finanzas'),
        ('servicios', 'id'),
        ('servicios', 'negocio_id'),
        ('reservas', 'id'),
        ('reservas', 'negocio_id'),
        ('reservas', 'fecha'),
        ('reservas', 'cliente_nombre'),
        ('reservas', 'servicio'),
        ('reservas', 'estado'),
        ('reservas', 'monto_cobrado'),
        ('reservas', 'precio_final'),
        ('reservas', 'precio_original')
)
select r.table_name,
       r.column_name,
       (c.column_name is not null) as exists
from required_columns r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;

-- 3. Exposición actual de password_hash. Antes de la migración se espera true;
-- después del corte ambos valores deben ser false.
select has_column_privilege('anon', 'public.negocios', 'password_hash', 'select') as anon_can_read_password_hash,
       has_column_privilege('authenticated', 'public.negocios', 'password_hash', 'select') as authenticated_can_read_password_hash;

-- 4. Tablas financieras existentes y volumen aproximado para comparar después.
select c.relname as table_name,
       coalesce(s.n_live_tup, 0) as approximate_rows,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public'
  and c.relname in (
      'roma_finanzas_config',
      'roma_finanzas_services',
      'roma_finanzas_materials',
      'roma_finanzas_ingresos',
      'roma_finanzas_gastos',
      'roma_finanzas_fichas_costo',
      'roma_finanzas_inventory_movements',
      'roma_finanzas_sessions',
      'roma_finanzas_login_attempts'
  )
order by c.relname;

-- 5. Permisos directos actuales concedidos a roles de cliente.
select grantee, table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and (table_name = 'negocios' or table_name like 'roma_finanzas_%')
order by table_name, grantee, privilege_type;

-- 6. Estado de las cinco RPC. Antes del corte pueden aparecer como ausentes.
select expected.signature,
       to_regprocedure(expected.signature) is not null as installed
from (values
    ('public.login_roma_finanzas(text,text)'),
    ('public.resume_roma_finanzas_session(text)'),
    ('public.logout_roma_finanzas(text)'),
    ('public.load_roma_finanzas(text)'),
    ('public.apply_roma_finanzas_change(text,text,jsonb)')
) as expected(signature);

-- 7. Distribución actual del acceso financiero.
select coalesce(acceso_finanzas, false) as acceso_finanzas,
       coalesce(estado_finanzas, 'sin_acceso') as estado_finanzas,
       count(*) as negocios
from public.negocios
group by coalesce(acceso_finanzas, false), coalesce(estado_finanzas, 'sin_acceso')
order by acceso_finanzas, estado_finanzas;
