# Corte seguro de Roma Finanzas en producción

Proyecto confirmado como producción: `zorhclhvykikaachfrmp`  
Fecha de preparación: 4 de agosto de 2026

Plan confirmado: **Free**. Este plan no incluye respaldos automáticos, PITR ni descarga de copias desde el panel. Antes del corte debe crearse una copia lógica manual fuera de Supabase.

## Riesgo que obliga a coordinar el corte

El preflight confirmó que `password_hash` puede consultarse actualmente con la clave pública `anon`. También confirmó que las RPC seguras todavía no existen. La versión anterior dependía de leer ese hash en el navegador; por eso no se debe revocar el permiso antes de que la migración y el cliente 1.1.0 estén listos para publicarse juntos.

Hasta completar el corte, los hashes deben considerarse potencialmente comprometidos. Cerrar el permiso evita nuevas lecturas, pero no invalida copias que alguien pudiera haber obtenido anteriormente.

## Puertas obligatorias antes de tocar producción

- [ ] Respaldo reciente creado y método de restauración comprobado.
- [ ] Resultado de `production-precheck.sql` guardado fuera del SQL Editor.
- [ ] Build 1.1.0 generado con `npm run check`.
- [ ] Artefacto web listo para publicarse inmediatamente después del SQL.
- [ ] Al menos una cuenta piloto activa disponible para validar el login.
- [ ] Persona responsable de probar RservasRoma durante la ventana.
- [ ] Plan de comunicación para exigir cambio de contraseña a los negocios.

Si falta cualquiera de estas puertas, el corte se pospone.

## Respaldo manual para el plan Free

1. Instalar PostgreSQL Client Tools para disponer de `pg_dump` y `pg_restore`.
2. En Supabase, abrir **Connect** y copiar la conexión **Session Pooler**.
3. Sustituir la contraseña en la conexión y codificar caracteres especiales si fuera necesario.
4. Guardar la conexión temporalmente en `ROMA_DATABASE_URL`; no pegarla en chats ni archivos del repositorio.
5. Ejecutar `scripts/backup-production.ps1` indicando una carpeta privada fuera de Git.
6. Conservar la copia `.dump`, el esquema `.sql`, el catálogo y sus hashes SHA-256.
7. Duplicar esos archivos en otra ubicación protegida.

Ejemplo en PowerShell:

```powershell
$env:ROMA_DATABASE_URL = 'postgresql://postgres.PROJECT_REF:CONTRASENA@POOLER:5432/postgres?sslmode=require'
powershell -ExecutionPolicy Bypass -File scripts/backup-production.ps1 -OutputDirectory 'D:\Backups\RomaFinanzas'
Remove-Item Env:ROMA_DATABASE_URL
```

El script nunca imprime la conexión y limita la copia al esquema `public`, que es el afectado por esta migración. La prueba definitiva sigue siendo restaurar la copia en otra base antes del corte.

## Orden del corte

1. Abrir una ventana breve de mantenimiento.
2. Ejecutar `production-precheck.sql` y guardar sus resultados.
3. Ejecutar `roma-finanzas-access.sql` completo desde el SQL Editor. Está envuelto en una transacción: un error debe revertir el lote.
4. Publicar inmediatamente el build web/PWA 1.1.0.
5. Ejecutar `verify-security.sql` como administrador.
6. Ejecutar localmente `npm run pilot:preflight`.
7. No continuar si el preflight no confirma las cinco RPC o si `password_hash` sigue visible.
8. Entrar con la cuenta piloto, configurar tasas y registrar una operación controlada.
9. Probar login, reservas y administración en RservasRoma.
10. Cerrar la ventana únicamente cuando ambas aplicaciones funcionen.

## Validaciones posteriores inmediatas

- `anon_can_read_password_hash = false`.
- `authenticated_can_read_password_hash = false`.
- Cero permisos directos en las tablas `roma_finanzas_*` para `anon` y `authenticated`.
- Las cinco RPC tienen permiso de ejecución.
- Un token inválido no devuelve datos.
- Un negocio no puede consultar o escribir datos de otro.
- Las reservas completadas no se duplican al sincronizar.

## Respuesta por la exposición previa de hashes

1. Revisar los logs de API disponibles en Supabase para buscar consultas a `negocios.password_hash`.
2. Forzar la rotación de contraseña de todos los negocios, comenzando por administradores.
3. No enviar contraseñas permanentes por canales inseguros.
4. Si una contraseña se reutiliza en otro sistema, indicar que también debe cambiarse allí.
5. Mantener la sesión RPC en 12 horas y revocar sesiones ante cualquier incidente.

## Reversión segura

- Si la migración falla dentro de la transacción, revisar el error antes de reintentar.
- Si el cliente falla después de cerrar permisos, corregir o restaurar las RPC y volver a publicar 1.1.0.
- No volver a conceder lectura de `password_hash` y no desactivar RLS para recuperar el servicio.
- Restaurar el respaldo solo si se confirma una migración de datos incorrecta; no usar la restauración como forma de reabrir el acceso inseguro.
