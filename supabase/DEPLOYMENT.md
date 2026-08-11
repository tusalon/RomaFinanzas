# Despliegue seguro de Roma Finanzas

La migración `roma-finanzas-access.sql` cambia el acceso de las tablas financieras: el cliente deja de hacer CRUD anónimo y utiliza sesiones temporales mediante RPC.

El proyecto configurado fue confirmado como producción. Antes de aplicar esta guía debe completarse [PRODUCTION_CUTOVER.md](PRODUCTION_CUTOVER.md).

## Antes de ejecutar

1. Crear un respaldo completo del proyecto Supabase.
2. Probar la migración en una rama de base de datos o proyecto de ensayo.
3. Confirmar que `negocios.password_hash` existe y usa hashes compatibles con `pgcrypto.crypt`.
4. Confirmar que las tablas `servicios` y `reservas` tienen las columnas utilizadas por `load_roma_finanzas`.
5. Anotar qué negocios deben conservar `acceso_finanzas = true`. La migración conserva valores existentes y solo cambia los valores por defecto.
6. Preparar el build 1.1.0 y una ventana breve de mantenimiento. El cliente seguro necesita las RPC nuevas y el cliente anterior deja de funcionar cuando se cierran los permisos directos.

## Orden de publicación

1. Ejecutar `npm run check`.
2. Ejecutar `roma-finanzas-access.sql` en el entorno de prueba.
3. Publicar allí el cliente web/PWA 1.1.0.
4. Probar login, reanudación de sesión, cierre de sesión, lectura y escritura.
5. Ejecutar `verify-security.sql` como administrador.
6. Probar que un token de un negocio nunca puede escribir usando el identificador de otro negocio.
7. Probar también login, reservas y administración en RservasRoma: la migración limita la lectura de `negocios` a las columnas públicas conocidas.
8. En producción, activar la ventana de mantenimiento, ejecutar la migración y publicar inmediatamente el cliente 1.1.0.
9. Pedir a los usuarios que vuelvan a entrar; las sesiones antiguas sin token solo conservan acceso offline durante su vigencia y no pueden escribir en la base protegida.

## Activar un negocio

```sql
update public.negocios
set acceso_finanzas = true,
    estado_finanzas = 'activo',
    fecha_activacion_finanzas = coalesce(fecha_activacion_finanzas, now()),
    fecha_vencimiento_finanzas = null
where id = 'UUID_DEL_NEGOCIO';
```

Estados permitidos para entrar: `trial` y `activo`.

## Reversión

No se incluye un script que vuelva a abrir las tablas al rol `anon`, porque eso restauraría la vulnerabilidad. Si el cliente falla después de la migración:

1. No desactivar RLS.
2. Corregir o restaurar las RPC y volver a publicar el cliente 1.1.0; no volver al CRUD anónimo.
3. Revocar las sesiones afectadas.
4. Restaurar el respaldo únicamente si hubo una migración de datos fallida.

## Secretos de Android release

El workflow `build-android-release.yml` necesita:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

La clave de firma nunca debe guardarse en el repositorio.
