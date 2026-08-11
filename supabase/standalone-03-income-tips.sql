-- Roma Finanzas independiente: propinas separadas del precio del servicio.
-- Puede ejecutarse de forma segura sobre una instalacion existente.

begin;

alter table public.roma_finanzas_ingresos
add column if not exists tip_amount numeric(18, 4) not null default 0,
add column if not exists tip_currency text not null default 'CUP',
add column if not exists tip_rate_to_main numeric(18, 6) not null default 1,
add column if not exists tip_amount_main numeric(18, 4) not null default 0;

comment on column public.roma_finanzas_ingresos.tip_amount is
    'Propina original; no altera el precio ni el margen propio del servicio.';
comment on column public.roma_finanzas_ingresos.tip_amount_main is
    'Propina convertida con la tasa historica usada al registrar el ingreso.';

create or replace function public.save_roma_finanzas_income(
    p_token text,
    p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_result jsonb;
    v_business_id uuid;
    v_id text := nullif(p_payload->>'id', '');
    v_tip_amount numeric := coalesce(nullif(p_payload->>'tip_amount', '')::numeric, 0);
    v_tip_currency text;
    v_tip_rate numeric;
    v_tip_amount_main numeric;
    v_existing_tip_amount numeric;
    v_existing_tip_currency text;
    v_existing_tip_rate numeric;
    v_income_currency text;
    v_main_currency text;
    v_rates jsonb;
    v_tip_currency_cup numeric;
    v_main_currency_cup numeric;
begin
    if v_id is null then
        raise exception 'Falta el id del ingreso.';
    end if;
    if v_tip_amount < 0 then
        raise exception 'La propina no puede ser negativa.';
    end if;

    -- La operacion existente conserva todas las validaciones financieras,
    -- el costo historico, el control de versiones y la ficha aplicada.
    v_result := public.apply_roma_finanzas_change(
        p_token,
        'save_income',
        p_payload
    );
    v_business_id := roma_finanzas_private.session_business_id(p_token);

    select
        i.currency,
        i.tip_amount,
        i.tip_currency,
        i.tip_rate_to_main,
        c.main_currency,
        c.rates
    into
        v_income_currency,
        v_existing_tip_amount,
        v_existing_tip_currency,
        v_existing_tip_rate,
        v_main_currency,
        v_rates
    from public.roma_finanzas_ingresos i
    join public.roma_finanzas_config c on c.negocio_id = i.negocio_id
    where i.negocio_id = v_business_id
      and i.id = v_id
      and i.deleted_at is null;

    if v_income_currency is null then
        raise exception 'No se encontro el ingreso guardado.';
    end if;

    v_tip_currency := coalesce(
        nullif(p_payload->>'tip_currency', ''),
        v_income_currency,
        'CUP'
    );
    if v_tip_currency not in ('CUP', 'USD', 'MLC', 'EUR') then
        raise exception 'La moneda de la propina no es valida.';
    end if;

    if v_tip_amount = 0 then
        v_tip_rate := 1;
        v_tip_amount_main := 0;
    elsif v_existing_tip_amount > 0
       and v_existing_tip_currency = v_tip_currency
       and coalesce(v_existing_tip_rate, 0) > 0 then
        -- Editar el monto conserva la tasa historica si la moneda no cambia.
        v_tip_rate := v_existing_tip_rate;
        v_tip_amount_main := round(v_tip_amount * v_tip_rate, 4);
    else
        v_main_currency_cup := case
            when v_main_currency = 'CUP' then 1
            else nullif(v_rates->>v_main_currency, '')::numeric
        end;
        v_tip_currency_cup := case
            when v_tip_currency = 'CUP' then 1
            else nullif(v_rates->>v_tip_currency, '')::numeric
        end;

        if coalesce(v_main_currency_cup, 0) <= 0
           or coalesce(v_tip_currency_cup, 0) <= 0 then
            raise exception 'Falta una tasa valida para la moneda de la propina.';
        end if;

        v_tip_rate := v_tip_currency_cup / v_main_currency_cup;
        v_tip_amount_main := round(v_tip_amount * v_tip_rate, 4);
    end if;

    update public.roma_finanzas_ingresos
    set tip_amount = v_tip_amount,
        tip_currency = v_tip_currency,
        tip_rate_to_main = v_tip_rate,
        tip_amount_main = v_tip_amount_main
    where negocio_id = v_business_id
      and id = v_id
      and version = (v_result->>'version')::bigint;

    if not found then
        raise exception 'El ingreso cambio mientras se guardaba. Sincroniza e intenta otra vez.';
    end if;

    return v_result || jsonb_build_object(
        'tip_amount', v_tip_amount,
        'tip_currency', v_tip_currency,
        'tip_rate_to_main', v_tip_rate,
        'tip_amount_main', v_tip_amount_main
    );
end;
$$;

revoke all on function public.save_roma_finanzas_income(text, jsonb)
from public, anon, authenticated;
grant execute on function public.save_roma_finanzas_income(text, jsonb)
to authenticated;

commit;
