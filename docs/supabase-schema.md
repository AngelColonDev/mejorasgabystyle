# Esquema propuesto de Supabase (borrador para revisión)

> **Actualización:** el esquema final, listo para ejecutar, está en `supabase/schema.sql`, y los pasos para conectar están en `docs/supabase-setup.md`. Este documento queda como explicación del diseño.

Este documento traduce el estado actual guardado en `localStorage` (archivo `shared-data.js`, clave `gs_crm`, todo en un solo objeto JSON) a tablas de Postgres/Supabase. **No conecta nada todavía** — es el mapa que se revisa antes de crear el proyecto en Supabase. Cuando tengas la URL del proyecto y la `anon key`, el siguiente paso es crear estas tablas (vía SQL Editor o migraciones) y luego reemplazar las llamadas a `window.GabyData.getState()/updateState()` por llamadas a `supabase-js`.

## Por qué cambia la forma de guardar los datos

Hoy todo vive en un solo blob de JSON en el navegador del dispositivo: no hay respaldo real, un cliente no puede ver su cuenta desde otro teléfono, y las "contraseñas" de los clientes se guardan en texto plano dentro de ese JSON. Supabase separa esto en:

- **Supabase Auth** — maneja el login/registro real (contraseñas con hash, no en texto plano), y emite un token de sesión (JWT) por dispositivo.
- **Base de datos Postgres** — las tablas de abajo, con **Row Level Security (RLS)** para que cada quien solo pueda leer/escribir lo que le corresponde.

## Autenticación

En vez del arreglo `clients` actual (que incluye el campo `password`), los clientes se registran con **Supabase Auth** (`auth.users`, tabla interna de Supabase — no se toca directamente). El resto de su información va en una tabla `profiles` enlazada por el mismo `id`:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  birth_date date,
  haircut text,
  beard text,
  preferred_barber text references barbers(id),
  photo_url text,
  registered_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "El cliente ve y edita su propio perfil"
  on profiles for select using (auth.uid() = id);
create policy "El cliente actualiza su propio perfil"
  on profiles for update using (auth.uid() = id);
create policy "El cliente crea su propio perfil al registrarse"
  on profiles for insert with check (auth.uid() = id);
```

Los barberos/admin (hoy hardcodeados en `staffCredentials` dentro de `index.html`) también deberían pasar a ser usuarios de Supabase Auth, con una tabla aparte para marcar el rol:

```sql
create table staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  barber_id text references barbers(id),
  is_admin boolean not null default false
);
```
Las políticas de las tablas de abajo usan `staff_roles` para dar acceso ampliado (ej. "un barbero ve todas las citas asignadas a su `barber_id`, el admin ve todas").

## Tablas principales (reflejan `shared-data.js`)

| Tabla | Columnas clave | Notas |
|---|---|---|
| `barbers` | `id text pk, name, alias, email, phone, specialty text[], bio, avatar_url, is_admin bool, active bool, years_experience int, vip_clients int, schedule, socials jsonb` | Reemplaza el arreglo `barbers`. `certifications` y `before_after` como tablas hijas (`barber_certifications`, `barber_before_after`) o columnas `jsonb` si no necesitan consultarse por separado. |
| `services` | `id text pk, name, price text, duration text, description text, active bool, requests int` | Igual forma que hoy. |
| `products` | `id text pk, name, desc, price text, stock int, sold int, image_url, active bool` | |
| `appointments` | `code text pk, client_id uuid references profiles(id), client_name text, service text, barber_id text references barbers(id), status text, date_time timestamptz, vip_details jsonb, canceled_by_client bool, canceled_at timestamptz, created_at timestamptz default now()` | `vip_details` guarda `{town, address, guests, serviceDetail, notes}` tal cual hoy. RLS: el cliente ve solo sus propias citas (`client_id = auth.uid()`); el barbero ve las suyas (`barber_id` coincide con su fila en `staff_roles`); el admin ve todas. |
| `reviews` | `id uuid pk, client_name text, barber text, rating int, text text, status text, created_at timestamptz` | |
| `news` | `id uuid pk, author_id text references barbers(id), title, body, image_url, likes int, comments int, created_at timestamptz` | |
| `providers` | `id uuid pk, name, category, contact, phone, status` | |
| `gallery` | `id uuid pk, title, barber_id text references barbers(id), image_url` | |
| `activity_log` | `id uuid pk, type text, text text, created_at timestamptz` | Reemplaza `activity`. |
| `barber_applications` | Campos del formulario de `barber-application.html` (nombre, contacto, carta, portafolio, currículum) | |
| `shop_settings` | Fila única: `shop_mode, closure_notice, default_language, theme, notifications jsonb, permissions jsonb, updated_at` | Reemplaza `settings`. El tema (`dark`/`light`/`system`) puede seguir guardándose aquí por cliente (columna en `profiles`) en vez de global, si cada quien debe tener su propia preferencia entre dispositivos — a decidir. |

## Seguridad de la cuenta (lo que pediste que explicara)

Hoy `security.html` tiene 4 filas sin funcionalidad (ningún `onclick`). Con Supabase Auth, cada una se conecta así:

- **Cambiar contraseña** → `supabase.auth.updateUser({ password: nuevaContrasena })`, con la sesión activa del cliente. Supabase se encarga del hash, nunca viaja ni se guarda en texto plano.
- **Cerrar sesiones en otros dispositivos** → `supabase.auth.signOut({ scope: 'others' })` invalida los tokens de refresco de todos los demás dispositivos, dejando la sesión actual activa. (`scope: 'global'` cerraría todas, incluida la actual, si se prefiere ese comportamiento).
- **Autenticación en dos pasos** → Supabase Auth trae MFA nativo (TOTP, tipo Google Authenticator) vía `supabase.auth.mfa.enroll()`. Coincide con el texto que ya dice "Disponible en una futura versión" — se puede dejar así hasta que se conecte el resto.
- **Eliminar cuenta** → esto **no se puede hacer solo desde el navegador**. Borrar un usuario de Auth requiere la `service_role key` (la llave maestra), y esa llave **nunca debe estar en código de cliente** (JavaScript que corre en el navegador) porque cualquiera podría leerla e impersonar a cualquier usuario. La forma correcta es una **Supabase Edge Function** (una función pequeña que corre en el servidor de Supabase, no en el navegador) que reciba la solicitud del cliente ya autenticado y ahí sí use `supabase.auth.admin.deleteUser(id)`. Esto se escribe y despliega aparte, cuando lleguemos a esa parte.

**Regla de oro:** la `anon key` (o `publishable key`) es segura para pegar en el HTML/JS del sitio — está diseñada para eso, y las políticas de RLS son las que realmente protegen los datos. La `service_role key` nunca va en ningún archivo de este repositorio.

## Lo que falta después de crear las tablas

Todo el código actual (`index.html`, `profile.html`, `booking.html`, `staff/shared-admin.js`, etc.) llama a `window.GabyData.getState()` / `updateState(mutator)` de forma **síncrona** — son ~15 archivos que asumen que los datos ya están ahí al leer. Supabase responde con promesas (`await supabase.from('appointments').select()`), así que ese es el refactor grande que viene después de tener las credenciales: convertir esas funciones a `async/await` y actualizar cada punto donde se leen/escriben datos. Se puede hacer por partes (por ejemplo, primero perfiles/autenticación, después citas, después el resto) en vez de todo de una vez.
