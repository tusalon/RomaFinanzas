alter table public.negocios
add column if not exists acceso_finanzas boolean default false,
add column if not exists estado_finanzas text default 'sin_acceso',
add column if not exists fecha_activacion_finanzas timestamptz,
add column if not exists fecha_vencimiento_finanzas timestamptz;

create index if not exists idx_negocios_email_finanzas
on public.negocios (lower(email));

-- Ejemplo para activar un negocio:
-- update public.negocios
-- set acceso_finanzas = true,
--     estado_finanzas = 'activo',
--     fecha_activacion_finanzas = now(),
--     fecha_vencimiento_finanzas = now() + interval '30 days'
-- where lower(email) = lower('correo-del-negocio@gmail.com');
