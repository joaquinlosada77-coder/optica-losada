# Publicar el sistema (Vercel + Neon)

Tiempo estimado: 20 minutos. No necesitas instalar nada en tu computador.

## Antes de empezar: planes y costos

- **Vercel**: el plan gratuito (Hobby) es solo para uso personal, no comercial. Para la óptica corresponde
  el plan **Pro** (20 USD/mes por usuario de Vercel; solo tú necesitas usuario, tu equipo entra al sistema con sus propias cuentas).
- **Neon** (base de datos): se puede partir con el plan gratuito para probar. Para operar con datos reales
  de pacientes usa un plan pagado (cobro por uso), que incluye respaldos con recuperación a un punto en el tiempo.
- Los datos quedarán en São Paulo (Brasil), la región más cercana. Son datos de salud: confirma con tu
  asesor el cumplimiento de la Ley 19.628 y la nueva Ley 21.719 de protección de datos.

## Paso 1 · Crear el proyecto en Vercel

1. Entra a <https://vercel.com/signup> y elige **Continue with GitHub** (usa la misma cuenta del repositorio).
2. Pulsa **Add New… → Project** y elige el repositorio **optica-losada** → **Import**.
3. **Todavía no pulses Deploy.** Abre **Environment Variables** y agrega:

   | Nombre | Valor |
   |---|---|
   | `AUTH_SECRET` | Una clave aleatoria de 64 caracteres. Puedes generarla en <https://generate-secret.vercel.app/32> |
   | `SETUP_TOKEN` | Una frase larga que solo tú conozcas (la usarás una vez en el paso 4) |

4. Pulsa **Deploy**. Este primer intento **fallará** porque aún no hay base de datos: es normal.

## Paso 2 · Crear la base de datos (Neon) desde Vercel

1. En el proyecto, abre la pestaña **Storage → Create Database → Neon (Serverless Postgres)**.
2. Región: **South America (São Paulo)**. Acepta crear la cuenta de Neon cuando lo pida.
3. Conéctala al proyecto marcando **todos los entornos** (Production, Preview, Development).
   Vercel agrega solo las variables `DATABASE_URL` y `DATABASE_URL_UNPOOLED`: no tienes que copiar nada.

## Paso 3 · Desplegar de nuevo

1. Pestaña **Deployments** → en el último despliegue, menú **⋯ → Redeploy**.
2. Al terminar (2–3 minutos) verás **Ready**. Durante el despliegue se crean automáticamente las tablas.

## Paso 4 · Primera configuración

1. Abre la dirección de tu proyecto (algo como `https://optica-losada.vercel.app`).
2. Te llevará a **Primera configuración**:
   - Escribe el `SETUP_TOKEN` del paso 1.
   - Datos de la empresa (nombre, RUT, razón social).
   - Tu usuario administrador con una contraseña de al menos 10 caracteres.
   - Deja marcada la casilla para crear tus 12 sucursales de Gesvision.
3. Al terminar entras directo a **Importar**. Esta pantalla de configuración queda cerrada para siempre.

## Paso 5 · Importar tus datos de Gesvision

1. Desde un **computador** (no la tablet), en Gesvision descarga el **Listado de graduaciones** completo.
2. En el sistema: **Configuración → Importar** → elige el archivo → **Revisar archivo**.
   El archivo se lee en tu navegador; al servidor solo viajan los datos ya limpios.
3. Revisa el resumen y pulsa **Confirmar e importar**. Si algo falla a mitad, vuelve a intentarlo: no se duplica nada.

## Paso 6 · Dejarlo listo para tu equipo

- **Sucursales**: revisa horarios y bloques de agenda de cada una.
- **Usuarios**: crea a tus vendedoras, tecnólogos y recepción, cada uno con sus sucursales.
- **Cristales**: carga tus precios reales en Configuración → Cristales.
- **Productos**: armazones, lentes de contacto, líquidos y servicios.
- **Dominio propio** (opcional): en Vercel → Settings → Domains puedes usar, por ejemplo, `sistema.opticaslosada.cl`.

## Si algo sale mal

- **El despliegue falla en "prisma migrate deploy"**: revisa que la base Neon esté conectada a todos los entornos (Paso 2) y vuelve a desplegar.
- **"Falta la variable SETUP_TOKEN"**: agrégala en Settings → Environment Variables y vuelve a desplegar.
- **Usuario bloqueado** tras 5 intentos fallidos: espera 15 minutos o, como administrador, asígnale una contraseña nueva en Usuarios.
