-- RomaFinanzas: que todo salón nuevo nazca CON acceso.
-- Ejecutar una sola vez en el SQL Editor de Supabase.
--
-- QUÉ SE MIDIÓ (13-09-2026, proyecto zorhclhvykikaachfrmp)
--   398 salones (sin contar las tiendas de RomaHub)
--   352 con acceso_finanzas = true  / estado_finanzas = 'activo'
--    46 con acceso_finanzas = false / estado_finanzas = 'sin_acceso'
--
--   Los 46 son EXACTAMENTE los más nuevos: ninguno registrado antes del
--   20-08-2026 está sin acceso, y todos los registrados desde entonces lo
--   están (5 en agosto, 41 en septiembre).
--
-- POR QUÉ PASA
-- La migración que creó las columnas (roma-finanzas-access.sql) las dejó así:
--     acceso_finanzas boolean default false
--     estado_finanzas text    default 'sin_acceso'
-- Los 352 que sí tienen acceso se activaron a mano en su momento. Desde
-- entonces nadie vuelve a tocarlos: el alta de clientes (nuevo-cliente.js) no
-- menciona finanzas, así que cada salón nuevo se queda con el valor por
-- defecto, que es "sin acceso". No hay ningún fallo de código: es el default.
--
-- La salonera lo ve como este mensaje al intentar entrar (login_roma_finanzas):
--     "Tu negocio no tiene acceso activo a Roma Finanzas."
--
-- DECISIÓN QUE ESTÁS TOMANDO AL CORRER ESTO
-- A partir de aquí, TODO salón nuevo tendrá RomaFinanzas sin que nadie lo
-- active. Es coherente con lo que ya hay: de los 352 con acceso, NINGUNO tiene
-- fecha_vencimiento_finanzas, o sea que hoy el acceso no está limitado en el
-- tiempo para nadie. Si algún día quieres cobrarlo aparte, habrá que volver a
-- poner el default en false y activar uno a uno.

begin;

-- 1. Que los nuevos nazcan con acceso.
alter table public.negocios
    alter column acceso_finanzas set default true,
    alter column estado_finanzas set default 'activo';

-- 2. Poner al día a los 46 que se quedaron atrás.
--    Solo toca a los que están en 'sin_acceso': si alguna vez desactivas un
--    salón a propósito con otro estado, esto no se lo pisa.
update public.negocios
set acceso_finanzas = true,
    estado_finanzas = 'activo',
    fecha_activacion_finanzas = coalesce(fecha_activacion_finanzas, now()),
    updated_at = now()
where coalesce(es_tienda_externa, false) = false
  and (
      coalesce(acceso_finanzas, false) = false
      or lower(coalesce(estado_finanzas, 'sin_acceso')) = 'sin_acceso'
  );

commit;

-- Comprobación: "sin_acceso" tiene que quedar en 0 y los defaults en true/activo.
select
    (select count(*) from public.negocios
      where coalesce(es_tienda_externa, false) = false
        and coalesce(acceso_finanzas, false) = false) as salones_sin_acceso,
    (select count(*) from public.negocios
      where coalesce(es_tienda_externa, false) = false
        and acceso_finanzas = true) as salones_con_acceso,
    (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'negocios'
        and column_name = 'acceso_finanzas') as nuevo_default_acceso,
    (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'negocios'
        and column_name = 'estado_finanzas') as nuevo_default_estado;
