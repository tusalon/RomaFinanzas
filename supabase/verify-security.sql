-- Ejecutar como administrador después de la migración.
-- Estas consultas no modifican datos.

select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in (
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
order by relname;

select grantee, table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name like 'roma_finanzas_%'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by table_name, grantee, privilege_type;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
      'login_roma_finanzas',
      'resume_roma_finanzas_session',
      'logout_roma_finanzas',
      'load_roma_finanzas',
      'apply_roma_finanzas_change'
  )
order by routine_name, grantee;

-- Debe devolver cero filas: el navegador nunca puede leer password_hash.
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'negocios'
  and column_name = 'password_hash'
  and grantee in ('PUBLIC', 'anon', 'authenticated');

select acceso_finanzas, estado_finanzas, count(*)
from public.negocios
group by acceso_finanzas, estado_finanzas
order by acceso_finanzas, estado_finanzas;
