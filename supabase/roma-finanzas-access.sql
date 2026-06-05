alter table public.negocios
add column if not exists acceso_finanzas boolean default true,
add column if not exists estado_finanzas text default 'activo',
add column if not exists fecha_activacion_finanzas timestamptz,
add column if not exists fecha_vencimiento_finanzas timestamptz;

alter table public.negocios
alter column acceso_finanzas set default true,
alter column estado_finanzas set default 'activo';

update public.negocios
set acceso_finanzas = true,
    estado_finanzas = 'activo',
    fecha_activacion_finanzas = coalesce(fecha_activacion_finanzas, now())
where acceso_finanzas is distinct from true
   or estado_finanzas is distinct from 'activo';

create index if not exists idx_negocios_email_finanzas
on public.negocios (lower(email));

-- Roma Finanzas queda activo para todos los negocios por defecto.

create table if not exists public.roma_finanzas_config (
    negocio_id uuid primary key references public.negocios(id) on delete cascade,
    main_currency text not null default 'CUP',
    desired_margin numeric not null default 60,
    rates jsonb not null default '{"USD":350,"MLC":340,"EUR":360}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.roma_finanzas_services (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    name text not null,
    category text,
    price numeric not null default 0,
    duration integer not null default 60,
    currency text not null default 'CUP',
    active boolean not null default true,
    default_materials jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_materials (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    name text not null,
    cost numeric not null default 0,
    currency text not null default 'CUP',
    uses numeric not null default 1,
    cost_per_use numeric not null default 0,
    unit text,
    stock numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_ingresos (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    date date not null default current_date,
    service_id text,
    client text,
    amount numeric not null default 0,
    currency text not null default 'CUP',
    payment_method text,
    note text,
    created_at timestamptz not null default now(),
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_gastos (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    date date not null default current_date,
    category text,
    description text,
    amount numeric not null default 0,
    currency text not null default 'CUP',
    type text,
    created_at timestamptz not null default now(),
    primary key (negocio_id, id)
);

create table if not exists public.roma_finanzas_fichas_costo (
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    id text not null,
    service_id text,
    service_name text,
    material_usages jsonb not null default '[]'::jsonb,
    extra_expenses jsonb not null default '[]'::jsonb,
    sale_price numeric not null default 0,
    sale_currency text not null default 'CUP',
    totals jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    primary key (negocio_id, id)
);

alter table public.roma_finanzas_config disable row level security;
alter table public.roma_finanzas_services disable row level security;
alter table public.roma_finanzas_materials disable row level security;
alter table public.roma_finanzas_ingresos disable row level security;
alter table public.roma_finanzas_gastos disable row level security;
alter table public.roma_finanzas_fichas_costo disable row level security;

create index if not exists idx_roma_finanzas_ingresos_negocio_date
on public.roma_finanzas_ingresos (negocio_id, date desc);

create index if not exists idx_roma_finanzas_gastos_negocio_date
on public.roma_finanzas_gastos (negocio_id, date desc);

create index if not exists idx_roma_finanzas_fichas_negocio_created
on public.roma_finanzas_fichas_costo (negocio_id, created_at desc);
