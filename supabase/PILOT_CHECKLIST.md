# Checklist del piloto con datos reales

Proyecto configurado actualmente: `zorhclhvykikaachfrmp` — **PRODUCCIÓN**
Plan confirmado: **Free**, sin respaldo automático ni PITR.

## Estado comprobado el 4 de agosto de 2026

- Las tablas compartidas `negocios`, `servicios` y `reservas` tienen las columnas que necesita Roma Finanzas.
- Las cinco RPC seguras todavía no están publicadas.
- `password_hash` todavía aparece en el contrato accesible con la clave `anon`.
- La app bloquea el login nuevo hasta que se aplique la migración segura.

Este estado se obtuvo con `npm run pilot:preflight`. El preflight consulta únicamente contratos y llama las RPC con valores vacíos que se rechazan antes de procesar datos.

## Antes de ejecutar SQL

- [x] Confirmado: el proyecto configurado es producción.
- [ ] Crear y comprobar un respaldo reciente.
- [ ] Anotar los negocios que actualmente tienen acceso financiero.
- [ ] Confirmar que RservasRoma usa únicamente las columnas públicas concedidas en la migración.
- [ ] Preparar el build web 1.1.0 con `npm run check`.
- [ ] Avisar una ventana breve de mantenimiento si es producción.

En producción debe seguirse primero `PRODUCTION_CUTOVER.md`.

## Prueba en entorno de ensayo

1. Ejecutar `roma-finanzas-access.sql` desde el SQL Editor de Supabase.
2. Ejecutar `verify-security.sql` como administrador.
3. Ejecutar otra vez `npm run pilot:preflight`.
4. Confirmar que las cinco RPC aparecen como instaladas.
5. Confirmar que `password_hash` ya no es visible para `anon`.
6. Probar que login, reservas y administración continúan funcionando en RservasRoma.
7. Activar un solo negocio piloto con el SQL documentado en `DEPLOYMENT.md`.

## Datos mínimos del negocio piloto

- Tasas actuales de USD, MLC y EUR.
- Cinco materiales con costo, rendimiento y stock real.
- Tres servicios con precio y duración real.
- Una ficha de costo por cada servicio.
- Ingresos y gastos de al menos siete días.

## Validaciones del piloto

- [ ] Cinco cálculos manuales coinciden con la app.
- [ ] Cambiar una tasa no modifica movimientos anteriores.
- [ ] Una reserva completada se importa una sola vez.
- [ ] Registrar un servicio descuenta el inventario indicado en su ficha.
- [ ] El modo avión conserva cambios y sincroniza al recuperar internet.
- [ ] Un conflicto entre dos dispositivos no sobrescribe datos en silencio.
- [ ] El reporte mensual distingue ganancia de flujo de caja.

## Condición para producción

No publicar la versión con datos reales mientras el preflight siga mostrando cualquiera de estos dos fallos:

- RPC seguras ausentes.
- `password_hash` visible para la clave pública.
