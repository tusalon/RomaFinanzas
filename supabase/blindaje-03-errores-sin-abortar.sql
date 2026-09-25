-- Blindaje 3 (24-09-2026): un error de Finanzas ya no aborta la transaccion.
--
-- POR QUE EXISTE
-- Supabase aviso de CPU alta. Medido en produccion el 24-09-2026:
--   - salud_base_muestras: ~1.100 transacciones FALLIDAS por segundo, plano
--     toda la tarde, contra 1 correcta por segundo.
--   - pg_stat_activity: todo es PostgREST, y hay una conexion en
--     "idle in transaction (aborted)" ejecutando apply_roma_finanzas_change_v3.
--   - roma_finanzas_llamadas: 0 filas en los ultimos 10 minutos.
--
-- Ese ultimo dato es la clave. El freno de agosto (blindaje-01) suma 1 al
-- contador de la sesion y DESPUES llama al cuerpo de la funcion, todo en la
-- misma transaccion. Si el cuerpo lanza un error (un conflicto de version, un
-- dato invalido...), se deshace todo, TAMBIEN LA SUMA. El contador nunca pasa
-- de cero, el freno nunca salta, y un cliente que reintenta ante cada error
-- puede hacerlo mil veces por segundo sin que el servidor se entere.
--
-- QUE HACE
-- El cuerpo se llama dentro de un bloque que captura el error y lo devuelve
-- como respuesta normal: {"ok": false, "motivo": "error_operacion", ...}.
--   - Solo se deshace el trabajo del cuerpo; la suma del contador se queda.
--     A partir de 60 llamadas por minuto el freno contesta sin hacer nada.
--   - La transaccion termina bien: no hay transaccion abortada.
--   - Un 200 no es un error, asi que los APK viejos que reintentan ante error
--     dejan de reintentar solos (es el mismo criterio de blindaje-01).
--
-- QUE NO TOCA
-- El cuerpo (apply_roma_finanzas_change_impl) queda exactamente igual. Solo se
-- sustituye la puerta de entrada, que son 15 lineas.
--
-- Se puede correr dos veces sin romper nada.

begin;

create or replace function public.apply_roma_finanzas_change_v3(
    p_token text,
    p_operation text,
    p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sesion jsonb;
begin
    -- Esto suma 1 al contador. Queda FUERA del bloque de abajo a proposito:
    -- si el cuerpo falla, la suma no se deshace y el freno puede actuar.
    v_sesion := roma_finanzas_private.comprobar_sesion(p_token);
    if not (v_sesion->>'ok')::boolean then
        return v_sesion;
    end if;

    begin
        return public.apply_roma_finanzas_change_impl(p_token, p_operation, p_payload);
    exception when others then
        return jsonb_build_object(
            'ok', false,
            'motivo', 'error_operacion',
            'mensaje', sqlerrm,
            'codigo', sqlstate
        );
    end;
end;
$$;

revoke all on function public.apply_roma_finanzas_change_v3(text, text, jsonb) from public;
grant execute on function public.apply_roma_finanzas_change_v3(text, text, jsonb)
  to anon, authenticated;

commit;

-- ============================================================
-- COMPROBAR (esperar 10 minutos despues de correrlo)
-- ============================================================
--
-- 1. Las transacciones fallidas tienen que caer de ~1.100/s a casi 0:
--
-- select to_char(momento at time zone 'America/Havana', 'DD HH24:MI') as hora_cuba,
--        round((rollbacks - lag(rollbacks) over w)
--              / extract(epoch from momento - lag(momento) over w)) as fallidas_por_segundo
-- from public.salud_base_muestras
-- where momento > now() - interval '1 hour'
-- window w as (order by momento)
-- order by momento desc;
--
-- 2. Y ahora el contador SI deja ver quien era (antes salia vacio):
--
-- select n.nombre, l.conteo as llamadas_en_su_minuto, l.ventana_inicio
-- from public.roma_finanzas_llamadas l
-- left join public.roma_finanzas_sessions s on s.token_hash = l.token_hash
-- left join public.negocios n on n.id = s.negocio_id
-- order by l.conteo desc
-- limit 10;
--
-- DESHACER (vuelve a la puerta de blindaje-01, sin el bloque):
--   volver a correr la seccion 3 de blindaje-01-servidor.sql, solo el
--   "create or replace function public.apply_roma_finanzas_change_v3".
