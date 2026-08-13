-- Verificacion de solo lectura para el acceso compartido.
-- Ejecutar cada bloque en el proyecto indicado.

-- ============================================================
-- BLOQUE A: ejecutar en RservasRoma
-- ============================================================

select
    to_regprocedure('public.verify_roma_finanzas_identity(text,text)') is not null
        as identity_provider_ready,
    has_function_privilege(
        'anon',
        'public.verify_roma_finanzas_identity(text,text)',
        'EXECUTE'
    ) as anon_can_verify_via_rpc,
    to_regclass('roma_finanzas_auth_private.login_attempts') is not null
        as rate_limit_ready;

-- Debe seguir mostrando true durante el periodo de compatibilidad con los
-- login antiguos. No cerrar este permiso hasta actualizar RservasRoma.
select
    has_column_privilege('anon', 'public.negocios', 'password_hash', 'SELECT')
        as legacy_password_hash_still_visible;

-- ============================================================
-- BLOQUE B: ejecutar en FinanzasRoma
-- ============================================================

select
    to_regprocedure('public.create_federated_roma_finanzas_session(jsonb)') is not null
        as federated_session_bridge_ready,
    has_function_privilege(
        'service_role',
        'public.create_federated_roma_finanzas_session(jsonb)',
        'EXECUTE'
    ) as service_role_can_create_session,
    has_function_privilege(
        'anon',
        'public.create_federated_roma_finanzas_session(jsonb)',
        'EXECUTE'
    ) = false as anon_cannot_create_session,
    has_function_privilege(
        'anon',
        'public.load_roma_finanzas(text)',
        'EXECUTE'
    ) as anon_can_use_opaque_finance_session;

select
    count(*) filter (where external_negocio_id is not null) as linked_businesses,
    count(*) filter (where integration_source = 'rservasroma') as rservasroma_businesses
from public.negocios;
