# EXPLO · LIQUIDMEDIA

Web app de gestión de recursos técnicos: equipos de cámara, operadores, flota de vehículos (con tarjetas SOLRED) e inventario, para las producciones **Antena 3** y **La Sexta** en Madrid, País Vasco, Galicia y Valencia.

## Tecnología

- **Next.js 15** (React) + Tailwind CSS · publicado en **Vercel**
- **Supabase** (PostgreSQL, usuarios, archivos) · proyecto `EXPLO` (eu-west-1)
- Esquema de base de datos en `supabase/migrations/`

## Estructura

```
src/app/login, recuperar      Acceso y recuperación de contraseña
src/app/auth/*                Destino de los enlaces de los correos
src/app/(app)/page.tsx        Panel general por sede y producción
src/app/(app)/admin/usuarios  Gestión de usuarios (solo administrador)
src/app/(app)/cuenta/password Cambio de contraseña
src/lib/supabase/*            Conexión con Supabase
supabase/migrations/*.sql     Definición de la base de datos
```

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Dónde se obtiene |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ajfxobjgbmsjllbkhflo.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (**secreta**) |
| `NEXT_PUBLIC_SITE_URL` | La dirección de la app en Vercel, p. ej. `https://explo.vercel.app` |

La clave `service_role` solo va en Vercel. Nunca en el código ni en GitHub.

## Usuarios y contraseñas

- El administrador invita por correo desde **Usuarios**. El invitado recibe un enlace y crea su contraseña.
- Las contraseñas se guardan cifradas: nadie puede leerlas. El administrador puede enviar un enlace de cambio, fijar una contraseña temporal o desactivar el acceso.
- `clopezf@mediapro.tv` es administrador automáticamente.

## Desarrollo local (opcional)

```bash
npm install
cp .env.example .env.local   # y rellenar las claves
npm run dev
```
