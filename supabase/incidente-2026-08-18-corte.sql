-- Incidente del 18/08/2026: cortar el bucle que llama a _v2.
--
-- QUE PASO
-- El 17/08 se le quito el nombre a apply_roma_finanzas_change y los clientes
-- viejos pasaron a recibir un 404 barato. Un dia despues volvio a caer, esta
-- vez por el nombre NUEVO: pg_stat_activity mostraba 6 de las conexiones
-- activas ejecutando apply_roma_finanzas_change_v2 con duraciones de
-- microsegundos -- no atascadas, sino nuevas cada instante. La base entera
-- dejo de responder: negocios, reservas, todo, para los 381 salones.
--
-- POR QUE EL CORTAFUEGOS DEL CLIENTE NO LO PARO
-- Se arma solo cuando el servidor responde 28000. Con el pool saturado el
-- servidor ya no responde 28000: responde 504 o nada. Y el cortafuegos, a
-- proposito, no se arma ante fallos de red. Se muerde la cola y el sistema no
-- puede recuperarse solo:
--
--   pool lleno -> los clientes reciben timeout, no 28000
--              -> el cortafuegos no se arma -> reintentan -> pool lleno
--
-- LA SALIDA (la misma que funciono el 17/08)
-- PostgREST responde 404 desde su cache en memoria SIN abrir transaccion
-- cuando no encuentra una funcion con esos nombres de parametro. Asi que se
-- le quita el nombre por el que preguntan: pueden seguir insistiendo
-- eternamente sin costarle nada a la base.
--
-- Esto es el TORNIQUETE, no la cura. La cura es que el servidor deje de ser
-- vulnerable a cualquier cliente: ver blindaje-01-sesion-sin-excepcion.sql y
-- blindaje-02-freno-por-sesion.sql. Ejecutar este primero.
--
-- Se ejecuta entero, en orden. Es reversible (ver el final).

begin;

-- 1) El nombre que martillean deja de existir.
alter function public.apply_roma_finanzas_change_v2(text, text, jsonb)
  rename to apply_roma_finanzas_change_v3;

revoke all on function public.apply_roma_finanzas_change_v3(text, text, jsonb) from public;
grant execute on function public.apply_roma_finanzas_change_v3(text, text, jsonb)
  to anon, authenticated;

-- 2) El nombre viejo se recrea como envoltorio, pero con OTROS nombres de
--    parametro. PostgREST encamina las RPC por nombre de parametro: un cuerpo
--    con {p_token, p_operation, p_payload} no casa con esto y sigue recibiendo
--    404 gratis. Las llamadas internas de SQL son POSICIONALES y si encajan,
--    asi que la cadena de save_roma_finanzas_income no se rompe.
create or replace function public.apply_roma_finanzas_change_v2(
    q_token text,
    q_operation text,
    q_payload jsonb
)
returns jsonb
language sql
as $$
    select public.apply_roma_finanzas_change_v3(q_token, q_operation, q_payload);
$$;

-- Nadie debe poder llamarlo por HTTP: es solo para el SQL interno.
revoke all on function public.apply_roma_finanzas_change_v2(text, text, jsonb)
  from public, anon, authenticated;

commit;

-- COMPROBAR (en este orden)
--
-- 1. Que la base revivio -- desde tu terminal, no aqui:
--      curl -s -m 15 -o /dev/null -w "%{http_code} %{time_total}s\n" \
--        "https://zorhclhvykikaachfrmp.supabase.co/rest/v1/negocios?select=id&limit=1" \
--        -H "apikey: TU_ANON_KEY" -H "Authorization: Bearer TU_ANON_KEY"
--    Debe responder 200 en menos de un segundo.
--
-- 2. Que ya no queda nadie ejecutando la funcion:
--      select count(*) from pg_stat_activity
--      where datname = current_database()
--        and query like '%apply_roma_finanzas_change%';
--
-- 3. Que el ritmo de abortos se desplomo -- correrla dos veces con un minuto
--    de diferencia y restar:
--      select now(), xact_commit as ok, xact_rollback as fallidas
--        from pg_stat_database where datname = current_database();
--
-- DESHACER
--   drop function public.apply_roma_finanzas_change_v2(text, text, jsonb);
--   alter function public.apply_roma_finanzas_change_v3(text, text, jsonb)
--     rename to apply_roma_finanzas_change_v2;
--   grant execute on function public.apply_roma_finanzas_change_v2(text, text, jsonb)
--     to anon, authenticated;
