# Instrucciones para Codex - Roma Finanzas

## Proyecto

Este repositorio es la base de una PWA llamada **Roma Finanzas**, parte del ecosistema **RservasRoma**.

RservasRoma ya existe como sistema de reservas para salones de belleza, manicuristas, peluqueras, barberos, lashistas y especialistas del sector belleza en Cuba.

Roma Finanzas NO reemplaza la app de reservas. Es un modulo independiente que primero se desarrollara en este repositorio y luego se integrara con RservasRoma.

## Objetivo principal

Roma Finanzas debe ayudar a los salones de belleza en Cuba a responder esta pregunta:

**"Realmente estoy ganando dinero con lo que cobro?"**

La app debe permitir calcular:

- Costo real de cada servicio.
- Precio recomendado.
- Ganancia estimada.
- Margen de ganancia.
- Ingresos diarios.
- Gastos diarios.
- Rentabilidad por servicio.
- Manejo de monedas CUP, USD, MLC y EUR.

## Publico objetivo

La app esta pensada para negocios de belleza en Cuba:

- Manicuristas.
- Peluqueras.
- Salones de belleza.
- Barberos.
- Lashistas.
- Especialistas independientes.
- Negocios pequenos que no llevan contabilidad formal.

El lenguaje debe ser simple, directo y nada tecnico. No hablar como contador. Hablar como una herramienta practica para duenas de salones.

Ejemplos de lenguaje correcto:

- "Cuanto te quedo limpio?"
- "Lo que gastas para hacer este servicio."
- "Este servicio si te deja ganancia."
- "Estas vendiendo mucho, pero ganando poco."
- "Deja de adivinar tus precios."

Evitar lenguaje demasiado contable como:

- "Estado financiero".
- "Costos operacionales complejos".
- "Balance general".
- "Asiento contable".
- "Depreciacion", salvo que se explique de forma sencilla.

## Acceso

Roma Finanzas debe ser una herramienta exclusiva para negocios que ya usan RservasRoma.

No debe tener registro publico abierto.

Regla de acceso futura:

- Solo negocios activos de RservasRoma podran entrar.
- Debe validarse por `negocio_id`.
- Debe comprobarse si el negocio tiene `acceso_finanzas = true`.
- Estados posibles: `sin_acceso`, `trial`, `activo`, `vencido`, `bloqueado`.

Aunque al inicio se usen datos demo/locales, el codigo debe quedar preparado para conectarse luego con Supabase y validar acceso desde la tabla `negocios`.

## Stack esperado

La app debe ser:

- PWA.
- Mobile-first.
- Instalable en celular.
- Pensada para uso con internet inestable.
- Preparada para guardar datos localmente al inicio.
- Preparada para conectarse luego a Supabase.

Preferencias tecnicas:

- React o Next.js.
- Tailwind CSS.
- Diseno limpio.
- Componentes reutilizables.
- Estructura clara.
- Codigo facil de mantener.
- Evitar complejidad innecesaria en la primera version.

## Estilo visual

La marca debe sentirse como parte de RservasRoma.

Estilo:

- Moderno.
- Limpio.
- Femenino-profesional.
- Facil de usar.
- Enfocado en movil.
- Tarjetas grandes.
- Botones claros.
- Menu inferior.
- Mucho espacio visual.
- Numeros grandes y faciles de entender.

Colores sugeridos:

- Blanco.
- Negro.
- Rosa elegante de marca.
- Grises suaves.
- Verde solo para ganancias positivas.
- Rojo/naranja solo para alertas o perdidas.

No hacer una app recargada ni tecnica.

## Pantallas principales

La app debe tener estas pantallas:

1. Login
2. Dashboard
3. Servicios
4. Materiales
5. Ficha de costo
6. Ingresos
7. Gastos
8. Inventario basico
9. Reportes
10. Configuracion

## Login

Texto principal:

**Roma Finanzas**

Texto secundario:

**Calcula si tu salon realmente esta ganando.**

Boton principal:

**Entrar con mi cuenta de RservasRoma**

Mensaje si no tiene acceso:

**Tu negocio aun no tiene acceso a Roma Finanzas. Para usar esta herramienta debes tener una cuenta activa en RservasRoma.**

## Dashboard

Debe mostrar:

- Ingresos de hoy.
- Gastos de hoy.
- Ganancia estimada de hoy.
- Margen promedio.
- Servicios mas rentables.
- Servicios menos rentables.
- Gastos del mes.
- Alertas simples.

