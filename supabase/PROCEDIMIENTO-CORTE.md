# Si la base vuelve a caer: qué hacer, en orden

Escrito el 18/08/2026, después de dos caídas en dos días. Está aquí para que no
haya que redescubrirlo de madrugada con los 381 salones sin servicio.

## Cómo se reconoce

- La app se queda cargando y **no aparece nada en la consola** del navegador.
  No hay error porque la petición nunca vuelve.
- Cualquier consulta tarda o no responde:

```bash
curl -s -m 15 -o /dev/null -w "%{http_code} %{time_total}s\n" \
  "https://zorhclhvykikaachfrmp.supabase.co/rest/v1/negocios?select=id&limit=1" \
  -H "apikey: TU_ANON_KEY" -H "Authorization: Bearer TU_ANON_KEY"
```

- Alguna RPC devuelve `504` con `"Timed out acquiring connection from connection pool"`.

## Paso 1 — Ver quién se come las conexiones

En el **SQL Editor del dashboard**, que usa una ruta distinta al pooler y suele
responder aunque la API esté muerta:

```sql
select pid,
       now() - query_start as lleva_corriendo,
       state,
       left(query, 400) as consulta
from pg_stat_activity
where datname = current_database()
  and state in ('active', 'idle in transaction')
  and pid <> pg_backend_pid()
order by query_start
limit 12;
```

Lo que hay que leer:

- **Qué función** aparece dentro del texto de la consulta.
- **Cuánto lleva corriendo.** Si son minutos, están colgadas. Si son
  microsegundos y muchas a la vez, es un **bucle**: no están atascadas, se
  reemplazan sin parar. Este segundo caso es el de las dos caídas.

## Paso 2 — Cortar

**Matar conexiones no sirve contra un bucle** — duran microsegundos, no las
atrapas. Lo único que funciona es quitarles el nombre que llaman: PostgREST
responde 404 desde su caché en memoria, **sin abrir transacción**, así que
pueden insistir eternamente sin costar nada.

Cambia `FUNCION_EN_BUCLE` por lo que viste en el paso 1:

```sql
begin;

alter function public.FUNCION_EN_BUCLE(text, text, jsonb)
  rename to FUNCION_EN_BUCLE_nueva;

grant execute on function public.FUNCION_EN_BUCLE_nueva(text, text, jsonb)
  to anon, authenticated;

-- Los nombres de parámetro q_ son el truco: PostgREST encamina las RPC por
-- NOMBRE de parámetro, así que un cuerpo con p_token no casa con esto y sigue
-- recibiendo 404. Las llamadas internas de SQL son posicionales y sí encajan,
-- así que no se rompe la cadena interna.
create or replace function public.FUNCION_EN_BUCLE(
    q_token text, q_operation text, q_payload jsonb
) returns jsonb language sql as $$
    select public.FUNCION_EN_BUCLE_nueva(q_token, q_operation, q_payload);
$$;

revoke all on function public.FUNCION_EN_BUCLE(text, text, jsonb)
  from public, anon, authenticated;

commit;
```

**Coste:** los clientes actuales no podrán guardar hasta que despliegues una
versión que llame al nombre nuevo. Verán y anotarán en local, que es lo que la
app ya hace sin internet.

## Paso 3 — Confirmar que revivió

```sql
select count(*) from pg_stat_activity
where datname = current_database()
  and query like '%FUNCION_EN_BUCLE%';
```

Y la misma llamada `curl` del principio: debe responder `200` en menos de un
segundo.

## Paso 4 — Después, no antes

El torniquete para la hemorragia; no cura nada. Revisa que sigan puestas las
dos defensas permanentes:

- `blindaje-01-servidor.sql` — una sesión muerta devuelve `{"ok":false}` con
  200 en vez de lanzar excepción (sin excepción no hay transacción abortada), y
  hay un freno de 60 llamadas por minuto y sesión dentro de la propia función.
- `blindaje-02-alarma-abortos.sql` — avisa por ntfy cuando el ritmo de abortos
  se dispara, para enterarse antes de la caída y no después.

Si alguna de las dos no está aplicada, aplícala ahora.

## Por qué el cortafuegos del cliente no basta

Está en `utils/supabase.js` y frena ante fallos repetidos. Pero **hay APK
repartido**: esos teléfonos ejecutarán para siempre lo que llevan compilado
dentro. Cualquier defensa que dependa de que los clientes se actualicen fallará.
Por eso la garantía vive en el servidor.
