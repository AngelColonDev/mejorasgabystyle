# Documentos legales: pendientes antes de publicar

Documentos creados (todos leen sus datos de `legal.js` → `config`):

| Documento | Archivo |
|---|---|
| 1. Términos y Condiciones | `terminos.html` |
| 2. Política de Privacidad | `privacidad.html` |
| 3. Política de Cookies + 9. Preferencias de cookies | `cookies.html` (sección `#preferencias`) |
| 4. Política de Reservaciones | `policies.html` |
| 5. Aviso de registro · 6. Aviso de reserva · 7. Casillas · 8. Banner · 10. Menores · 11. Eliminación de cuenta · 12. Cambios | `avisos.html` (cada uno con su ancla) |
| Banner y administrador de cookies, footer legal, resumen antes de reservar | `legal.js` (se carga en todas las páginas públicas) |

Mientras `config.draft` sea `true`, cada documento muestra un aviso de "borrador". Cambiarlo a `false` **solo** después de completar esta lista y de la revisión legal.

> Esto no es asesoría legal. Los documentos son un modelo de trabajo que debe revisar un abogado licenciado en Puerto Rico.

---

## ⚠️ Bloqueos: no publicar las políticas como definitivas hasta resolver esto

Las políticas deben corresponder **exactamente** con lo que hace la plataforma. Hoy hay diferencias importantes. Los puntos 1 a 4 se resuelven al conectar Supabase: el código ya está listo, solo faltan las credenciales (ver `docs/supabase-setup.md`).

1. ~~Contraseñas en texto plano~~ **Resuelto:** ahora se guardan con hash PBKDF2-SHA256 (600,000 iteraciones), y las cuentas viejas se migran al iniciar sesión. Con Supabase, Auth las guarda con bcrypt. No se puede publicar una política de privacidad "final" con esto. Solución: migrar a Supabase Auth (ver `docs/supabase-schema.md`), que guarda las contraseñas con hash.
2. **Los datos viven en el navegador de cada dispositivo**, no en un servidor. Por eso un cliente **no ve en su teléfono las citas que el barbero aprobó desde el suyo**. La sección 7 de `privacidad.html` describe esto con honestidad y se debe actualizar al migrar.
3. ~~Credenciales del staff en el código~~ **Resuelto en parte:** se quitaron de `index.html`; ahora solo existen como hash en `security.js` y cada barbero debe crear su propia contraseña en el primer acceso. Sin servidor, los datos siguen viviendo en cada navegador.
4. La **recuperación de contraseña** no existe todavía. Los términos no la prometen; añadirla con tokens seguros que expiren.

---

## INFORMACIÓN QUE EL PROPIETARIO DEBE COMPLETAR ANTES DE PUBLICAR

Todo se edita en `legal.js` → `const config = { ... }`, salvo lo indicado.

**Identidad del negocio**
- [ ] `legalName`: nombre legal (persona o entidad registrada)
- [ ] `tradeName`: nombre comercial (hoy "Gaby Style Barber Studio"; el footer del index dice "GOAT Style Salón", hay que unificarlo)
- [ ] `owner`: propietario o entidad legal
- [ ] `address` y `municipality`: dirección exacta. **También** ponerla en `shared-data.js` → `SHOP_LOCATION.address` (y, si se puede, `lat`/`lng`) para que funcionen los botones "Cómo llegar" y el mapa
- [ ] `email`, `claimsEmail` (reclamaciones), `privacyEmail` (privacidad), `phone`
- [ ] `effectiveDate`: fecha de entrada en vigor

**Reglas de reservación** (los valores actuales vienen de la política anterior; confirmarlos)
- [ ] `freeCancelHours` (hoy 48) y `lateCancelFee` (hoy $20)
- [ ] La política anterior decía "No se permiten cancelaciones el mismo día", pero el sistema sí permite cancelar. La nueva versión las trata como cancelación tardía. **Confirmar**
- [ ] `graceMinutes`: periodo de tolerancia (hoy 10)
- [ ] `noShowConsequence`: qué pasa en un no-show
- [ ] `deposit` y `depositRefund`: si habrá depósitos, monto, si son reembolsables y cuándo se transfieren
- [ ] `rescheduleRule` y `refundRule`
- [ ] Política de devolución de productos (Términos §14)
- [ ] Cargos de traslado del servicio VIP a domicilio

