-- Roma Finanzas independiente: contrato base para un proyecto Supabase nuevo.
-- Ejecutar SOLO en el proyecto nuevo FinanzasRoma.
-- Orden: 01 bootstrap -> roma-finanzas-access.sql -> 02 auth bridge.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.negocios (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    telefono text,
    plan text not null default 'finanzas',
    fecha_registro timestamptz not null default now(),
    ntfy_topic text,
    email text,
    especialidad text,
    slug text not null unique,
    color_primario text,
    color_secundario text,
    logo_url text,
    external_negocio_id uuid,
    integration_source text not null default 'standalone',
    password_hash text,
    acceso_finanzas boolean not null default false,
    estado_finanzas text not null default 'sin_acceso',
    fecha_activacion_finanzas timestamptz,
    fecha_vencimiento_finanzas timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint negocios_estado_finanzas_check
        check (estado_finanzas in ('sin_acceso', 'trial', 'activo', 'vencido', 'bloqueado'))
);

comment on column public.negocios.external_negocio_id is
    'ID opcional del negocio en RservasRoma; no crea una dependencia entre bases.';
comment on column public.negocios.password_hash is
    'Columna temporal de compatibilidad. standalone-02-auth-bridge.sql la elimina.';

create table if not exists public.roma_finanzas_memberships (
    user_id uuid not null references auth.users(id) on delete cascade,
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    role text not null default 'owner',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, negocio_id),
    constraint roma_finanzas_memberships_role_check
        check (role in ('owner', 'admin', 'member', 'viewer'))
);

create index if not exists idx_roma_finanzas_memberships_negocio
on public.roma_finanzas_memberships (negocio_id, active);

-- Tablas puente temporales: permiten reutilizar la migracion financiera probada.
-- El segundo paso las elimina porque este proyecto no guarda reservas.
create table if not exists public.servicios (
    id uuid primary key default gen_random_uuid(),
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    nombre text not null,
    categoria text,
    precio numeric(18, 4) not null default 0,
    duracion integer not null default 60,
    activo boolean not null default true
);

create table if not exists public.reservas (
    id uuid primary key default gen_random_uuid(),
    negocio_id uuid not null references public.negocios(id) on delete cascade,
    fecha timestamptz not null default now(),
    cliente_nombre text,
    servicio text,
    estado text,
    monto_cobrado numeric(18, 4),
    precio_final numeric(18, 4),
    precio_original numeric(18, 4)
);

alter table public.negocios enable row level security;
alter table public.negocios force row level security;
alter table public.roma_finanzas_memberships enable row level security;
alter table public.roma_finanzas_memberships force row level security;
alter table public.servicios enable row level security;
alter table public.servicios force row level security;
alter table public.reservas enable row level security;
alter table public.reservas force row level security;

revoke all on table public.negocios from public, anon, authenticated;
revoke all on table public.roma_finanzas_memberships from public, anon, authenticated;
revoke all on table public.servicios from public, anon, authenticated;
revoke all on table public.reservas from public, anon, authenticated;

commit;
