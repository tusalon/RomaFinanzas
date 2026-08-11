# Revisión senior y plan de acción — Roma Finanzas

Fecha de revisión: 4 de agosto de 2026  
Versión preparada: 1.1.0

## Diagnóstico ejecutivo

Roma Finanzas tiene una propuesta de producto fuerte: responde con lenguaje sencillo a una pregunta concreta del negocio, y la ficha de costo ocupa correctamente el centro de la experiencia. La base visual móvil y la integración con RservasRoma también son buenas decisiones.

La revisión inicial encontró cuatro riesgos que impedían usar datos reales con confianza: acceso directo a datos sensibles desde el navegador, cálculos que podían cambiar al editar tasas, diferencias entre flujo de caja y ganancia, y sincronización offline basada en copias completas. La versión 1.1.0 corrige esos puntos y deja una ruta de despliegue controlada.

## Fortalezas actuales

- Producto enfocado en salones de belleza cubanos y lenguaje no contable.
- Ficha de costo clara, con materiales, gastos, tiempo, gastos fijos y precio recomendado.
- Trabajo con CUP, USD, MLC y EUR sin asumir tasas inventadas.
- Experiencia mobile-first, PWA instalable y paquete Android con Capacitor.
- Integración prevista con servicios y reservas completadas de RservasRoma.
- Datos separados por negocio y almacenamiento offline por `negocio_id`.
- Dashboard y reporte mensual orientados a decisiones, no a contabilidad formal.

## Problemas encontrados y tratamiento

| Prioridad | Hallazgo | Estado en 1.1.0 |
|---|---|---|
| Crítica | El navegador podía participar en la validación de contraseña y el acceso directo a tablas era demasiado amplio. | Corregido con login RPC, token temporal, RLS forzado, permisos mínimos y sin `password_hash` en el cliente. |
| Crítica | El cliente podía enviar tasa, costo y ganancia calculados. | Corregido: Supabase deriva tasas desde la configuración y el costo del ingreso desde la ficha aplicable. |
| Alta | Cambiar tasas alteraba movimientos anteriores. | Corregido con fotos financieras históricas en ingresos, gastos y materiales. |
| Alta | El dashboard mezclaba ganancia con dinero disponible. | Corregido: muestra ganancia estimada y flujo de caja por separado. |
| Alta | La sincronización completa podía revivir datos borrados o sobrescribir cambios. | Corregido con cola por operación, borrado lógico, versiones y conflictos optimistas. |
| Alta | Existía un gasto mensual de RservasRoma inventado. | Eliminado; solo se consideran gastos registrados por el negocio. |
| Media | Las fechas dependían de UTC. | Corregido usando la fecha de Cuba. |
| Media | Inventario sin relación con servicios realizados. | Añadido consumo automático desde la ficha, movimientos y alertas de stock bajo. |
| Media | Faltaba una vista de reporte. | Añadido reporte mensual sencillo con exportación CSV. |
| Media | Dependencias de desarrollo se ejecutaban en el navegador y la PWA podía cachear API. | Corregido con build de producción, CSP configurable y exclusión del origen Supabase del caché. |

## Plan de acción

### Etapa 1 — Base confiable: terminada

- Seguridad de acceso y separación por negocio.
- Cálculos históricos y tasas obligatorias.
- Ficha de costo como fuente de costo y ganancia.
- Dashboard, reportes e inventario básico.
- Offline por operaciones y detección de conflictos.
- Build web/PWA moderno y preparación Android.

### Etapa 2 — Validación con datos reales: siguiente paso

1. Crear respaldo de Supabase y un entorno de prueba.
2. Aplicar `supabase/roma-finanzas-access.sql` en prueba.
3. Activar uno o dos negocios piloto.
4. Cargar tasas, materiales, fichas, ingresos y gastos reales de al menos una semana.
5. Comparar manualmente cinco servicios contra sus fichas de costo.
6. Probar dos teléfonos, trabajo sin conexión y resolución de un conflicto.
7. Ejecutar `supabase/verify-security.sql` y el checklist de despliegue.

### Etapa 3 — Salida controlada: pendiente de infraestructura

- Publicar PWA 1.1.0 junto con la migración durante una ventana breve.
- Generar APK/AAB firmado mediante GitHub Actions o un equipo con Android SDK.
- Probar instalación, actualización, modo avión y recuperación de sesión en Android real.
- Añadir pruebas E2E con un negocio de prueba autenticado.

### Etapa 4 — Mejoras posteriores al piloto

- Convertir ingreso + consumo de inventario en una única operación atómica del servidor.
- Añadir monitoreo de errores y métricas de uso sin exponer datos financieros.
- Incorporar cierres diarios y comparaciones mensuales solo si el piloto demuestra que se entienden bien.
- Evaluar roles por especialista y permisos de solo lectura.

## Criterios para considerar la versión lista para producción

- Ningún usuario puede leer o modificar datos de otro negocio.
- Ningún hash de contraseña llega al navegador.
- Cinco cálculos manuales coinciden con la app dentro del redondeo esperado.
- Cambiar una tasa no cambia ingresos o gastos ya registrados.
- Una operación offline se sincroniza una sola vez y un conflicto no sobrescribe datos en silencio.
- La PWA se instala y abre sin internet después de una primera carga.
- El APK/AAB firmado compila y funciona en al menos dos versiones de Android.

## Estado del entorno configurado

El preflight del 4 de agosto de 2026 confirmó que el contrato de `negocios`, `servicios` y `reservas` es compatible. También confirmó que las RPC seguras aún no están instaladas y que `password_hash` sigue visible para la clave `anon` en el Supabase configurado. La corrección está preparada en la migración local, pero todavía no se ha aplicado al proyecto remoto porque primero debe confirmarse si es ensayo o producción y disponer de respaldo.