**Proveedores** (lista exacta de los que se usen en producción)
- [ ] `hosting`: proveedor de hosting
- [ ] `database`: base de datos y autenticación (¿Supabase?)
- [ ] `paymentProcessor`: si habrá pagos en línea (Stripe, Square, PayPal…)
- [ ] `emailProvider`: plataforma de email transaccional
- [ ] `smsProvider`: plataforma de SMS
- [ ] `analytics`: analítica (hoy ninguna)
- [ ] `otherProviders`
- [ ] Ubicación de los servidores de cada proveedor principal (Privacidad §7)

**Cookies**
- [ ] Confirmar la tabla de `cookies.html`. Si se añade analítica, chat o píxeles de redes sociales: añadir cada cookie a la tabla, cargarla **solo** con consentimiento (ver cómo se hace con el mapa en `legal.js` → `data-consent-embed`) y subir `cookieVersion` para volver a pedir la elección

**Retención** (Privacidad §8)
- [ ] `retentionAccount`, `retentionAppointments`, `retentionBilling`, `retentionLogs`, `retentionDeleted`
- [ ] Periodos de comunicaciones, solicitudes de empleo y copias de seguridad
- [ ] Plazo de respuesta a solicitudes de privacidad y de eliminación por email

**Otras decisiones**
- [ ] Métodos para eliminar la cuenta: hoy en Mi cuenta → Privacidad, y por email
- [ ] Edad mínima: `minAge` (18). El registro ya bloquea a menores de esa edad. Si quieren permitir cuentas de menores de 13 años, **detener**: hay que evaluar COPPA y el consentimiento parental verificable antes
- [ ] Consentimiento de fotos y videos: crear el formulario real (texto en `avisos.html#imagen`) y guardar la respuesta firmada
- [ ] Herramientas de marketing: cómo se enviarán las promociones y el mecanismo de baja (unsubscribe)
- [ ] Jurisdicciones donde opera el negocio (¿solo Puerto Rico? ¿clientes de otros estados o países?)
- [ ] Relación con Angel Tech Solutions (acceso a datos para soporte): acuerdo de confidencialidad o de procesamiento de datos

---

## LISTA TÉCNICA PARA EL PROGRAMADOR

Estado: ✅ hecho en este cambio · ⬜ pendiente (la mayoría requiere el backend)

**Transporte y sesiones**
- ⬜ HTTPS obligatorio en todo el sitio y redirigir HTTP a HTTPS (depende del hosting)
- ⬜ Cookies de sesión con `Secure`, `HttpOnly` y `SameSite=Lax/Strict`
- ⬜ Expiración de sesiones e invalidación al cerrar sesión o cambiar la contraseña
- ⬜ Content Security Policy (permitir solo los dominios usados: fonts.googleapis.com, fonts.gstatic.com, cdnjs.cloudflare.com, res.cloudinary.com, images.unsplash.com, i.pravatar.cc, google.com/maps)

**Autenticación**
- ⬜ Hash de contraseñas con Argon2id o bcrypt bien configurado (Supabase Auth lo hace). Que nunca se pueda recuperar la contraseña original
- ⬜ Recuperar contraseña con tokens seguros, de un solo uso y que expiren
- ⬜ Protección contra credential stuffing: rate limiting y bloqueo o ralentización después de varios intentos fallidos
- ⬜ 2FA para administradores cuando sea posible
- ⬜ Sacar `staffCredentials` de `index.html`; los roles deben salir del servidor

**Datos y endpoints**
- ⬜ Validación en el frontend **y** en el backend
- ⬜ Sanitizar y escapar todo el texto del usuario antes de insertarlo en HTML (prevención de XSS). Hoy hay muchos `innerHTML` con datos de clientes, reseñas y noticias
- ⬜ Prevención de inyección SQL: consultas parametrizadas o el cliente de Supabase, nunca SQL concatenado
- ⬜ Protección CSRF si se usan cookies de sesión
- ⬜ Proteger los endpoints con roles y permisos (Row Level Security en Supabase): cliente / barbero / admin
- ⬜ Proteger el panel administrativo en el servidor, no solo ocultándolo en la interfaz
- ⬜ Rate limiting en login, registro, reservas y formularios
- ⬜ Secretos y API keys en variables de entorno, nunca en el código fuente ni en el repositorio
- ⬜ Actualizar dependencias con regularidad (`crm/` con `npm audit`)
- ⬜ No almacenar tarjetas; usar el checkout o los tokens del procesador de pagos

