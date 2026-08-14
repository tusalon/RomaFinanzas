-- Rescate de las tasas y margenes que estos 4 negocios ajustaron mientras
-- FinanzasRoma corria contra la base aparte (rwodzlwzrkshgsbhhbrw).
--
-- Ejecutar en el proyecto de RservasRoma (zorhclhvykikaachfrmp) DESPUES de
-- shared-project-install.generated.sql, que es quien crea rates_updated_at.
--
-- Los valores son los que tenian en la otra base al 13 de agosto de 2026.
-- Van por slug, asi no dependen de ningun id.

begin;

-- bellasmanos
update public.roma_finanzas_config c
set main_currency = 'CUP',
    desired_margin = 60,
    rates = '{"EUR":775,"MLC":641,"USD":670}'::jsonb,
    rates_updated_at = now()
from public.negocios n
where n.id = c.negocio_id and n.slug = 'bellasmanos';

-- dnailspassion
update public.roma_finanzas_config c
set main_currency = 'CUP',
    desired_margin = 60,
    rates = '{"EUR":800,"MLC":550,"USD":670}'::jsonb,
    rates_updated_at = now()
from public.negocios n
where n.id = c.negocio_id and n.slug = 'dnailspassion';

-- exoticnailsbyyuly
update public.roma_finanzas_config c
set main_currency = 'CUP',
    desired_margin = 19,
    rates = '{"EUR":700,"MLC":500,"USD":650}'::jsonb,
    rates_updated_at = now()
from public.negocios n
where n.id = c.negocio_id and n.slug = 'exoticnailsbyyuly';

-- danis
-- OJO: su EUR estaba en 5000, muy fuera de linea con el resto (700-800).
-- Parece un error de tecleo suyo. Se copia tal cual para no inventar datos,
-- pero conviene que lo revisen al entrar.
update public.roma_finanzas_config c
set main_currency = 'CUP',
    desired_margin = 31,
    rates = '{"EUR":5000,"MLC":360,"USD":450}'::jsonb,
    rates_updated_at = now()
from public.negocios n
where n.id = c.negocio_id and n.slug = 'danis';

-- Comprobacion: deben salir las 4 filas con los valores de arriba.
select n.slug, c.main_currency, c.desired_margin, c.rates
from public.roma_finanzas_config c
join public.negocios n on n.id = c.negocio_id
where n.slug in ('bellasmanos', 'dnailspassion', 'exoticnailsbyyuly', 'danis')
order by n.slug;

commit;
