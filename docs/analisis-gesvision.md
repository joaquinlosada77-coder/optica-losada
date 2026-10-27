# Análisis de GesVision (competencia)

Fuente: páginas públicas de gesvision.com indexadas por buscadores (octubre 2026). El sitio no fue
accesible directamente desde el entorno de desarrollo; parte de las páginas indexadas tienen 2–4 años,
así que precios y detalles deben confirmarse con una demo.

## Resumen

ERP en la nube para ópticas (España), presente en 12 países y con más de 1.000 ópticas según el fabricante.
**Opera en Chile** (gesvision.com/es-cl) con DTE integrado al SII: es competidor directo.

## Módulos y funciones relevantes

### Pacientes / ficha clínica
- Ficha única con antecedentes, optometría, contactología, audiología y seguimiento.
- Optometría: refracción, presión intraocular, anatomía externa, segmento posterior.
- Adjuntos: retinografías y topografías.
- Contactología: datos iniciales, **lentes de prueba** y **lentes definitivos**.
- Historial de graduaciones; datos clínicos enlazados a las ventas.
- Filtra la selección de lentes y LC según los datos clínicos del paciente.
- Informe visual por email con plantillas personalizadas.

### Ventas / TPV / caja
- Venta iniciada desde **presupuesto o proforma**, convertible en venta con un clic.
- Seguimiento de presupuestos no cerrados.
- Control de pagos, vencimientos (saldos), **cierres de caja**, retiros de efectivo a banco.
- Desde la venta: stock de todas las tiendas y solicitud automática de traspaso.
- Factura a nombre de una empresa asociada a un empleado (convenios).

### Facturación Chile (DTE)
- Boletas (39), facturas afectas (33) y exentas, notas de crédito (61) y débito (56).
- Folios **CAF gestionados desde el panel**.
- Libro electrónico y reportes fiscales.
- Representación impresa de la boleta en venta presencial.

### Laboratorio / pedidos
- Estado del encargo: en fabricación en laboratorio → en tienda → entregado.
- **Fecha promesa** de entrega, incidencias de control de calidad, deudas pendientes.
- Recepción de pedidos a proveedor en un paso; registro automático de guías de lentes y LC.

### Inventario
- Stock en tiempo real por sucursal, kardex, alertas.
- Traspasos masivos entre sucursales, directos o con validación del destino.
- Catálogos de proveedores integrados (monturas, lentes, LC) con creación automática de referencias.
- Reposición automática con proveedores.

### CRM y agenda
- Agenda de citas y recordatorios automáticos (citas, revisiones, seguimiento).
- Segmentación, campañas automatizadas, SMS individualizados, análisis de campañas.
- Envío de documentos por email (plan Profesional).

### Analítica
- KPI, informes a medida, comparativas entre años, BI (plan Profesional).

## Precios publicados (España, pueden estar desactualizados)

| Plan | Precio | Incluye |
|---|---|---|
| Esencial | 50 €/mes (1 tienda, 1 usuario) o 600 €/año | Facturación, pacientes, analítica básica |
| Profesional | 75 €/mes por tienda, usuarios ilimitados por local | + traspasos, informes a medida, BI, email |
| Empresa | A medida | Cadenas, descuento por volumen |

## Implicancias para nuestro producto

1. **Ficha optométrica (Fase 2)**: incluir lentes de prueba vs. definitivos en contactología,
   adjuntos de imágenes, PIO, y que la receta quede enlazada a la venta.
2. **TPV (Fase 3)**: presupuestos convertibles en venta, abonos y saldos, cierre de caja por
   sucursal, convenios empresa-empleado (muy común en Chile).
3. **DTE (Fase 4)**: igualar como mínimo 33/34/39/41/56/61, gestión de CAF y libros.
4. **Laboratorio (Fase 5)**: fecha promesa y control de calidad desde el día uno.
5. **Diferenciadores posibles en Chile**: recordatorios por WhatsApp, convenios con empresas y
   cajas de compensación, Fonasa/Isapre en la ficha, precio en CLP sin cobro por usuario.

## Configuración real de la cuenta (relevada desde Gesvision, octubre 2026)

Relevado en modo solo lectura, sin datos de pacientes.

### Venta
- Boleta con cliente, fecha, **fecha de entrega estimada** (obligatoria), vendedor (agente), tarifa de descuentos, motivo de visita.
- Líneas con código, descripción, PVP, % descuento. Cristales = productos de categoría LENTES.
- Botón **Crear OT** (orden de trabajo) y **Óptica → Asociar** graduación (optometría o contactología).
- Formas de pago: efectivo, tarjeta crédito, débito, transferencia, cheque, crédito institución, garantía, convenio salud visual.
- Estados personalizados del trabajo: **Laboratorio → Montaje → Disponible → Entregado**.

### Catálogo de cristales
- Gamas: MON BASICO, MON DIGITAL, PROG BASICO, PROG INTERMEDIO, PROG OCUPACIONAL, PROG PERSONALIZADO, BIFOCAL (+ variantes "tarifa").
- Tratamientos: AR, AR TOP, AR TOP P, AR TOP P+, DuraVision, BLUE PROTECT, HC, DEG, POLAR y combinaciones.
- Índices: 1.50, 1.52, 1.53, 1.56, 1.59, 1.60, 1.67, 1.70, 1.71, 1.74, 1.80, 1.90.
- Precio por variante: compra sin IVA, margen %, venta sin IVA, PVP.
- Proveedores: Luxottica, Rodenstock Chile, Italoptic, propio.

### Ficha clínica
- Cliente: RUT, móvil/fijo, email (o "sin email"), tipo (particular/empresa/pasaporte), dirección con comuna, consentimiento, publicidad, SMS.
- Optometría: refracción final OD/OI/intermedia (esfera, cilindro, eje, adición, DNP lejos/cerca, AV sc/cc), prisma, próxima revisión, queratometría, PIO, biomicroscopía, fondo de ojo, test binoculares, acomodación.
- Contactología: adaptaciones con frecuencia de reemplazo y tipo; lente inicial/prueba/definitivo por ojo (radios, diámetros, material, hidratación).

### Laboratorio
- Encargos con armazón, tipo de montaje, archivo OMA, graduación, alerta si falta DNP.
- Módulo de fábrica (etapas de producción) desactivado.

### Exportación (para migrar)
- Clientes, boletas, modelos, pedidos y proveedores: exportables a Excel desde cada listado (columnas según "Plantillas").
- **Graduaciones: no exportables** → pedir a soporte de Gesvision o vía API.