Ejemplo de alerta:

**Estas vendiendo mucho, pero tu margen promedio esta por debajo del 30%. Revisa tus precios o tus costos.**

## Servicios

Campos:

- Nombre del servicio.
- Categoria.
- Precio de venta.
- Moneda.
- Duracion en minutos.
- Estado activo/inactivo.

Ejemplo:

- Manicura semipermanente.
- Unas.
- 2500 CUP.
- 60 minutos.

## Materiales

Campos:

- Nombre del material.
- Costo de compra.
- Moneda.
- Cantidad estimada de usos.
- Costo por uso.
- Unidad.
- Stock actual opcional.

Ejemplo:

- Top coat.
- 10 USD.
- 50 usos.
- 0.20 USD por uso.

## Ficha de costo

Esta es la pantalla mas importante.

Debe permitir:

- Seleccionar un servicio.
- Anadir materiales usados.
- Anadir gastos asociados.
- Calcular costo total.
- Calcular ganancia.
- Calcular margen.
- Mostrar precio recomendado.

Formulas principales:

Costo total = suma de materiales + gastos asociados.

Ganancia = precio cobrado - costo total.

Margen = ganancia / precio cobrado x 100.

Ejemplo de resultado:

- Precio cobrado: 3000 CUP.
- Costo total: 1200 CUP.
- Ganancia: 1800 CUP.
- Margen: 60%.

Mensaje:

**Este servicio te deja aproximadamente 1800 CUP limpios.**

## Ingresos

Campos:

- Fecha.
- Servicio realizado.
- Cliente opcional.
- Precio cobrado.
- Moneda.
- Metodo de pago.
- Observacion.

## Gastos

Campos:

- Fecha.
- Categoria.
- Descripcion.
- Monto.
- Moneda.
- Tipo de gasto.

Categorias sugeridas:

- Materiales.
- Renta.
- Electricidad.
- Internet.
- Transporte.
- Publicidad.
- Comision.
- Comida.
- Otro.

## Configuracion

Debe incluir:

- Moneda principal: CUP.
- Tasa USD.
- Tasa MLC.
- Tasa EUR.
- Margen deseado.
- Nombre del salon.
- Estado de acceso financiero.

Las tasas deben ser editables manualmente porque en Cuba cambian con frecuencia.

## Supabase futuro

La app debe estar preparada para conectarse luego con Supabase.

Tabla existente esperada:

`negocios`

Campos conocidos:

- id
- nombre
- telefono
- plan
- fecha_registro
- ntfy_topic
- email
- especialidad
- slug
- color_primario
- color_secundario
- logo_url

Campos sugeridos para anadir luego:

- acceso_finanzas boolean default false
- estado_finanzas text default 'sin_acceso'
- fecha_activacion_finanzas timestamptz
- fecha_vencimiento_finanzas timestamptz

Tablas futuras de Roma Finanzas:

- servicios_financieros
- materiales
- ficha_costo
- ingresos_financieros
- gastos_financieros
- configuracion_finanzas

## MVP inicial

Primera version funcional:

1. Login visual con mensaje de acceso RservasRoma.
2. Dashboard con datos demo/locales.
3. Crear servicios.
4. Crear materiales.
5. Crear ficha de costo.
6. Calcular costo, ganancia y margen.
7. Registrar ingresos.
8. Registrar gastos.
9. Configurar monedas.
10. PWA instalable.

No construir todavia reportes avanzados ni integracion completa con reservas.

## Integracion futura con reservas

Mas adelante, cuando una cita de RservasRoma se marque como completada, debe poder enviarse a Roma Finanzas:

- negocio_id
- fecha
- cliente
- servicio
- precio cobrado
- especialista

Roma Finanzas calculara:

- costo del servicio
- ganancia estimada
- margen
- reporte diario

## Frases de marca

Usar estas ideas en la interfaz cuando sea util:

- "Deja de adivinar tus precios."
- "Empieza a conocer tus ganancias."
- "Tu talento merece numeros claros."
- "No trabajes mas para ganar menos."
- "Vender mucho no siempre significa ganar bien."
- "Calcula cuanto te queda limpio."
- "Descubre si tu servicio realmente deja ganancia."

## Prioridad de trabajo

Antes de agregar funciones nuevas, asegurar que la ficha de costo funcione perfectamente.

La app debe ser simple, util y clara para una especialista de belleza que no sabe contabilidad.
