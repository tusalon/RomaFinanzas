# FinanzasRoma en un proyecto Supabase independiente

Este procedimiento instala Roma Finanzas sin modificar la base productiva de RservasRoma. No copia contraseñas ni datos financieros. El vínculo futuro con reservas se hará mediante `external_negocio_id` y una integración explícita.

## 1. Conectar el proyecto nuevo

En el proyecto **FinanzasRoma**, abre **Connect** o **Project Settings > API** y copia solamente:

- Project URL.
- Publishable key o la clave pública `anon`.

No copies aquí la contraseña de PostgreSQL ni la clave `service_role`.

Crea un archivo `.env.local` en la raíz del proyecto:

```env
ROMA_BACKEND_MODE=standalone-auth
ROMA_SUPABASE_URL=https://REFERENCIA-EXACTA.supabase.co
ROMA_SUPABASE_ANON_KEY=CLAVE-PUBLICA-EXACTA
```

El archivo está ignorado por Git. El repositorio ya no contiene una conexión predeterminada a la base productiva.

## 2. Instalar el esquema

Para generar un único archivo listo para copiar:

```powershell
npm run db:standalone:bundle
```

Después pega y ejecuta `standalone-install.generated.sql` en **SQL Editor**. Ese archivo reúne los tres pasos en el orden correcto.

Como alternativa, puedes ejecutar los archivos manualmente:

En **SQL Editor** del proyecto nuevo, ejecuta en este orden y espera un resultado exitoso en cada paso:

1. `standalone-01-bootstrap.sql`
2. `roma-finanzas-access.sql`
3. `standalone-02-auth-bridge.sql`

El primer archivo crea el contrato mínimo. El segundo instala las tablas y cálculos financieros. El tercero cambia el acceso a Supabase Auth, elimina el login por hash y retira las tablas puente temporales.

Ejecuta después `standalone-verify-security.sql`. Todos los booleanos deben aparecer en `true` y todas las tablas listadas deben mostrar RLS habilitado y forzado.

## 3. Cerrar el registro público

En **Authentication**, desactiva la creación pública de usuarios. Roma Finanzas es exclusiva: los usuarios se crean desde el panel administrativo, no desde la app.

## 4. Crear el primer acceso

1. En **Authentication > Users**, crea el primer usuario con correo y contraseña y déjalo confirmado.
2. Abre `standalone-activate-first-business.sql`.
3. Sustituye el correo, nombre y `slug` de ejemplo.
4. Ejecuta la plantilla una sola vez en SQL Editor.

La operación se ejecuta dentro de una transacción. Si el correo no existe, no deja un negocio creado a medias.

## 5. Verificar la app

```powershell
npm run check
npm run pilot:preflight
npm run preview
```

Entra con el correo y la contraseña creados en Supabase Auth. La primera pantalla pedirá configurar las tasas reales de USD, MLC y EUR; la app no inventa tasas.

## Decisión sobre los datos reales

- La base original de RservasRoma queda intacta.
- FinanzasRoma empieza vacía y aislada.
- No se copia `password_hash`.
- Una caída o error en FinanzasRoma no modifica reservas.
- Cuando llegue la integración, se enviarán solo los datos necesarios de una cita completada y se conservará su identificador externo para evitar duplicados.
