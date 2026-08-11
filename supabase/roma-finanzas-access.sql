-- Roma Finanzas: esquema seguro y API RPC por sesion.
--
-- IMPORTANTE:
-- 1. Ejecutar primero en un proyecto de prueba o rama de base de datos.
-- 2. Publicar el cliente compatible con sesiones RPC antes de retirar el acceso legado.
-- 3. No ejecutar sin revisar el respaldo y el checklist de supabase/DEPLOYMENT.md.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.negocios
add column if not exists acceso_finanzas boolean default false,
add column if not exists estado_finanzas text default 'sin_acceso',
add column if not exists fecha_activacion_finanzas timestamptz,
add column if not exists fecha_vencimiento_finanzas timestamptz;

alter table public.negocios
alter column acceso_finanzas set default false,
alter column estado_finanzas set default 'sin_acceso';

update public.negocios
set acceso_finanzas = false
where acceso_finanzas is null;

update public.negocios
set estado_finanzas = 'sin_acceso'
where estado_finanzas is null or btrim(estado_finanzas) = '';

create index if not exists idx_negocios_slug_finanzas
on public.negocios (lower(slug));

create index if not exists idx_negocios_email_finanzas
on public.negocios (lower(email));

create table if not exists public.roma_finanzas_config (
    negocio_id uuid primary key references public.negocios(id) on delete cascade,
    main_currency text not null default 'CUP',
    desired_margin numeric(7, 4) not null default 60,
    rates jsonb not null default '{}'::jsonb,
    rates_updated_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 1
);

