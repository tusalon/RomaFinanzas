# Roma Finanzas

PWA y aplicación Android para que negocios de belleza de RservasRoma conozcan el costo, ganancia y margen de cada servicio.

La versión 2.0.0 estrena un diseño profesional y amigable con navegación flotante, jerarquía visual renovada y accesibilidad mejorada. Mantiene la experiencia guiada, selección de productos con un toque, cálculo de costos, propinas separadas, gastos, inventario, reportes descargables, trabajo offline y acceso independiente mediante Supabase Auth. La revisión completa está en [REVISION_SENIOR.md](REVISION_SENIOR.md).

## Requisitos

- Node.js 22
- Java 17 para Android
- Android SDK para compilar la APK localmente
- Un proyecto Supabase independiente para FinanzasRoma

## Comandos

```bash
npm install
npm run test
npm run build:web
npm run preview
npm run check
npm run pilot:preflight
npm run android:sync
npm run apk:debug
```

`npm run check` ejecuta las pruebas financieras, revisa las reglas básicas de seguridad, genera la PWA y verifica todos los recursos offline.

## Datos y seguridad

- La clave `anon` de Supabase es pública por diseño; la protección real está en RLS, los permisos y las funciones RPC.
- El acceso usa Supabase Auth y no existe registro público dentro de la app.
- La base nueva no guarda ni recibe `password_hash` de RservasRoma.
- El login crea un token financiero de 12 horas ligado al `auth.uid()`; en la base solo se guarda su hash.
- El `negocio_id` se obtiene de la sesión en PostgreSQL y nunca se acepta desde el payload del cliente.
- Los cambios offline se guardan en localStorage e IndexedDB y se sincronizan individualmente.

Para instalar la base nueva sigue [supabase/STANDALONE_SETUP.md](supabase/STANDALONE_SETUP.md). La base productiva original de RservasRoma no debe modificarse.

Los documentos [supabase/DEPLOYMENT.md](supabase/DEPLOYMENT.md) y [supabase/PRODUCTION_CUTOVER.md](supabase/PRODUCTION_CUTOVER.md) se conservan únicamente como referencia del diseño anterior en una base compartida.

## Cálculos históricos

Cada ingreso y gasto nuevo conserva:

- Monto y moneda original.
- Tasa usada para convertir a la moneda principal.
- Valor convertido.
- En ingresos: costo del servicio, ganancia, margen y ficha aplicada.

Modificar una tasa o ficha posteriormente no cambia esos movimientos.

## Configuración Android release

El workflow de release utiliza secretos de GitHub para la firma. Nunca guardes el archivo `.jks` ni sus contraseñas en el repositorio.