**Operación**
- ⬜ Logs de seguridad (inicios de sesión, cambios de rol, eliminaciones) sin guardar contraseñas ni datos sensibles
- ⬜ Backups cifrados y una prueba de restauración
- ⬜ Plan de respuesta a incidentes: contener, evaluar, notificar según la ley aplicable (Ley 111-2005 de PR) y documentar
- ⬜ Exportación razonable de datos del cliente (JSON o PDF) a petición

**Consentimiento** (hecho en esta versión, sobre localStorage)
- ✅ Casillas no premarcadas; Términos y Privacidad con enlaces separados; marketing en una casilla separada y opcional
- ✅ Registro del consentimiento: `client.consent` (versión de los términos y de la privacidad, fecha y hora, user agent) y `client.marketingConsent`
- ✅ Registro de la política aceptada en cada cita: `appointment.policyAcceptance`
- ✅ Versionado: `termsVersion`, `privacyVersion`, `bookingPolicyVersion` y `cookieVersion` en `legal.js`
- ⬜ Volver a pedir la aceptación cuando cambie `termsVersion` (comparar con `client.consent.termsVersion` al iniciar sesión)
- ✅ Administrador de cookies: "Aceptar todas", "Rechazar no esenciales" y "Personalizar", categorías opcionales apagadas, elección guardada y "Preferencias de cookies" en el footer
- ✅ Google Maps solo se carga con consentimiento funcional o al pulsar "Mostrar mapa"
- ✅ Eliminación de cuenta (Mi cuenta → Privacidad) con verificación por email; anonimiza el historial
- ✅ Baja de promociones desde Mi cuenta → Privacidad
- ✅ Edad mínima aplicada en el registro
- ⬜ Los mensajes de marketing deben incluir un enlace para darse de baja; los avisos de seguridad y de las citas no se pueden desactivar mientras la cuenta esté activa

---

## REVISIÓN LEGAL RECOMENDADA

Cláusulas que debe revisar un abogado licenciado en Puerto Rico antes de publicar (también están marcadas en las páginas con la etiqueta "REQUIERE REVISIÓN LEGAL"):

1. **Términos §22, Limitación de responsabilidad:** alcance y redacción permitidos en PR para servicios al consumidor.
2. **Términos §23, Indemnización:** si es exigible y si es razonable frente a consumidores.
3. **Términos §24, Ley aplicable y foro:** y cualquier decisión futura sobre arbitraje, renuncia a jurado o a demandas colectivas (hoy **no** se incluyen).
4. **Términos §6 y Política de Reservaciones:** que los cargos por cancelación tardía y no-show, y su forma de cobro, sean válidos y se divulguen bien; cómo se cobra un cargo si no hay depósito ni tarjeta guardada.
5. **Términos §7, Depósitos:** reembolsos y pérdida del depósito.
6. **Términos §11–12, Salud y reacciones:** el lenguaje sobre alergias y reacciones, sin exenciones absolutas.
7. **Términos §13, Servicio VIP a domicilio:** responsabilidad en propiedad ajena, traslados y seguridad.
8. **Términos §14, Productos a la venta:** quién es el vendedor legal (¿el barbero o la barbería?), devoluciones, garantías e impuestos (IVU).
9. **Términos §17 y Avisos §8, Fotos y videos:** el formulario de consentimiento de imagen y la revocación.
10. **Privacidad §5, Terceros:** la lista final de proveedores y la relación con Angel Tech Solutions.
11. **Privacidad §6, Venta de información:** si alguna integración futura podría considerarse "venta" bajo alguna ley aplicable.
12. **Privacidad §7, Dónde se guarda:** transferencias fuera de PR.
13. **Privacidad §8, Retención:** plazos legales de conservación de registros contables y fiscales en PR.
14. **Privacidad §11, Seguridad:** que solo se describan medidas realmente implementadas.
15. **Privacidad §12, Incidentes:** las obligaciones de la Ley 111-2005, según enmendada (plazos, a quién notificar y el contenido del aviso).
16. **Privacidad §13 y Avisos §5, Menores:** la edad mínima, el manejo de datos de menores que reservan los padres, y COPPA si se permitieran menores de 13 años.
17. **Cookies:** si las tipografías, íconos e imágenes de terceros necesitan consentimiento o un aviso adicional.
18. **Comunicaciones:** requisitos para mensajes de marketing por SMS o WhatsApp (consentimiento expreso, horarios y baja). Revisar la ley federal aplicable antes de enviar SMS de marketing.
19. **Avisos §6, Eliminación de cuenta:** qué datos deben conservarse por obligación legal.
