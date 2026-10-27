# Gestión de Ópticas · Chile

ERP para ópticas en Chile, multi-sucursal, tomando como referencia funcional a GesVision
(ERP español en la nube para ópticas) y adaptado a la normativa chilena (RUT, SII, Ley 20.584, Ley 19.628).

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · PostgreSQL 16 · Prisma 6 · Tailwind 4 · Zod · Vitest

## Puesta en marcha

```bash
docker compose up -d          # o un PostgreSQL 16 propio
cp .env.example .env          # ajustar DATABASE_URL y AUTH_SECRET (openssl rand -hex 32)
npm install
npx prisma migrate deploy     # requiere extensión btree_gist (ver nota)
npm run db:seed               # datos demo
npm run dev
```

Usuarios demo (clave `optica123`): `admin@optica.cl`, `tm@optica.cl`, `tm2@optica.cl`, `recepcion@optica.cl`.

> La migración inicial ejecuta `CREATE EXTENSION btree_gist`. En PostgreSQL 13+ es una extensión
> "trusted" (la puede crear el dueño de la BD); en algunos proveedores hay que habilitarla desde el panel.

Scripts: `npm test` (unitarias), `npm run typecheck`, `npm run lint`, `npm run build`.

## Referencia: qué hace GesVision

| Área GesVision | Equivalente aquí | Fase |
|---|---|---|
| Multi-tienda / multi-empresa, entorno unificado | `Organization` → `Branch`, selector de sucursal, permisos por sucursal | **1 ✅** |
| Gestión de pacientes / clientes | Pacientes con RUT, previsión (Fonasa/Isapre), consentimiento | **1 ✅** |
| Agenda / citas | Agenda diaria por profesional, estados, anti doble reserva | **1 ✅** |
| Gestión clínica: historial, optometría, contactología (audiología) | Ficha optométrica, receta firmada | 2 |
| TPV + facturación (allí AEAT/Verifactu) | TPV + boleta/factura electrónica **SII** vía proveedor API | 3–4 |
| Pedidos de lentes, proveedores, recepción de albaranes | Órdenes de laboratorio, guías de despacho | 5 |
| Catálogos integrados, stock multi-sucursal | Inventario, traspasos entre sucursales | 6 |
| CRM, recordatorios, informe visual por email | Campañas, recordatorios WhatsApp/email, fidelización | 7 |

## Fase 1 (este entregable)

- **Multi-empresa / multi-sucursal**: toda consulta filtra por `orgId`; los pacientes se comparten entre
  sucursales de la empresa; agenda y operación son por sucursal activa (cookie validada contra los permisos).
- **Roles**: Administrador (todas las sucursales, configuración), Optómetra/TM, Vendedor, Recepción.
  Los usuarios con "atiende pacientes" son columnas en la agenda; se guarda el N° de registro SIS.
- **Pacientes**: RUT validado con módulo 11 y almacenado normalizado (`12345678-K`), único por empresa;
  soporte a extranjeros con pasaporte; búsqueda por RUT parcial, nombre, teléfono o correo;
  previsión e Isapre; consentimiento de comunicaciones (Ley 19.628).
- **Agenda**: vista diaria por profesional con bloques configurables por sucursal, clic en un hueco para
  agendar, reserva rápida sin ficha, reagendar, flujo de estados (agendada → confirmada → en atención →
  atendida / no asistió / cancelada). La doble reserva se bloquea en la app **y** en PostgreSQL
  (`EXCLUDE USING gist` sobre `tstzrange`), cubriendo carreras y profesionales que atienden en varias sucursales.
- **Horario de Chile**: todo se guarda en UTC (`timestamptz`) y se convierte con `America/Santiago`
  (cambios de horario incluidos).
- **Auditoría**: `audit_logs` registra creación/edición de pacientes, citas, sucursales y usuarios.

### Estructura

```
prisma/schema.prisma        modelo de datos (+ migración con constraint anti-traslape)
src/lib/                    lógica pura: rut.ts, time.ts, agenda.ts, labels.ts
src/server/                 server actions y consultas (auth, patients, appointments, admin)
src/app/(app)/              pantallas autenticadas (inicio, agenda, pacientes, configuración)
src/components/             UI y formularios cliente
tests/                      Vitest (RUT, zona horaria, agenda)
```

## Próximas fases (propuesta)

1. **Ficha optométrica**: anamnesis, AV sc/cc, autorrefractometría, refracción subjetiva (esf/cil/eje/add,
   DP), queratometría, PIO, biomicroscopía, contactología; receta PDF con firma y N° SIS; versión inmutable
   por atención (Ley 20.584) y acceso restringido por rol.
2. **TPV**: venta de armazón + cristales vinculada a receta, abonos/saldos (muy habitual en Chile),
   medios de pago, cierre de caja por sucursal.
3. **DTE SII**: boleta (39/41) y factura (33/34) electrónica, notas de crédito (61); integración vía
   proveedor (p.ej. OpenFactura, Bsale, LibreDTE, SimpleAPI) detrás de una interfaz `DteProvider`;
   folios/CAF por sucursal, reintentos y conciliación de estados.
4. **Laboratorio**: orden de trabajo desde la venta, envío al laboratorio, estados, avisos de "lentes listos".
5. **Stock**: catálogo (armazones, cristales, LC, accesorios), stock por sucursal, traspasos, compras.
6. **CRM**: recordatorios de control anual, renovación de LC, cumpleaños, campañas segmentadas
   respetando el consentimiento.

## Pendientes conocidos de Fase 1

- Navegación móvil (la barra lateral se oculta bajo 768 px; falta menú hamburguesa).
- Vista semanal de agenda y bloqueos de horario (vacaciones, colación).
- Recuperación de contraseña y límite de intentos de login.
- Recordatorios automáticos de cita (quedan para CRM).