create table if not exists public.roma_finanzas_services (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    name text not null,
    category text,
    price numeric(18, 4) not null default 0,
    duration integer not null default 60,
    currency text not null default 'CUP',
    active boolean not null default true,
    default_materials jsonb not null default '[]'::jsonb,
    source text not null default 'manual',
    source_service_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    version bigint not null default 1,
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_materials (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    name text not null,
    cost numeric(18, 4) not null default 0,
    currency text not null default 'CUP',
    purchase_rate_to_main numeric(18, 6),
    purchase_cost_main numeric(18, 4),
    uses numeric(18, 4) not null default 1,
    cost_per_use numeric(18, 4) not null default 0,
    unit text,
    stock numeric(18, 4) not null default 0,
    low_stock_threshold numeric(18, 4),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    version bigint not null default 1,
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_fichas_costo (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    service_id text,
    service_name text,
    material_usages jsonb not null default '[]'::jsonb,
    extra_expenses jsonb not null default '[]'::jsonb,
    fixed_cost_usages jsonb not null default '[]'::jsonb,
    sale_price numeric(18, 4) not null default 0,
    sale_currency text not null default 'CUP',
    rate_to_main numeric(18, 6),
    totals jsonb not null default '{}'::jsonb,
    effective_from date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    version bigint not null default 1,
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_ingresos (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    date date not null default current_date,
    service_id text,
    client text,
    amount numeric(18, 4) not null default 0,
    currency text not null default 'CUP',
    rate_to_main numeric(18, 6) not null default 1,
    amount_main numeric(18, 4) not null default 0,
    tip_amount numeric(18, 4) not null default 0,
    tip_currency text not null default 'CUP',
    tip_rate_to_main numeric(18, 6) not null default 1,
    tip_amount_main numeric(18, 4) not null default 0,
    unit_cost_main numeric(18, 4) not null default 0,
    profit_main numeric(18, 4) not null default 0,
    margin numeric(9, 4) not null default 0,
    cost_sheet_id text,
    payment_method text,
    note text,
    source text not null default 'manual',
    booking_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    version bigint not null default 1,
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_gastos (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    date date not null default current_date,
    category text,
    description text,
    amount numeric(18, 4) not null default 0,
    currency text not null default 'CUP',
    rate_to_main numeric(18, 6) not null default 1,
    amount_main numeric(18, 4) not null default 0,
    type text,
    useful_life_months integer,
    depreciation_note text,
    recurring_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    version bigint not null default 1,
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_inventory_movements (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    material_id text not null,
    date date not null default current_date,
    movement_type text not null,
    quantity numeric(18, 4) not null,
    note text,
    source_income_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    version bigint not null default 1,
    primary key (negocio_id, id)
);

-- Actualizaciones compatibles con instalaciones que ya tienen las tablas.
alter table public.roma_finanzas_config
add column if not exists rates_updated_at timestamptz not null default now(),
add column if not exists version bigint not null default 1;

alter table public.roma_finanzas_services
add column if not exists source text not null default 'manual',
add column if not exists source_service_id text,
add column if not exists deleted_at timestamptz,
add column if not exists version bigint not null default 1;

alter table public.roma_finanzas_materials
add column if not exists purchase_rate_to_main numeric(18, 6),
add column if not exists purchase_cost_main numeric(18, 4),
add column if not exists low_stock_threshold numeric(18, 4),
add column if not exists deleted_at timestamptz,
add column if not exists version bigint not null default 1;

alter table public.roma_finanzas_fichas_costo
add column if not exists fixed_cost_usages jsonb not null default '[]'::jsonb,
add column if not exists rate_to_main numeric(18, 6),
add column if not exists effective_from date not null default current_date,
add column if not exists updated_at timestamptz not null default now(),
add column if not exists deleted_at timestamptz,
add column if not exists version bigint not null default 1;

alter table public.roma_finanzas_ingresos
add column if not exists rate_to_main numeric(18, 6) not null default 1,
add column if not exists amount_main numeric(18, 4) not null default 0,
add column if not exists tip_amount numeric(18, 4) not null default 0,
add column if not exists tip_currency text not null default 'CUP',
add column if not exists tip_rate_to_main numeric(18, 6) not null default 1,
add column if not exists tip_amount_main numeric(18, 4) not null default 0,
add column if not exists unit_cost_main numeric(18, 4) not null default 0,
add column if not exists profit_main numeric(18, 4) not null default 0,
add column if not exists margin numeric(9, 4) not null default 0,
add column if not exists cost_sheet_id text,
add column if not exists source text not null default 'manual',
add column if not exists booking_id text,
add column if not exists updated_at timestamptz not null default now(),
add column if not exists deleted_at timestamptz,
add column if not exists version bigint not null default 1;

alter table public.roma_finanzas_gastos
add column if not exists useful_life_months integer,
add column if not exists depreciation_note text,
add column if not exists rate_to_main numeric(18, 6) not null default 1,
add column if not exists amount_main numeric(18, 4) not null default 0,
add column if not exists recurring_key text,
add column if not exists updated_at timestamptz not null default now(),
add column if not exists deleted_at timestamptz,
add column if not exists version bigint not null default 1;

create unique index if not exists uq_roma_finanzas_ingresos_booking
on public.roma_finanzas_ingresos (negocio_id, booking_id)
where booking_id is not null and deleted_at is null;

create index if not exists idx_roma_finanzas_ingresos_negocio_date
on public.roma_finanzas_ingresos (negocio_id, date desc)
where deleted_at is null;

create index if not exists idx_roma_finanzas_gastos_negocio_date
on public.roma_finanzas_gastos (negocio_id, date desc)
where deleted_at is null;

create index if not exists idx_roma_finanzas_fichas_servicio_fecha
on public.roma_finanzas_fichas_costo (negocio_id, service_id, effective_from desc)
where deleted_at is null;

create index if not exists idx_roma_finanzas_inventory_material_date
on public.roma_finanzas_inventory_movements (negocio_id, material_id, date desc)
where deleted_at is null;

create table if not exists public.roma_finanzas_sessions (
    token_hash text primary key,
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz
);

create index if not exists idx_roma_finanzas_sessions_negocio
on public.roma_finanzas_sessions (negocio_id, expires_at desc);

create table if not exists public.roma_finanzas_login_attempts (
    username_normalized text primary key,
    failed_count integer not null default 0,
    window_started_at timestamptz not null default now(),
    locked_until timestamptz
);

create schema if not exists roma_finanzas_private;
revoke all on schema roma_finanzas_private from public, anon, authenticated;

create or replace function roma_finanzas_private.session_business_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business_id uuid;
begin
    if coalesce(length(p_token), 0) < 32 then
        raise exception using message = 'Sesion invalida.', errcode = '28000';
    end if;

    update public.roma_finanzas_sessions
    set last_seen_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and revoked_at is null
      and expires_at > now()
    returning negocio_id into v_business_id;

    if v_business_id is null then
        raise exception using message = 'La sesion vencio. Entra de nuevo.', errcode = '28000';
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
        raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
    end if;

    return v_business_id;
end;
$$;

revoke all on function roma_finanzas_private.session_business_id(text) from public, anon, authenticated;

create or replace function public.login_roma_finanzas(
    p_username text,
    p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business public.negocios%rowtype;
    v_username text := lower(btrim(coalesce(p_username, '')));
    v_password text := coalesce(p_password, '');
    v_attempt public.roma_finanzas_login_attempts%rowtype;
    v_token text;
    v_expires_at timestamptz := now() + interval '12 hours';
begin
    if v_username = '' or v_password = '' then
        raise exception using message = 'Escribe tu usuario y contrasena.', errcode = '22023';
    end if;

    select * into v_attempt
    from public.roma_finanzas_login_attempts
    where username_normalized = v_username;

    if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
        raise exception using message = 'Demasiados intentos. Espera unos minutos.', errcode = '28000';
    end if;

    select * into v_business
    from public.negocios
    where lower(slug) = v_username
    limit 1;

    if v_business.id is null and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'negocios' and column_name = 'usuario'
    ) then
        execute 'select * from public.negocios where lower(usuario) = $1 limit 1'
        into v_business
        using v_username;
    end if;

    if v_business.id is null
       or v_business.password_hash is null
       or extensions.crypt(v_password, v_business.password_hash) <> v_business.password_hash then
        insert into public.roma_finanzas_login_attempts (
            username_normalized, failed_count, window_started_at, locked_until
        ) values (
            v_username, 1, now(), null
        )
        on conflict (username_normalized) do update
        set failed_count = case
                when public.roma_finanzas_login_attempts.window_started_at < now() - interval '15 minutes' then 1
                else public.roma_finanzas_login_attempts.failed_count + 1
            end,
            window_started_at = case
                when public.roma_finanzas_login_attempts.window_started_at < now() - interval '15 minutes' then now()
                else public.roma_finanzas_login_attempts.window_started_at
            end,
            locked_until = case
                when (
                    case
                        when public.roma_finanzas_login_attempts.window_started_at < now() - interval '15 minutes' then 1
                        else public.roma_finanzas_login_attempts.failed_count + 1
                    end
                ) >= 8 then now() + interval '15 minutes'
                else null
            end;

        raise exception using message = 'Usuario o contrasena incorrectos.', errcode = '28000';
    end if;

    if coalesce(v_business.acceso_finanzas, false) is false
       or lower(coalesce(v_business.estado_finanzas, 'sin_acceso')) not in ('trial', 'activo')
       or (
            v_business.fecha_vencimiento_finanzas is not null
            and v_business.fecha_vencimiento_finanzas < now()
       ) then
        raise exception using message = 'Tu negocio no tiene acceso activo a Roma Finanzas.', errcode = '28000';
    end if;

    delete from public.roma_finanzas_login_attempts
    where username_normalized = v_username;

    delete from public.roma_finanzas_sessions
    where expires_at < now() - interval '7 days'
       or revoked_at < now() - interval '7 days';

    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.roma_finanzas_sessions (
        token_hash, negocio_id, expires_at
    ) values (
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_business.id,
        v_expires_at
    );

    return jsonb_build_object(
        'token', v_token,
        'expires_at', v_expires_at,
        'business', jsonb_build_object(
            'id', v_business.id,
            'nombre', v_business.nombre,
            'email', v_business.email,
            'telefono', v_business.telefono,
            'slug', v_business.slug,
            'plan', v_business.plan,
            'logo_url', v_business.logo_url,
            'acceso_finanzas', v_business.acceso_finanzas,
            'estado_finanzas', v_business.estado_finanzas,
            'fecha_vencimiento_finanzas', v_business.fecha_vencimiento_finanzas
        )
    );
end;
$$;

create or replace function public.resume_roma_finanzas_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business_id uuid;
begin
    v_business_id := roma_finanzas_private.session_business_id(p_token);

    return (
        select jsonb_build_object(
            'business', jsonb_build_object(
                'id', n.id,
                'nombre', n.nombre,
                'email', n.email,
                'telefono', n.telefono,
                'slug', n.slug,
                'plan', n.plan,
                'logo_url', n.logo_url,
                'acceso_finanzas', n.acceso_finanzas,
                'estado_finanzas', n.estado_finanzas,
                'fecha_vencimiento_finanzas', n.fecha_vencimiento_finanzas
            )
        )
        from public.negocios n
        where n.id = v_business_id
    );
end;
$$;

create or replace function public.logout_roma_finanzas(p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
    update public.roma_finanzas_sessions
    set revoked_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.load_roma_finanzas(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_business_id uuid;
begin
    v_business_id := roma_finanzas_private.session_business_id(p_token);

    return jsonb_build_object(
        'config', coalesce((
            select to_jsonb(c) - 'negocio_id'
            from public.roma_finanzas_config c
            where c.negocio_id = v_business_id
        ), '{}'::jsonb),
        'services', coalesce((
            select jsonb_agg(to_jsonb(s) - 'negocio_id' order by s.created_at)
            from public.roma_finanzas_services s
            where s.negocio_id = v_business_id and s.deleted_at is null
        ), '[]'::jsonb),
        'materials', coalesce((
            select jsonb_agg(to_jsonb(m) - 'negocio_id' order by m.created_at)
            from public.roma_finanzas_materials m
            where m.negocio_id = v_business_id and m.deleted_at is null
        ), '[]'::jsonb),
        'income_entries', coalesce((
            select jsonb_agg(to_jsonb(i) - 'negocio_id' order by i.date desc, i.created_at desc)
            from public.roma_finanzas_ingresos i
            where i.negocio_id = v_business_id and i.deleted_at is null
        ), '[]'::jsonb),
        'expense_entries', coalesce((
            select jsonb_agg(to_jsonb(e) - 'negocio_id' order by e.date desc, e.created_at desc)
            from public.roma_finanzas_gastos e
            where e.negocio_id = v_business_id and e.deleted_at is null
        ), '[]'::jsonb),
        'cost_sheets', coalesce((
            select jsonb_agg(to_jsonb(f) - 'negocio_id' order by f.effective_from desc, f.created_at desc)
            from public.roma_finanzas_fichas_costo f
            where f.negocio_id = v_business_id and f.deleted_at is null
        ), '[]'::jsonb),
        'inventory_movements', coalesce((
            select jsonb_agg(to_jsonb(im) - 'negocio_id' order by im.date desc, im.created_at desc)
            from public.roma_finanzas_inventory_movements im
            where im.negocio_id = v_business_id and im.deleted_at is null
        ), '[]'::jsonb),
        'catalog_services', coalesce((
            select jsonb_agg(to_jsonb(s) order by s.id)
            from public.servicios s
            where s.negocio_id = v_business_id
        ), '[]'::jsonb),
        'completed_bookings', coalesce((
            select jsonb_agg(to_jsonb(r) order by r.fecha desc)
            from (
                select id, fecha, cliente_nombre, servicio, estado,
                       monto_cobrado, precio_final, precio_original
                from public.reservas
                where negocio_id = v_business_id
                  and estado = 'Completado'
                order by fecha desc
                limit 2000
            ) r
        ), '[]'::jsonb)
    );
end;
$$;

-- Una sola puerta de escritura. El negocio se obtiene de la sesion, nunca del payload.
create or replace function public.apply_roma_finanzas_change(
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
    v_business_id uuid;
    v_id text := nullif(p_payload->>'id', '');
    v_now timestamptz := now();
    v_version bigint;
    v_expected_version bigint := nullif(p_payload->>'expected_version', '')::bigint;
    v_currency text;
    v_amount numeric;
    v_rate numeric;
    v_amount_main numeric;
    v_unit_cost numeric;
    v_profit numeric;
    v_main_currency text;
    v_rates jsonb;
    v_currency_cup numeric;
    v_main_currency_cup numeric;
    v_entry_date date;
    v_cost_sheet_id text;
    v_existing_currency text;
    v_existing_rate numeric;
    v_existing_service_id text;
    v_existing_date date;
    v_existing_unit_cost numeric;
    v_existing_cost_sheet_id text;
    v_existing_amount numeric;
    v_existing_amount_main numeric;
begin
    v_business_id := roma_finanzas_private.session_business_id(p_token);

    if p_operation in ('save_material', 'save_income', 'save_expense', 'save_cost_sheet') then
        select c.main_currency, c.rates
        into v_main_currency, v_rates
        from public.roma_finanzas_config c
        where c.negocio_id = v_business_id;

        if v_main_currency is null then
            raise exception 'Configura las monedas antes de guardar movimientos financieros.';
        end if;

        v_main_currency_cup := case
            when v_main_currency = 'CUP' then 1
            else nullif(v_rates->>v_main_currency, '')::numeric
        end;

        if coalesce(v_main_currency_cup, 0) <= 0 then
            raise exception 'La tasa de la moneda principal no es valida.';
        end if;
    end if;

    if p_operation = 'save_config' then
        if coalesce(p_payload->>'main_currency', 'CUP') not in ('CUP', 'USD', 'MLC', 'EUR') then
            raise exception 'Moneda principal no permitida.';
        end if;
        if coalesce((p_payload->>'desired_margin')::numeric, 0) <= 0
           or coalesce((p_payload->>'desired_margin')::numeric, 0) >= 100 then
            raise exception 'El margen deseado debe estar entre 1 y 99.';
        end if;
        if coalesce((p_payload->'rates'->>'USD')::numeric, 0) <= 0
           or coalesce((p_payload->'rates'->>'MLC')::numeric, 0) <= 0
           or coalesce((p_payload->'rates'->>'EUR')::numeric, 0) <= 0 then
            raise exception 'Todas las tasas deben ser mayores que cero.';
        end if;
        insert into public.roma_finanzas_config (
            negocio_id, main_currency, desired_margin, rates, rates_updated_at, updated_at, version
        ) values (
            v_business_id,
            coalesce(nullif(p_payload->>'main_currency', ''), 'CUP'),
            coalesce((p_payload->>'desired_margin')::numeric, 60),
            coalesce(p_payload->'rates', '{}'::jsonb),
            coalesce((p_payload->>'rates_updated_at')::timestamptz, v_now),
            v_now,
            1
        )
        on conflict (negocio_id) do update
        set main_currency = excluded.main_currency,
            desired_margin = excluded.desired_margin,
            rates = excluded.rates,
            rates_updated_at = excluded.rates_updated_at,
            updated_at = v_now,
            version = public.roma_finanzas_config.version + 1
        where v_expected_version is null or public.roma_finanzas_config.version = v_expected_version
        returning version into v_version;

    elsif p_operation = 'save_service' then
        if v_id is null then raise exception 'Falta el id del servicio.'; end if;
        if coalesce(p_payload->>'currency', 'CUP') not in ('CUP', 'USD', 'MLC', 'EUR')
           or coalesce((p_payload->>'price')::numeric, 0) < 0 then
            raise exception 'Revisa el precio y la moneda del servicio.';
        end if;
        insert into public.roma_finanzas_services (
            negocio_id, id, name, category, price, duration, currency, active,
            default_materials, source, source_service_id, updated_at, deleted_at, version
        ) values (
            v_business_id, v_id, coalesce(nullif(p_payload->>'name', ''), 'Servicio'),
            p_payload->>'category', coalesce((p_payload->>'price')::numeric, 0),
            greatest(coalesce((p_payload->>'duration')::integer, 60), 1),
            coalesce(nullif(p_payload->>'currency', ''), 'CUP'),
            coalesce((p_payload->>'active')::boolean, true),
            coalesce(p_payload->'default_materials', '[]'::jsonb),
            coalesce(nullif(p_payload->>'source', ''), 'manual'), p_payload->>'source_service_id',
            v_now, null, 1
        )
        on conflict (negocio_id, id) do update
        set name = excluded.name, category = excluded.category, price = excluded.price,
            duration = excluded.duration, currency = excluded.currency, active = excluded.active,
            default_materials = excluded.default_materials, source = excluded.source,
            source_service_id = excluded.source_service_id, updated_at = v_now,
            deleted_at = null, version = public.roma_finanzas_services.version + 1
        where v_expected_version is null or public.roma_finanzas_services.version = v_expected_version
        returning version into v_version;

    elsif p_operation = 'save_material' then
        if v_id is null then raise exception 'Falta el id del material.'; end if;
        v_currency := coalesce(nullif(p_payload->>'currency', ''), 'CUP');
        v_amount := coalesce((p_payload->>'cost')::numeric, 0);
        select m.currency, m.cost, m.purchase_rate_to_main, m.purchase_cost_main
        into v_existing_currency, v_existing_amount, v_existing_rate, v_existing_amount_main
        from public.roma_finanzas_materials m
        where m.negocio_id = v_business_id and m.id = v_id and m.deleted_at is null;
        if v_currency not in ('CUP', 'USD', 'MLC', 'EUR')
           or v_amount < 0
           or coalesce((p_payload->>'uses')::numeric, 0) <= 0 then
            raise exception 'Revisa el costo, moneda y rendimiento del material.';
        end if;
        if v_existing_currency = v_currency
           and v_existing_amount = v_amount
           and coalesce(v_existing_rate, 0) > 0 then
            v_rate := v_existing_rate;
            v_amount_main := coalesce(v_existing_amount_main, round(v_amount * v_rate, 4));
        else
            v_currency_cup := case
                when v_currency = 'CUP' then 1
                else nullif(v_rates->>v_currency, '')::numeric
            end;
            if coalesce(v_currency_cup, 0) <= 0 then
                raise exception 'Falta una tasa válida para la moneda del material.';
            end if;
            v_rate := v_currency_cup / v_main_currency_cup;
            v_amount_main := round(v_amount * v_rate, 4);
        end if;
        insert into public.roma_finanzas_materials (
            negocio_id, id, name, cost, currency, purchase_rate_to_main, purchase_cost_main,
            uses, cost_per_use, unit, stock, low_stock_threshold, updated_at, deleted_at, version
        ) values (
            v_business_id, v_id, coalesce(nullif(p_payload->>'name', ''), 'Material'),
            v_amount, v_currency,
            v_rate, v_amount_main,
            greatest(coalesce((p_payload->>'uses')::numeric, 1), 1),
            round(v_amount / greatest(coalesce((p_payload->>'uses')::numeric, 1), 1), 4), p_payload->>'unit',
            coalesce((p_payload->>'stock')::numeric, 0),
            nullif(p_payload->>'low_stock_threshold', '')::numeric,
            v_now, null, 1
        )
        on conflict (negocio_id, id) do update
        set name = excluded.name, cost = excluded.cost, currency = excluded.currency,
            purchase_rate_to_main = excluded.purchase_rate_to_main,
            purchase_cost_main = excluded.purchase_cost_main, uses = excluded.uses,
            cost_per_use = excluded.cost_per_use, unit = excluded.unit, stock = excluded.stock,
            low_stock_threshold = excluded.low_stock_threshold, updated_at = v_now,
            deleted_at = null, version = public.roma_finanzas_materials.version + 1
        where v_expected_version is null or public.roma_finanzas_materials.version = v_expected_version
        returning version into v_version;

    elsif p_operation = 'save_income' then
        if v_id is null then raise exception 'Falta el id del ingreso.'; end if;
        v_currency := coalesce(nullif(p_payload->>'currency', ''), 'CUP');
        v_amount := coalesce((p_payload->>'amount')::numeric, 0);
        v_entry_date := coalesce((p_payload->>'date')::date, current_date);

        select i.currency, i.rate_to_main, i.service_id, i.date,
               i.unit_cost_main, i.cost_sheet_id
        into v_existing_currency, v_existing_rate, v_existing_service_id,
             v_existing_date, v_existing_unit_cost, v_existing_cost_sheet_id
        from public.roma_finanzas_ingresos i
        where i.negocio_id = v_business_id and i.id = v_id and i.deleted_at is null;

        if v_currency not in ('CUP', 'USD', 'MLC', 'EUR') or v_amount <= 0 then
            raise exception 'El ingreso necesita monto y moneda válidos.';
        end if;

        if v_existing_currency = v_currency and coalesce(v_existing_rate, 0) > 0 then
            v_rate := v_existing_rate;
        else
            v_currency_cup := case
                when v_currency = 'CUP' then 1
                else nullif(v_rates->>v_currency, '')::numeric
            end;
            if coalesce(v_currency_cup, 0) <= 0 then
                raise exception 'Falta una tasa válida para la moneda del ingreso.';
            end if;
            v_rate := v_currency_cup / v_main_currency_cup;
        end if;

        if v_existing_service_id is not distinct from nullif(p_payload->>'service_id', '')
           and v_existing_date = v_entry_date then
            v_unit_cost := greatest(coalesce(v_existing_unit_cost, 0), 0);
            v_cost_sheet_id := v_existing_cost_sheet_id;
        else
            select f.id, greatest(coalesce((f.totals->>'totalCostMain')::numeric, 0), 0)
            into v_cost_sheet_id, v_unit_cost
            from public.roma_finanzas_fichas_costo f
            where f.negocio_id = v_business_id
              and f.service_id = nullif(p_payload->>'service_id', '')
              and f.deleted_at is null
              and f.effective_from <= v_entry_date
            order by f.effective_from desc, f.created_at desc
            limit 1;
            v_unit_cost := coalesce(v_unit_cost, 0);
        end if;
        v_amount_main := round(v_amount * v_rate, 4);
        v_profit := round(v_amount_main - v_unit_cost, 4);
        insert into public.roma_finanzas_ingresos (
            negocio_id, id, date, service_id, client, amount, currency, rate_to_main,
            amount_main, unit_cost_main, profit_main, margin, cost_sheet_id,
            payment_method, note, source, booking_id, updated_at, deleted_at, version
        ) values (
            v_business_id, v_id, v_entry_date,
            p_payload->>'service_id', p_payload->>'client', v_amount,
            v_currency, v_rate, v_amount_main, v_unit_cost, v_profit,
            case when v_amount_main > 0 then round((v_profit / v_amount_main) * 100, 4) else 0 end,
            v_cost_sheet_id,
            p_payload->>'payment_method', p_payload->>'note',
            coalesce(nullif(p_payload->>'source', ''), 'manual'), p_payload->>'booking_id',
            v_now, null, 1
        )
        on conflict (negocio_id, id) do update
        set date = excluded.date, service_id = excluded.service_id, client = excluded.client,
            amount = excluded.amount, currency = excluded.currency, rate_to_main = excluded.rate_to_main,
            amount_main = excluded.amount_main, unit_cost_main = excluded.unit_cost_main,
            profit_main = excluded.profit_main, margin = excluded.margin,
            cost_sheet_id = excluded.cost_sheet_id, payment_method = excluded.payment_method,
            note = excluded.note, source = excluded.source, booking_id = excluded.booking_id,
            updated_at = v_now, deleted_at = null,
            version = public.roma_finanzas_ingresos.version + 1
        where v_expected_version is null or public.roma_finanzas_ingresos.version = v_expected_version
        returning version into v_version;

    elsif p_operation = 'save_expense' then
        if v_id is null then raise exception 'Falta el id del gasto.'; end if;
        v_currency := coalesce(nullif(p_payload->>'currency', ''), 'CUP');
        v_amount := coalesce((p_payload->>'amount')::numeric, 0);
        select e.currency, e.rate_to_main
        into v_existing_currency, v_existing_rate
        from public.roma_finanzas_gastos e
        where e.negocio_id = v_business_id and e.id = v_id and e.deleted_at is null;

        if v_currency not in ('CUP', 'USD', 'MLC', 'EUR') or v_amount <= 0 then
            raise exception 'El gasto necesita monto y moneda válidos.';
        end if;
        if v_existing_currency = v_currency and coalesce(v_existing_rate, 0) > 0 then
            v_rate := v_existing_rate;
        else
            v_currency_cup := case
                when v_currency = 'CUP' then 1
                else nullif(v_rates->>v_currency, '')::numeric
            end;
            if coalesce(v_currency_cup, 0) <= 0 then
                raise exception 'Falta una tasa válida para la moneda del gasto.';
            end if;
            v_rate := v_currency_cup / v_main_currency_cup;
        end if;
        v_amount_main := round(v_amount * v_rate, 4);
        insert into public.roma_finanzas_gastos (
            negocio_id, id, date, category, description, amount, currency, rate_to_main,
            amount_main, type, useful_life_months, depreciation_note, recurring_key,
            updated_at, deleted_at, version
        ) values (
            v_business_id, v_id, coalesce((p_payload->>'date')::date, current_date),
            p_payload->>'category', p_payload->>'description',
            v_amount, v_currency, v_rate, v_amount_main, p_payload->>'type',
            nullif(p_payload->>'useful_life_months', '')::integer,
            p_payload->>'depreciation_note', p_payload->>'recurring_key',
            v_now, null, 1
        )
        on conflict (negocio_id, id) do update
        set date = excluded.date, category = excluded.category, description = excluded.description,
            amount = excluded.amount, currency = excluded.currency, rate_to_main = excluded.rate_to_main,
            amount_main = excluded.amount_main, type = excluded.type,
            useful_life_months = excluded.useful_life_months,
            depreciation_note = excluded.depreciation_note, recurring_key = excluded.recurring_key,
            updated_at = v_now, deleted_at = null,
            version = public.roma_finanzas_gastos.version + 1
        where v_expected_version is null or public.roma_finanzas_gastos.version = v_expected_version
        returning version into v_version;

    elsif p_operation = 'save_cost_sheet' then
        if v_id is null then raise exception 'Falta el id de la ficha.'; end if;
        v_currency := coalesce(nullif(p_payload->>'sale_currency', ''), 'CUP');
        if v_currency not in ('CUP', 'USD', 'MLC', 'EUR')
           or coalesce((p_payload->>'sale_price')::numeric, 0) <= 0 then
            raise exception 'La ficha necesita precio y moneda válidos.';
        end if;
        v_currency_cup := case
            when v_currency = 'CUP' then 1
            else nullif(v_rates->>v_currency, '')::numeric
        end;
        if coalesce(v_currency_cup, 0) <= 0 then
            raise exception 'Falta una tasa válida para la moneda de la ficha.';
        end if;
        v_rate := v_currency_cup / v_main_currency_cup;
        insert into public.roma_finanzas_fichas_costo (
            negocio_id, id, service_id, service_name, material_usages, extra_expenses,
            fixed_cost_usages, sale_price, sale_currency, rate_to_main, totals,
            effective_from, updated_at, deleted_at, version
        ) values (
            v_business_id, v_id, p_payload->>'service_id', p_payload->>'service_name',
            coalesce(p_payload->'material_usages', '[]'::jsonb),
            coalesce(p_payload->'extra_expenses', '[]'::jsonb),
            coalesce(p_payload->'fixed_cost_usages', '[]'::jsonb),
            coalesce((p_payload->>'sale_price')::numeric, 0),
            v_currency,
            v_rate,
            coalesce(p_payload->'totals', '{}'::jsonb),
            coalesce((p_payload->>'effective_from')::date, current_date),
            v_now, null, 1
        )
        on conflict (negocio_id, id) do update
        set service_id = excluded.service_id, service_name = excluded.service_name,
            material_usages = excluded.material_usages, extra_expenses = excluded.extra_expenses,
            fixed_cost_usages = excluded.fixed_cost_usages, sale_price = excluded.sale_price,
            sale_currency = excluded.sale_currency, rate_to_main = excluded.rate_to_main,
            totals = excluded.totals, effective_from = excluded.effective_from,
            updated_at = v_now, deleted_at = null,
            version = public.roma_finanzas_fichas_costo.version + 1
        where v_expected_version is null or public.roma_finanzas_fichas_costo.version = v_expected_version
        returning version into v_version;

    elsif p_operation = 'save_inventory_movement' then
        if v_id is null then raise exception 'Falta el id del movimiento.'; end if;
        if coalesce(p_payload->>'movement_type', '') not in ('entrada', 'salida', 'ajuste', 'consumo_servicio')
           or coalesce((p_payload->>'quantity')::numeric, 0) = 0 then
            raise exception 'Movimiento de inventario no válido.';
        end if;
        insert into public.roma_finanzas_inventory_movements (
            negocio_id, id, material_id, date, movement_type, quantity, note,
            source_income_id, updated_at, deleted_at, version
        ) values (
            v_business_id, v_id, p_payload->>'material_id',
            coalesce((p_payload->>'date')::date, current_date),
            p_payload->>'movement_type', coalesce((p_payload->>'quantity')::numeric, 0),
            p_payload->>'note', p_payload->>'source_income_id', v_now, null, 1
        )
        on conflict (negocio_id, id) do update
        set material_id = excluded.material_id, date = excluded.date,
            movement_type = excluded.movement_type, quantity = excluded.quantity,
            note = excluded.note, source_income_id = excluded.source_income_id,
            updated_at = v_now, deleted_at = null,
            version = public.roma_finanzas_inventory_movements.version + 1
        where v_expected_version is null or public.roma_finanzas_inventory_movements.version = v_expected_version
        returning version into v_version;

    elsif p_operation in (
        'delete_service', 'delete_material', 'delete_income', 'delete_expense',
        'delete_cost_sheet', 'delete_inventory_movement'
    ) then
        if v_id is null then raise exception 'Falta el id para eliminar.'; end if;

        if p_operation = 'delete_service' then
            update public.roma_finanzas_services set deleted_at = v_now, updated_at = v_now, version = version + 1
            where negocio_id = v_business_id and id = v_id
              and (v_expected_version is null or version = v_expected_version)
            returning version into v_version;
        elsif p_operation = 'delete_material' then
            update public.roma_finanzas_materials set deleted_at = v_now, updated_at = v_now, version = version + 1
            where negocio_id = v_business_id and id = v_id
              and (v_expected_version is null or version = v_expected_version)
            returning version into v_version;
        elsif p_operation = 'delete_income' then
            update public.roma_finanzas_ingresos set deleted_at = v_now, updated_at = v_now, version = version + 1
            where negocio_id = v_business_id and id = v_id
              and (v_expected_version is null or version = v_expected_version)
            returning version into v_version;
        elsif p_operation = 'delete_expense' then
            update public.roma_finanzas_gastos set deleted_at = v_now, updated_at = v_now, version = version + 1
            where negocio_id = v_business_id and id = v_id
              and (v_expected_version is null or version = v_expected_version)
            returning version into v_version;
        elsif p_operation = 'delete_cost_sheet' then
            update public.roma_finanzas_fichas_costo set deleted_at = v_now, updated_at = v_now, version = version + 1
            where negocio_id = v_business_id and id = v_id
              and (v_expected_version is null or version = v_expected_version)
            returning version into v_version;
        else
            update public.roma_finanzas_inventory_movements set deleted_at = v_now, updated_at = v_now, version = version + 1
            where negocio_id = v_business_id and id = v_id
              and (v_expected_version is null or version = v_expected_version)
            returning version into v_version;
        end if;
    else
        raise exception using message = 'Operacion financiera no permitida.', errcode = '22023';
    end if;

    if v_version is null then
        raise exception using
            message = 'Este registro cambió en otro dispositivo. Sincroniza antes de volver a guardar.',
            errcode = '40001';
    end if;

    return jsonb_build_object(
        'ok', true,
        'id', v_id,
        'version', coalesce(v_version, 0),
        'updated_at', v_now
    );
end;
$$;

-- Las tablas financieras y de sesiones nunca se consultan directamente desde el cliente.
alter table public.roma_finanzas_config enable row level security;
alter table public.roma_finanzas_config force row level security;
alter table public.roma_finanzas_services enable row level security;
alter table public.roma_finanzas_services force row level security;
alter table public.roma_finanzas_materials enable row level security;
alter table public.roma_finanzas_materials force row level security;
alter table public.roma_finanzas_ingresos enable row level security;
alter table public.roma_finanzas_ingresos force row level security;
alter table public.roma_finanzas_gastos enable row level security;
alter table public.roma_finanzas_gastos force row level security;
alter table public.roma_finanzas_fichas_costo enable row level security;
alter table public.roma_finanzas_fichas_costo force row level security;
alter table public.roma_finanzas_inventory_movements enable row level security;
alter table public.roma_finanzas_inventory_movements force row level security;
alter table public.roma_finanzas_sessions enable row level security;
alter table public.roma_finanzas_sessions force row level security;
alter table public.roma_finanzas_login_attempts enable row level security;
alter table public.roma_finanzas_login_attempts force row level security;

revoke all on table public.roma_finanzas_config from public, anon, authenticated;
revoke all on table public.roma_finanzas_services from public, anon, authenticated;
revoke all on table public.roma_finanzas_materials from public, anon, authenticated;
revoke all on table public.roma_finanzas_ingresos from public, anon, authenticated;
revoke all on table public.roma_finanzas_gastos from public, anon, authenticated;
revoke all on table public.roma_finanzas_fichas_costo from public, anon, authenticated;
revoke all on table public.roma_finanzas_inventory_movements from public, anon, authenticated;
revoke all on table public.roma_finanzas_sessions from public, anon, authenticated;
revoke all on table public.roma_finanzas_login_attempts from public, anon, authenticated;

-- La tabla es compartida con RservasRoma: conserva solo lectura de columnas públicas.
-- password_hash y cualquier otra columna no listada nunca se conceden al navegador.
revoke select on table public.negocios from public, anon, authenticated;
grant select (
    id, nombre, telefono, plan, fecha_registro, ntfy_topic, email, especialidad,
    slug, color_primario, color_secundario, logo_url,
    acceso_finanzas, estado_finanzas, fecha_activacion_finanzas, fecha_vencimiento_finanzas
) on public.negocios to anon, authenticated;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'negocios' and column_name = 'usuario'
    ) then
        execute 'grant select (usuario) on public.negocios to anon, authenticated';
    end if;
end;
$$;

revoke all on function public.login_roma_finanzas(text, text) from public;
revoke all on function public.resume_roma_finanzas_session(text) from public;
revoke all on function public.logout_roma_finanzas(text) from public;
revoke all on function public.load_roma_finanzas(text) from public;
revoke all on function public.apply_roma_finanzas_change(text, text, jsonb) from public;

grant execute on function public.login_roma_finanzas(text, text) to anon, authenticated;
grant execute on function public.resume_roma_finanzas_session(text) to anon, authenticated;
grant execute on function public.logout_roma_finanzas(text) to anon, authenticated;
grant execute on function public.load_roma_finanzas(text) to anon, authenticated;
grant execute on function public.apply_roma_finanzas_change(text, text, jsonb) to anon, authenticated;

commit;
