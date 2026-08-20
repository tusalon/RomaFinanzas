-- Blindaje del 18/08/2026: que ningun cliente pueda volver a tumbar la base.
--
-- POR QUE ESTO EXISTE
-- Dos caidas en dos dias por el mismo mecanismo. El 17/08: 107 millones de
-- transacciones abortadas, el 89,9 % de todas. El 18/08: la base entera sin
-- responder, con las conexiones activas ejecutando apply_roma_finanzas_change_v2
-- en bucle. Las dos veces la salida fue quitarle el nombre a la funcion, que es
-- un torniquete: para la hemorragia y deja al cliente sin poder guardar.
--
-- EL DATO QUE MANDA EN ESTE DISENO: hay APK repartido. Esos telefonos ejecutaran
-- para siempre lo que llevan compilado dentro. Por eso ningun arreglo en el
-- cliente puede ser la garantia. El servidor tiene que aguantar a cualquier
-- cliente, presente o futuro, incluido uno que llame mil veces por segundo.
--
-- QUE HACE ESTE ARCHIVO
--   1. Una sesion muerta deja de lanzar excepcion y pasa a devolver un 200 con
--      {"ok": false, "motivo": "..."}. Sin excepcion no hay transaccion
--      abortada: la tormenta de abortos deja de ser posible. Y como un 200 no
--      es un error, el bucle de reintento-ante-error de los APK viejos ni se
--      dispara: se frenan solos sin actualizarse.
--   2. Un freno de llamadas por sesion, dentro de la propia funcion. Aunque un
--      cliente insista, a partir del limite se le responde sin hacer nada.
--
-- Se ejecuta DESPUES de incidente-2026-08-18-corte.sql, entero y en orden.

begin;

-- ============================================================
-- 1. CONTADOR DE LLAMADAS POR SESION
-- ============================================================
-- Una fila por sesion, con ventana de un minuto. Es la parte que no depende de
-- la buena voluntad de nadie: el techo lo pone el servidor.
create table if not exists public.roma_finanzas_llamadas (
    token_hash text primary key,
    ventana_inicio timestamptz not null default now(),
    conteo integer not null default 0
);

alter table public.roma_finanzas_llamadas enable row level security;
revoke all on table public.roma_finanzas_llamadas from public, anon, authenticated;

-- Limite por sesion y minuto. 60 es holgado para uso normal (la app hace unas
-- pocas llamadas por accion de la duena) y ridiculo para un bucle, que hace
-- miles. Si algun dia estorba, se sube aqui y solo aqui.
create or replace function roma_finanzas_private.limite_llamadas()
returns integer
language sql
immutable
as $$ select 60 $$;

