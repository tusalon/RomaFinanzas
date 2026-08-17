-- Incidente del 17/08/2026: cortar el bucle de clientes viejos.
--
-- QUE PASO
-- El token de Finanzas dura 12 h. Al vencer, session_business_id() lanza una
-- excepcion y la transaccion se aborta sin tocar tablas. Clientes ya
-- desplegados (sobre todo APK, que no se actualizan solas) se quedaron
-- reintentando apply_roma_finanzas_change sin fin:
--
--   107.431.939 transacciones abortadas -- el 89,9 % de todas
--   1.429 fallos por segundo, 2.556 por cada llamada que funcionaba
--   la API de RservasRoma devolviendo 504 a los 379 salones
--
-- Revivir las sesiones no sirvio: los tokens que golpean ya no tienen fila en
-- roma_finanzas_sessions (login_roma_finanzas borra las vencidas hace mas de
-- 7 dias). Sin fila no hay nada que resucitar, y no se puede hacer que el
-- servidor los acepte.
--
-- LA SALIDA
-- Cuando PostgREST no encuentra una funcion, responde 404 desde su cache en
-- memoria SIN abrir transaccion. Comprobado: la funcion inexistente devuelve
-- "no matches were found in the schema cache". Asi que se le quita el nombre
-- por el que preguntan los clientes viejos: pueden seguir insistiendo eternamente
-- sin costarle nada a la base.
--
-- Se ejecuta entero, en orden. Es reversible (ver el final).

-- 1) El nombre que piden los clientes viejos deja de existir.
alter function public.apply_roma_finanzas_change(text, text, jsonb)
  rename to apply_roma_finanzas_change_v2;

-- 2) save_roma_finanzas_income llama por dentro a
--    public.apply_roma_finanzas_change(p_token, 'save_income', p_payload), y esa
--    llamada es POSICIONAL. Se recrea el nombre viejo como envoltorio para que
--    la siga encontrando -- pero con otros nombres de parametro, porque
--    PostgREST encamina las RPC por nombre de parametro: un cuerpo con
--    {p_token, p_operation, p_payload} no casa con esto y sigue dando 404.
create function public.apply_roma_finanzas_change(
    q_token text,
    q_operation text,
    q_payload jsonb
)
returns jsonb
language sql
as $$
    select public.apply_roma_finanzas_change_v2(q_token, q_operation, q_payload);
$$;

-- Nadie debe poder llamarlo por HTTP: es solo para el SQL interno.
revoke all on function public.apply_roma_finanzas_change(text, text, jsonb)
  from public, anon, authenticated;

-- 3) El nombre nuevo si lo usa el cliente actualizado.
revoke all on function public.apply_roma_finanzas_change_v2(text, text, jsonb) from public;
grant execute on function public.apply_roma_finanzas_change_v2(text, text, jsonb)
  to anon, authenticated;

-- COMPROBAR (el ritmo de fallos deberia desplomarse en un minuto)
--   select now(), xact_commit as ok, xact_rollback as fallidas
--     from pg_stat_database where datname = current_database();
--   -- correrla dos veces con un minuto de diferencia y restar
--
-- DESHACER
--   drop function public.apply_roma_finanzas_change(text, text, jsonb);
--   alter function public.apply_roma_finanzas_change_v2(text, text, jsonb)
--     rename to apply_roma_finanzas_change;
--   grant execute on function public.apply_roma_finanzas_change(text, text, jsonb)
--     to anon, authenticated;
