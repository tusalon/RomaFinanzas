# Mismo slug y contrasena de RservasRoma

Objetivo: conservar FinanzasRoma como base independiente, pero usar una sola
identidad. RservasRoma valida el `slug` y la contrasena; FinanzasRoma conserva
solo el identificador externo y una sesion opaca de 12 horas.

No se copian `password_hash`, contrasenas ni reservas al proyecto nuevo.

## Orden seguro de instalacion

1. Mantener la app publicada en `standalone-auth` mientras se prepara el puente.
2. En RservasRoma, ejecutar `rservasroma-federated-auth-provider.sql`.
3. En FinanzasRoma, ejecutar `standalone-04-federated-rservasroma.sql`.
4. Desplegar la funcion Edge `rservasroma-login` en FinanzasRoma.
   Debe conservar `verify_jwt = false`: es el endpoint que crea la sesion y,
   por definicion, el usuario aun no posee un JWT.
5. Guardar en los secretos de esa funcion:
   - `RSERVASROMA_SUPABASE_URL`: URL del proyecto RservasRoma.
   - `RSERVASROMA_SUPABASE_ANON_KEY`: clave publica del proyecto RservasRoma.
   - `ROMA_ALLOWED_ORIGINS`: origen web de Roma Finanzas; se pueden separar
     varios con coma. Incluir `http://127.0.0.1:4173` solo durante las pruebas.
     Para la APK, incluir tambien el origen que reporte Capacitor, normalmente
     `http://localhost`.
   El script `scripts/deploy-federated-function.ps1` automatiza los pasos 4 y
   5 y borra el archivo temporal de secretos al terminar.
6. Ejecutar los bloques de `verify-federated-auth.sql` en sus proyectos.
7. Cambiar localmente `ROMA_BACKEND_MODE=federated-rservasroma`, generar el
   build y probar primero con un unico negocio.
8. Confirmar que el primer login enlazo la fila existente por slug y que sus
   servicios, materiales, fichas, ingresos y gastos siguen visibles.
9. Publicar el cliente federado solo despues de esa prueba.

## Como se conserva la cuenta existente

El primer acceso busca primero `external_negocio_id`. Si aun no existe, busca
una fila de FinanzasRoma con el mismo `slug` y sin enlace externo. Si la
encuentra, agrega el ID de RservasRoma y conserva el mismo `id` local; por eso
las tablas financieras ya relacionadas no cambian.

Si el slug ya pertenece a otro ID externo, el acceso se bloquea para evitar
mezclar datos de dos negocios.

## Compatibilidad temporal de produccion

Las apps actuales de RservasRoma todavia leen `password_hash` en el navegador.
La migracion del proveedor no revoca ese permiso para no romperlas. El cierre
de ese acceso debe hacerse en un corte posterior, despues de cambiar el login
de todas las apps de reservas al RPC seguro.

## Reversion

Si falla la prueba, volver a `ROMA_BACKEND_MODE=standalone-auth` y republicar
el build anterior. El puente no borra datos financieros ni usuarios de
Supabase Auth, de modo que el acceso piloto anterior sigue disponible.
