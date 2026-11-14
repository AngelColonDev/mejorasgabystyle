# Conectar el sitio con Supabase: paso a paso

Todo el código ya está preparado. Mientras `supabase-config.js` esté vacío, el sitio funciona como hoy (datos en el navegador). Cuando llenes la URL y la llave, el sitio empieza a usar Supabase **sin cambiar ninguna página**.

## Qué se preparó

| Archivo | Para qué sirve |
|---|---|
| `supabase/schema.sql` | Crea todas las tablas, la seguridad por filas (RLS), el trigger que crea el perfil del cliente al registrarse, y los datos iniciales (barberos, servicios, productos y la noticia de apertura). Se puede volver a ejecutar sin romper nada. |
| `supabase-config.js` | Aquí van la **URL** y la **anon key**. Es lo único que hay que llenar. |
| `supabase-sync.js` | El puente: descarga lo que cada usuario puede ver, sube cada cambio guardado y maneja registro, login, cierre de sesión, recuperar contraseña y eliminar cuenta con Supabase Auth. |
| `supabase/functions/delete-account/index.ts` | Edge Function para eliminar una cuenta (necesita la service_role key, por eso corre en el servidor y no en el sitio). |

Quién puede ver y hacer qué (lo controla la RLS, no el navegador):

- **Visitante:** ve barberos, servicios, productos, noticias, galería y reseñas aprobadas. Puede enviar una solicitud de empleo.
- **Cliente:** además ve y edita su perfil, crea citas (siempre como PENDIENTE), ve sus citas y solo puede **cancelarlas** (un trigger le impide aprobar o cambiar fecha, barbero o servicio). Crea reseñas, que entran como PENDIENTE.
- **Barbero:** ve y gestiona sus citas, los clientes que tienen cita con él o lo prefieren, sus productos, su galería y sus noticias.
- **Admin (Gaby):** todo.

## Pasos

1. **Crea el proyecto** en https://supabase.com (región recomendada: East US).
2. **Ejecuta el esquema:** SQL Editor → New query → pega todo `supabase/schema.sql` → Run.
3. **Crea las cuentas del personal:** Authentication → Users → Add user → Create new user, con "Auto Confirm User" marcado:
   - `gaby@goatstylesalon.com` (admin)
   - `darialex@goatstylesalon.com`
   - `wilo@goatstylesalon.com`

   Luego vuelve a ejecutar **solo el bloque final** de `schema.sql` (el que inserta en `staff_roles`), para enlazar cada cuenta con su barbero. Las contraseñas las escoges tú en este paso; ya no se usan las de `index.html`.
4. **Configura Auth:** Authentication → URL Configuration:
   - Site URL: la dirección real del sitio (por ejemplo `https://goatstylesalon.com`).
   - Redirect URLs: añade `https://goatstylesalon.com/profile.html`.
   - Decide si exiges confirmar el correo (Authentication → Providers → Email → "Confirm email"). El sitio ya maneja los dos casos.
5. **Despliega la función para eliminar cuentas** (requiere la [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy delete-account
   ```
6. **Llena `supabase-config.js`** con Project Settings → API: `url` = Project URL y `anonKey` = la anon/publishable key. **Nunca** pongas la `service_role` key en el sitio.
7. **Prueba:** registra un cliente, reserva, entra al panel de Darialex con su cuenta nueva, aprueba la cita, y comprueba desde **otro teléfono** que el cliente la ve como APROBADA. Este es justo el problema que resuelve Supabase: hoy cada dispositivo tiene sus propios datos.

## Después de conectar

- Fotos de perfil: hoy se guardan como texto base64 dentro del perfil. Para producción conviene subirlas a Supabase Storage (bucket `avatars`) y guardar solo la URL.
- Los datos que ya existían en el navegador de cada dispositivo **no se migran solos**. Los barberos, servicios, productos y la noticia se cargan con el SQL. Las citas de prueba no hace falta pasarlas.
- Actualiza `privacidad.html` §7 ("Dónde se guarda") y llena `database` y `hosting` en `legal.js`.

## Seguridad de las cuentas (contraseñas, bloqueos y panel técnico)

**Reglas de contraseña en el servidor.** El sitio valida las reglas en el formulario y otra vez en `security.js`. En Supabase hay que activarlas también en el servidor, para que nadie las pueda saltar: Authentication → Providers → Email → Password requirements:
- Minimum length: **10**
- Required characters: **lowercase, uppercase, digits and symbols**
- Leaked password protection: actívala si tu plan lo incluye.

**Enlace para recuperar la contraseña.** Authentication → Settings → Email OTP expiration: **1800** segundos (30 minutos). Supabase genera un token aleatorio de un solo uso y nunca envía la contraseña por correo.

**Bloqueo tras 3 intentos.** El esquema crea `login_attempts`, `account_locks` y las funciones `login_guard`, `register_failed_login` y `resolve_account_lock`. El sitio las llama en cada inicio de sesión. Hay dos limitaciones que debes conocer:
1. Un atacante que llame directamente a la API de Supabase Auth se salta el contador del sitio. Para bloquearlo también ahí, configura un **Auth Hook "Password Verification Attempt"** (Authentication → Hooks, si tu plan lo permite) que consulte `login_guard`.
2. Bloquear una cuenta después de 3 intentos permite que alguien bloquee a propósito la cuenta de otra persona escribiendo mal su contraseña. Por eso el desbloqueo pasa por verificación en el panel técnico, y los clientes siempre pueden llamar a la barbería.

**Tu cuenta de desarrollador.** Crea tu usuario en Authentication → Users y ejecuta el bloque comentado al final de `schema.sql` con tu correo (marca `is_developer = true`). Con Supabase conectado, el panel `ops/` te pide correo y contraseña de esa cuenta.
