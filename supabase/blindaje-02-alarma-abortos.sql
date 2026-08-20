-- Alarma de transacciones abortadas: enterarse ANTES de que se caiga.
--
-- Las dos caidas (17 y 18/08/2026) se descubrieron porque alguien no podia
-- entrar, con la base ya muerta y los 381 salones sin servicio. La senal
-- estaba ahi horas antes: el ritmo de transacciones abortadas se dispara mucho
-- antes de que el pool de conexiones se llene.
--
-- Esto mide ese ritmo cada 5 minutos y avisa por ntfy al telefono cuando se
-- sale de lo normal. En operacion sana los abortos son practicamente cero; en
-- el incidente eran 1.429 POR SEGUNDO.
--
-- ANTES DE EJECUTAR: cambia el topic de ntfy de la linea marcada por el tuyo.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 1. DONDE SE GUARDA LA MEDICION ANTERIOR
-- ============================================================
-- pg_stat_database da contadores acumulados desde que arranco la base, no un
-- ritmo. Para saber el ritmo hay que restar dos medidas: por eso se guarda la
-- anterior.
create table if not exists public.roma_salud_base (
    id smallint primary key default 1,
    medido_en timestamptz not null default now(),
    commits bigint not null default 0,
    rollbacks bigint not null default 0,
    ultimo_aviso timestamptz,
    constraint roma_salud_base_fila_unica check (id = 1)
);

revoke all on table public.roma_salud_base from public, anon, authenticated;
alter table public.roma_salud_base enable row level security;

-- ============================================================
-- 2. LA COMPROBACION
-- ============================================================
create or replace function public.comprobar_salud_base()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    -- CAMBIA ESTO por tu topic de ntfy antes de ejecutar el archivo.
    v_topic text := 'rservasroma-alarmas';

    -- Umbral deliberadamente alto para que no suene por ruido normal: en el
    -- incidente se midieron 1.429 abortos por segundo, o sea ~428.000 en una
    -- ventana de 5 minutos. Con 2.000 ya es inequivocamente anormal.
    v_abortos_minimos bigint := 2000;

    v_commits bigint;
    v_rollbacks bigint;
    v_previo public.roma_salud_base%rowtype;
    v_delta_rollbacks bigint;
    v_delta_commits bigint;
    v_minutos numeric;
    v_por_segundo numeric;
    v_avisar boolean := false;
begin
    select xact_commit, xact_rollback into v_commits, v_rollbacks
    from pg_stat_database where datname = current_database();

    select * into v_previo from public.roma_salud_base where id = 1;

    if v_previo.id is null then
        insert into public.roma_salud_base (id, medido_en, commits, rollbacks)
        values (1, now(), v_commits, v_rollbacks);
        return jsonb_build_object('ok', true, 'nota', 'primera medicion');
    end if;

    v_delta_rollbacks := greatest(0, v_rollbacks - v_previo.rollbacks);
    v_delta_commits := greatest(0, v_commits - v_previo.commits);
    v_minutos := greatest(0.5, extract(epoch from (now() - v_previo.medido_en)) / 60);
    v_por_segundo := round(v_delta_rollbacks / (v_minutos * 60), 1);

    -- Las dos condiciones a la vez: volumen alto Y mas fallos que aciertos.
    -- Solo el volumen podria dispararse en una migracion legitima; solo la
    -- proporcion, en una base muy tranquila con cuatro errores sueltos.
    v_avisar := v_delta_rollbacks > v_abortos_minimos
                and v_delta_rollbacks > v_delta_commits;

    -- Un aviso cada 30 minutos como mucho: una alarma que suena sin parar se
    -- silencia, y entonces no sirve para nada.
    if v_avisar and (v_previo.ultimo_aviso is null
                     or v_previo.ultimo_aviso < now() - interval '30 minutes') then
        perform net.http_post(
            url := 'https://ntfy.sh/' || v_topic,
            headers := jsonb_build_object(
                'Content-Type', 'text/plain',
                'Title', 'Base en riesgo: transacciones abortadas',
                'Priority', 'urgent',
                'Tags', 'rotating_light'
            ),
            body := ('La base esta abortando ' || v_por_segundo ||
                     ' transacciones por segundo (' || v_delta_rollbacks ||
                     ' en los ultimos ' || round(v_minutos) || ' min, contra ' ||
                     v_delta_commits || ' correctas). Mira pg_stat_activity y, si ' ||
                     'hay una funcion en bucle, aplica supabase/PROCEDIMIENTO-CORTE.md'
                    )::text
        );

        update public.roma_salud_base set ultimo_aviso = now() where id = 1;
    end if;

    update public.roma_salud_base
    set medido_en = now(), commits = v_commits, rollbacks = v_rollbacks
    where id = 1;

    return jsonb_build_object(
        'ok', true,
        'abortos', v_delta_rollbacks,
        'correctas', v_delta_commits,
        'por_segundo', v_por_segundo,
        'avisado', v_avisar
    );
end;
$$;

revoke all on function public.comprobar_salud_base() from public, anon, authenticated;

-- ============================================================
-- 3. CADA 5 MINUTOS
-- ============================================================
select cron.unschedule('roma-salud-base')
where exists (select 1 from cron.job where jobname = 'roma-salud-base');

select cron.schedule(
    'roma-salud-base',
    '*/5 * * * *',
    $$select public.comprobar_salud_base()$$
);

commit;

-- COMPROBAR
--
-- Ejecutarla dos veces con un minuto de diferencia: la primera guarda la linea
-- base, la segunda ya da un ritmo real.
--   select public.comprobar_salud_base();
--
-- Probar que el aviso llega de verdad, bajando el umbral a cero un momento:
-- edita v_abortos_minimos a 0, vuelve a crear la funcion, ejecutala, comprueba
-- que suena el telefono, y DEVUELVE el umbral a 2000.
--
-- Ver el historial del cron:
--   select jobname, status, return_message, start_time
--     from cron.job_run_details
--    where jobname = 'roma-salud-base'
--    order by start_time desc limit 10;