-- ============================================================
-- 2. COMPROBACION DE SESION QUE NO LANZA EXCEPCIONES
-- ============================================================
-- Devuelve siempre un jsonb, nunca lanza. Los motivos posibles:
--   sesion_invalida      el token no tiene forma de token
--   sesion_vencida       no existe, esta revocada o caduco
--   sin_acceso           el negocio no tiene RomaFinanzas activo
--   demasiadas_llamadas  paso del limite en el ultimo minuto
create or replace function roma_finanzas_private.comprobar_sesion(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_hash text;
    v_conteo integer;
    v_business_id uuid;
begin
    -- El hash se calcula SIEMPRE, incluso para un token con mala pinta: si no,
    -- un bucle con basura por token se saltaria el contador entero.
    v_hash := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

    -- El freno va PRIMERO, antes de tocar ninguna tabla de negocio. Es un
    -- upsert de una sola fila: dos ordenes de magnitud menos que el trabajo
    -- que hace la funcion de verdad.
    insert into public.roma_finanzas_llamadas as l (token_hash, ventana_inicio, conteo)
    values (v_hash, now(), 1)
    on conflict (token_hash) do update
    set conteo = case
            when l.ventana_inicio < now() - interval '1 minute' then 1
            else l.conteo + 1
        end,
        ventana_inicio = case
            when l.ventana_inicio < now() - interval '1 minute' then now()
            else l.ventana_inicio
        end
    returning l.conteo into v_conteo;

    if v_conteo > roma_finanzas_private.limite_llamadas() then
        return jsonb_build_object('ok', false, 'motivo', 'demasiadas_llamadas');
    end if;

    if coalesce(length(p_token), 0) < 32 then
        return jsonb_build_object('ok', false, 'motivo', 'sesion_invalida');
    end if;

    update public.roma_finanzas_sessions
    set last_seen_at = now()
    where token_hash = v_hash
      and revoked_at is null
      and expires_at > now()
    returning negocio_id into v_business_id;

    if v_business_id is null then
        return jsonb_build_object('ok', false, 'motivo', 'sesion_vencida');
    end if;

    if not exists (
        select 1
        from public.negocios n
        where n.id = v_business_id
          and coalesce(n.acceso_finanzas, false) = true
          and lower(coalesce(n.estado_finanzas, 'sin_acceso')) in ('trial', 'activo')
          and (n.fecha_vencimiento_finanzas is null or n.fecha_vencimiento_finanzas >= now())
    ) then
        update public.roma_finanzas_sessions
        set revoked_at = now()
        where negocio_id = v_business_id and revoked_at is null;
        return jsonb_build_object('ok', false, 'motivo', 'sin_acceso');
    end if;

    return jsonb_build_object('ok', true, 'negocio_id', v_business_id);
end;
$$;

revoke all on function roma_finanzas_private.comprobar_sesion(text)
  from public, anon, authenticated;

-- ============================================================
-- 3. PUERTA DE ENTRADA DELANTE DE LAS FUNCIONES CON TOKEN
-- ============================================================
-- No se toca el cuerpo de las funciones: se renombra a _impl y se pone delante
-- una puerta que comprueba la sesion. Asi el cambio es pequeno y revisable, y
-- la logica de negocio (cientos de lineas) queda intacta.
--
-- Con la puerta puesta, un token muerto NUNCA llega al cuerpo: no se abre la
-- transaccion cara y no hay nada que abortar.

alter function public.apply_roma_finanzas_change_v3(text, text, jsonb)
  rename to apply_roma_finanzas_change_impl;
revoke all on function public.apply_roma_finanzas_change_impl(text, text, jsonb)
  from public, anon, authenticated;

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
    v_sesion := roma_finanzas_private.comprobar_sesion(p_token);
    if not (v_sesion->>'ok')::boolean then
        return v_sesion;
    end if;
    return public.apply_roma_finanzas_change_impl(p_token, p_operation, p_payload);
end;
$$;

revoke all on function public.apply_roma_finanzas_change_v3(text, text, jsonb) from public;
grant execute on function public.apply_roma_finanzas_change_v3(text, text, jsonb)
  to anon, authenticated;

alter function public.load_roma_finanzas(text) rename to load_roma_finanzas_impl;
revoke all on function public.load_roma_finanzas_impl(text)
  from public, anon, authenticated;

create or replace function public.load_roma_finanzas(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sesion jsonb;
begin
    v_sesion := roma_finanzas_private.comprobar_sesion(p_token);
    if not (v_sesion->>'ok')::boolean then
        return v_sesion;
    end if;
    -- En exito devuelve EXACTAMENTE lo de siempre: no se toca el formato o se
    -- rompen todos los clientes, incluidos los APK.
    return public.load_roma_finanzas_impl(p_token);
end;
$$;

revoke all on function public.load_roma_finanzas(text) from public;
grant execute on function public.load_roma_finanzas(text) to anon, authenticated;

-- ============================================================
-- 4. LIMPIEZA DEL CONTADOR
-- ============================================================
-- Sin esto la tabla crece una fila por token visto, para siempre.
create extension if not exists pg_cron;

select cron.unschedule('roma-finanzas-limpiar-llamadas')
where exists (select 1 from cron.job where jobname = 'roma-finanzas-limpiar-llamadas');

select cron.schedule(
    'roma-finanzas-limpiar-llamadas',
    '17 * * * *',
    $$ delete from public.roma_finanzas_llamadas where ventana_inicio < now() - interval '2 hours' $$
);

commit;

-- COMPROBAR
--
-- 1. Un token inventado debe dar 200 con ok:false, NUNCA un 4xx/5xx:
--      curl -s -w "\n%{http_code}\n" -X POST \
--        "https://zorhclhvykikaachfrmp.supabase.co/rest/v1/rpc/apply_roma_finanzas_change_v3" \
--        -H "apikey: TU_ANON_KEY" -H "Authorization: Bearer TU_ANON_KEY" \
--        -H "Content-Type: application/json" \
--        -d '{"p_token":"token-falso","p_operation":"noop","p_payload":{}}'
--    Esperado: 200 y {"ok": false, "motivo": "sesion_invalida"}
--
-- 2. El freno entra a partir de la llamada 61 en el mismo minuto:
--      for i in $(seq 1 80); do ... la misma llamada de arriba ... done
--    Las ultimas deben decir {"ok": false, "motivo": "demasiadas_llamadas"}.
--
-- 3. Y lo que importa de verdad: mientras corre esa reventada de 80 llamadas,
--    la base tiene que seguir respondiendo por debajo del segundo:
--      curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
--        ".../rest/v1/negocios?select=id&limit=1" -H "apikey: ..." -H "Authorization: ..."
--    Esa es la prueba de que la caida no puede repetirse.
--
-- DESHACER
--   drop function public.apply_roma_finanzas_change_v3(text, text, jsonb);
--   alter function public.apply_roma_finanzas_change_impl(text, text, jsonb)
--     rename to apply_roma_finanzas_change_v3;
--   drop function public.load_roma_finanzas(text);
--   alter function public.load_roma_finanzas_impl(text) rename to load_roma_finanzas;
--   grant execute on function public.apply_roma_finanzas_change_v3(text, text, jsonb)
--     to anon, authenticated;
--   grant execute on function public.load_roma_finanzas(text) to anon, authenticated;
