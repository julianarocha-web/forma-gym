# Forma. · Cuentas y datos en la nube

Implementación sobre la aplicación existente, con React, TypeScript, Vite y Supabase. No se crearon recursos remotos durante este trabajo. Las migraciones y pruebas locales están preparadas; la configuración siguiente debe realizarse en tu proyecto de Supabase antes de usar cuentas reales.

## 1. Puesta en marcha

1. Creá un proyecto en [Supabase](https://supabase.com/dashboard). Guardá su contraseña de base de datos fuera del código.
2. En **Project Settings → API Keys**, copiá la clave **Publishable** (`sb_publishable_…`). En **Data API**, copiá la URL del proyecto (`https://…supabase.co`). Nunca uses una clave Secret o Service Role en Vite.
3. Completá `.env.local` a partir de `.env.example`, sin reemplazar un archivo que ya tenga tu configuración:

   ```dotenv
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave_publica
   ```

4. **Proyecto nuevo, sin objetos Forma.:** instalá las cuatro migraciones en orden: [001](../supabase/migrations/202610270001_forma.sql), [002](../supabase/migrations/202610270002_catalog.sql), [003 original](../supabase/migrations/202610270003_session_corrections.sql) y [004](../supabase/migrations/202610270004_protect_session_audit.sql), antes de habilitar el uso de la app. La primera crea el esquema, la segunda el catálogo, la tercera las correcciones y la cuarta protege las auditorías. **Base existente con 003 original instalada:** seguí [INSTALAR-004.md](INSTALAR-004.md) para comprobar estado, historial y cantidad de auditorías; aplicar únicamente 004 requiere revisar el `dry-run` y confirmar. No vuelvas a ejecutar migraciones ya instaladas ni borres objetos para forzar una instalación.
5. En **Authentication → Sign In / Providers → Email**, habilitá email/contraseña y **Confirm email**. Configurá una longitud mínima de contraseña de al menos 8 caracteres. La aplicación valida también confirmación y longitud.
6. En **Authentication → URL Configuration**, configurá **Site URL** con la dirección de producción, o `http://127.0.0.1:5173` mientras desarrollás. Agregá las URLs permitidas del apartado siguiente.
7. Revisá **Authentication → Email / SMTP** y las plantillas de confirmación y recuperación. Para invitaciones públicas, configurá SMTP propio y remitente verificado: el correo de desarrollo de Supabase tiene restricciones y límites. Conservá el enlace de confirmación oficial de las plantillas (`{{ .ConfirmationURL }}`). Los textos de las pantallas son españoles; el asunto y cuerpo del correo se configuran aquí.
8. Verificá en **Storage** que `forma-private` sea **privado**, con máximo 1.500.000 bytes y formatos JPEG/PNG/WebP. Ya lo crea el SQL; no lo conviertas en público ni agregues políticas generales de acceso.
9. Prepará la función de eliminación siguiendo el apartado 4. Las demás funciones de la aplicación no requieren una clave administrativa.
10. Reiniciá Vite después de cambiar las variables:

    ```powershell
    npm.cmd install
    npm.cmd run dev
    ```

La configuración inválida se muestra explícitamente. En desarrollo, sin variables se mantiene el modo local existente; en producción, si faltan variables, se muestra una pantalla de configuración, sin simular sincronización.

## 2. Redirecciones de autenticación

Permití las direcciones exactas de cada origen que efectivamente uses:

```text
http://127.0.0.1:5173/auth/callback
http://127.0.0.1:5173/restablecer
http://localhost:5173/auth/callback
http://localhost:5173/restablecer
https://TU-DOMINIO/auth/callback
https://TU-DOMINIO/restablecer
```

Usá siempre el mismo origen durante cada flujo; `localhost` y `127.0.0.1` tienen almacenamientos separados. Si Vite usa otro puerto, agregá las dos rutas de ese puerto. Para previews de Vercel, agregá solo los orígenes que controles y necesites. Evitá comodines amplios en producción.

El SDK utiliza PKCE. Abrí el enlace de confirmación o recuperación **en el mismo navegador y origen donde lo solicitaste**: allí se conserva el verificador. Si abriste el enlace en otro navegador, volvé a solicitarlo desde el navegador que querés usar. El restablecimiento exige una sesión de recuperación, y al terminar cierra las sesiones mediante Supabase. El enlace por sí solo no permite abrir una pantalla privada sin autenticar.

## 3. Datos, privacidad y sincronización

| Entidad               | Almacenamiento y relación                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Perfil y preferencias | `forma_profiles`, propietario `auth.users.id`; nombre, avatar, objetivos, kg/lb, tema                                   |
| Catálogo general      | `forma_shared_exercises`, lectura compartida; nadie lo edita desde el cliente                                           |
| Ejercicios personales | `forma_exercises`, clave compuesta propietario + ID estable; origen general opcional                                    |
| Rutinas               | `forma_routines` y `forma_routine_exercises`; parámetros independientes por rutina                                      |
| Calendario            | `forma_calendar_entries`; planificación y descanso; completado se deriva de sesiones reales                             |
| Sesiones              | `forma_workout_sessions`, `forma_session_exercises`; snapshots históricos independientes de la rutina actual            |
| Series y aeróbico     | `forma_workout_sets`, `forma_cardio_records`; pesos, repeticiones y mediciones reales, sin sustituir ausencias por cero |
| Borradores            | `forma_workout_drafts`; registros todavía no completados                                                                |
| Control de guardado   | `forma_workspaces.revision`, `forma_local_imports`; revisiones y recibos de importación                                 |

Todas las tablas personales tienen RLS. Las tablas operativas tienen políticas separadas para lectura, creación, actualización y eliminación; después de 004 el cliente solo puede leer sus filas de `forma_session_corrections`. La inserción de auditorías está reservada a la RPC, sin modificación ni borrado directo por clientes. Las relaciones compuestas impiden referenciar ejercicios de otro propietario. Las RPC originales son `security invoker`; `forma_correct_session` usa `security definer` con un rol dedicado sin login ni BYPASSRLS, que hereda RLS de `authenticated` y no se concede al cliente. Todas comprueban `auth.uid()` y no aceptan un propietario elegido por React. El catálogo general admite solo lectura autenticada. El bucket utiliza carpetas privadas `<userId>/<archivo>` y políticas por propietario. La 003 original se conserva como historial y todavía permite inserción directa de auditorías: requiere la actualización 004. Para una base existente seguí [INSTALAR-004.md](INSTALAR-004.md), sin repetir las tres migraciones anteriores.

La aplicación autenticada lee y guarda en Supabase. La sesión la administra el SDK oficial, sin guardar contraseñas propias. Los datos locales antiguos no se cargan automáticamente dentro de una cuenta. El workspace se guarda por una operación transaccional con revisión: solo se confirma después de recibir y validar la respuesta persistida. Editar una rutina no reemplaza sesiones anteriores. Una revisión antigua se rechaza para evitar sobrescribir cambios de otro dispositivo.

El botón **Actualizar datos de mi cuenta** vuelve a consultar el servidor. También se consulta al volver a ingresar. No hay Realtime ni combinación automática de ediciones simultáneas. Si dos dispositivos editan a la vez, uno puede tener que exportar sus cambios pendientes y actualizar antes de repetirlos.

Si se interrumpe un guardado, los cambios quedan pendientes, en memoria y, cuando el navegador lo permite, en `forma-pending:<userId>`. Se bloquean nuevas escrituras y se ofrecen **Reintentar**, respaldo y descarte explícito. Un reintento comprueba si el servidor ya guardó la operación antes de repetirla. Descartar exige descargar el respaldo y confirmar que se conservó. No es una cola offline; no sigas creando registros hasta resolver el estado. Si localStorage está lleno o bloqueado, no confíes en recargar para conservar los cambios: descargá el respaldo.

Las fechas de entrenamientos son `date`, en formato local `YYYY-MM-DD`, sin conversión a UTC. Las marcas de creación y actualización sí son `timestamptz`. Las cargas canónicas siguen en kg: elegir lb cambia visualización y entrada, conservando el historial en kg.

## 4. Eliminación segura de cuenta

La operación administrativa vive exclusivamente en [delete-account/index.ts](../supabase/functions/delete-account/index.ts), una **Edge Function**, nunca en el frontend. Requiere JWT validado con `getUser`, contraseña actual y confirmación. Solo opera sobre el ID autenticado; elimina sus archivos mediante Storage y después su usuario Auth, con cascada de tablas privadas. Un error de Storage detiene la eliminación del usuario. No hay transacción distribuida entre Storage y Auth: si falla después de retirar fotos, revisá el resultado y utilizá el respaldo.

Desde una terminal con la [CLI oficial de Supabase](https://supabase.com/docs/guides/cli/getting-started) instalada, iniciá sesión y vinculá **el proyecto correcto**:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set --env-file supabase/functions/.env.production.local
supabase functions deploy delete-account
```

Creá `supabase/functions/.env.production.local` **solo en tu máquina**, excluido por `.gitignore`, con estas variables (los valores son tuyos):

```dotenv
FORMA_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
FORMA_SUPABASE_SECRET_KEY=sb_secret_TU_CLAVE_SECRETA_SOLO_SERVIDOR
FORMA_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://TU-DOMINIO
```

La función también admite las variables heredadas `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno servidor. Preferí las nuevas claves públicas/secretas. **Nunca** copies el secreto a una variable `VITE_*`, al código React, Vercel frontend o al repositorio. No pegues secretos en capturas o mensajes.

`supabase/config.toml` establece `verify_jwt=false` para esta función porque el handler valida explícitamente el JWT con Supabase antes de operar, compatible con las claves publishable actuales. No retires esa validación del código. La lista de orígenes debe coincidir con las URLs reales de la aplicación.

El flujo en **Mi perfil → Solicitar eliminación** requiere una copia descargada, casilla de confirmación, texto `ELIMINAR` y contraseña. No se ejecutó ninguna eliminación real durante la implementación. Las cuentas con MFA verificado se rechazan expresamente: necesitarían un flujo adicional de segundo factor. Los respaldos descargados y los datos del navegador anteriores a la nube se conservan; solo vos podés retirarlos después de verificar que ya no los necesitás.

## 5. Importar sin perder la copia anterior

1. Abrí la aplicación en el **mismo navegador y origen** donde entrenabas. Iniciá sesión en la cuenta correcta.
2. Elegí **Revisar datos locales**, o la opción de importación en Mi perfil. Se detecta v3, v2 o las claves originales v1, sin escribirlas ni borrarlas.
3. Revisá cantidades y correo destinatario. Descargá la copia que incluye datos e imágenes de IndexedDB. Confirmá expresamente que esos datos te pertenecen y corresponden a esa cuenta.
4. Importá. Se mantienen IDs y referencias, se copian fotos a Storage privado y se verifica el workspace devuelto por la transacción. El hash del origen evita repetir la misma importación; los registros se combinan por ID, nunca solo por nombre.
5. Comprobá rutinas, sesiones, series y fotos. Volvé a entrar desde otro dispositivo. La aplicación **no elimina automáticamente** la copia local, ni siquiera después de una importación correcta.

También podés seleccionar un respaldo JSON exportado por Forma. Se validan formato, relaciones y fotos. Si falta una imagen, hay JSON dañado, coinciden IDs con contenido distinto o aparecen dos finalizaciones incompatibles, el proceso se detiene con un mensaje. No pisa la nube ni reinicia el almacenamiento local. Resolvé el conflicto conservando ambos respaldos. Los datos del perfil incluidos en la exportación se conservan como referencia, **no sobrescriben automáticamente** el perfil de la cuenta de destino.

En migraciones antiguas, la unión inicial usa coincidencia de metadatos y alias existentes. Cuando no puede establecerse identidad con seguridad, se conservan ejercicios separados. No se inventan series diferenciadas para sesiones antiguas que solo guardaban valores comunes.

## 6. Imágenes y temas

Las imágenes generales siguen en `public/images/`. Las fotos personales de ejercicios, rutinas y perfil se validan por MIME y firma (JPEG/PNG/WebP, fuente hasta 8 MB), redimensionan y comprimen (hasta 1400 px y 1,5 MB) antes de subir. Se muestran mediante descarga autenticada y URL Blob temporal, sin bucket público. Los archivos son inmutables: reemplazar una foto crea otra referencia. Solo se retira la anterior cuando ya no aparece en perfil, rutinas, catálogo, borradores ni historial. Las cargas canceladas pueden dejar archivos propios sin asociación; la eliminación de cuenta retira toda su carpeta. Una descarga fallida muestra placeholder.

El tema usa tokens en `src/theme.css`, un proveedor central y `public/theme-init.js` antes de cargar React. El interruptor está junto al perfil; también hay Claro/Oscuro/Sistema en preferencias. El primer uso sigue al sistema; una elección explícita se guarda localmente y en el perfil autenticado. Si falla la sincronización del tema, la elección sigue activa y se informa cómo reintentar. Las fotos no llevan filtros automáticos. El violeta principal claro es `#5735A8`, el interactivo `#6342BD`, el fondo suave `#EDE6FF`; el oscuro usa acentos claros y superficies específicas.

## 7. Pruebas automatizadas locales

```powershell
npm.cmd test
npm.cmd run build
```

La suite incluye pruebas de regresión, formularios Auth con cliente simulado, exportación/importación, errores y recuperación del guardado, unidades, temas y permisos de fotos. `tests/database.test.ts` aplica el SQL a **PostgreSQL embebido PGlite** con roles de dos usuarios, y comprueba transacciones, series, RLS, relaciones, revisiones e idempotencia. Los esquemas Auth/Storage se simulan para ejecutar las políticas: esto **no comprueba** la infraestructura remota de Supabase, entrega de correos, renovación real de tokens ni la Edge Function desplegada.

## 8. Prueba remota reproducible con dos cuentas

Primero creá **dos cuentas exclusivas de prueba, confirmadas y sin entrenamientos ni rutinas**. No uses tus cuentas personales. Luego configurá en la terminal (sin guardar contraseñas en archivos del repositorio):

```powershell
$env:FORMA_TEST_EMAIL_A = 'correo-de-prueba-a'
$env:FORMA_TEST_PASSWORD_A = 'contraseña-de-prueba-a'
$env:FORMA_TEST_EMAIL_B = 'correo-de-prueba-b'
$env:FORMA_TEST_PASSWORD_B = 'contraseña-de-prueba-b'
$env:FORMA_ALLOW_TEST_WRITES = 'yes'
node scripts/security-smoke.mjs
```

El script usa solo la clave pública y sesiones normales. Rechaza cuentas que ya tengan datos, crea registros sintéticos con prefijo único, comprueba persistencia y series distintas, lectura/actualización/eliminación/inserción ajenas, catálogo de solo lectura, revisión antigua, descarga y modificación de fotos privadas. Abre un cliente nuevo para verificar recuperación del historial. Al terminar retira **únicamente sus IDs y foto temporales**. Conserva cuentas/perfiles y deja la revisión incrementada. Una interrupción de red puede requerir limpiar manualmente el prefijo que informa; nunca limpies tablas completas. No ejecuta recuperación por correo ni eliminación de cuentas.

Después quitá de la terminal las cinco variables de prueba con `Remove-Item Env:FORMA_TEST_EMAIL_A`, etc., o cerrá esa terminal. No se ejecutó esta prueba remota en el entorno de implementación porque no se proporcionaron cuentas dedicadas.

## 9. Recorrido manual obligatorio antes de publicar

| Flujo               | Comprobación                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro            | Crear A, abrir confirmación en el mismo navegador; comprobar mensajes de correo usado/contraseña inválida                                                  |
| Acceso              | Ingresar, recargar, cerrar y reabrir navegador; cerrar sesión y comprobar que no aparecen pantallas privadas                                               |
| Recuperación        | Solicitar email, abrir enlace, elegir nueva contraseña, ingresar de nuevo; probar enlace vencido y acceso directo a `/restablecer`                         |
| Perfil              | Editar nombre, objetivos y kg/lb; subir/reemplazar/quitar avatar y recargar; provocar un fallo de red y comprobar error                                    |
| Rutinas e historial | Elegir un ejercicio general, crear rutina, reutilizarlo en otra, completar con dos pesos/repeticiones distintos; editar/eliminar rutina y revisar historia |
| Otro dispositivo    | Ingresar con A, pulsar actualizar; comprobar sesiones, series, planes, avatar, imágenes, unidades y tema                                                   |
| Aislamiento         | Cerrar A e ingresar con B: workspace propio vacío, sin datos ni fotos privadas de A; ejecutar script remoto                                                |
| Importación         | Respaldar, revisar destinatario, importar, repetir sin duplicación; comprobar fotos y valores antiguos; confirmar que claves locales siguen intactas       |
| Fallos              | Cortar red al guardar; no debe anunciar éxito; reconectar y reintentar. Editar desde dos clientes para comprobar conflicto de revisión                     |
| Cuenta              | Solo en una cuenta descartable y con respaldo: contraseña errónea rechazada; eliminación correcta retira usuario, filas y fotos                            |
| Apariencia          | Claro/oscuro/sistema; header, dashboard, rutinas, catálogo, calendario, progreso/tooltip, perfil, Auth y modales en 360, 390, 768 y 1440 px                |
| Accesibilidad       | Teclado, foco visible, labels, contraste, puntos del gráfico y scroll de modales; verificar legibilidad sobre fotos                                        |

La inspección visual automática en Chrome fue detenida por el control de seguridad porque no pudo identificar la URL activa con certeza. Por eso **no se verificó el layout real** en móvil/escritorio durante esta implementación. Hay una vista de desarrollo con datos ficticios en `/tests/visual-preview.html` para recorrer el shell y los temas sin tocar una cuenta real; no está incluida en el build ni sustituye las pruebas remotas.

## 10. Vercel

1. Importá el proyecto como **Vite**, build `npm run build`, salida `dist`.
2. Agregá solamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en las variables del frontend. La compilación rechaza claves que no sean publishable.
3. Publicá y configurá Site URL y ambas redirecciones en Supabase con el dominio exacto.
4. Incluí ese origen en `FORMA_ALLOWED_ORIGINS` de la Edge Function y actualizá sus secretos.
5. Repetí el recorrido manual y el aislamiento remoto antes de invitar a otras personas.

`vercel.json` mantiene las rutas de Auth al recargar mediante rewrite de SPA, y define headers básicos de seguridad. Los assets siguen sirviéndose como archivos. Una modificación de variables de Vite requiere **un nuevo build y despliegue**. La clave administrativa permanece únicamente en Supabase Edge Functions.

## Archivos principales

- `src/App.tsx`: restauración de sesión, rutas Auth y acceso privado.
- `src/AppShell.tsx`: pantallas existentes, perfil, importación y estados de nube.
- `src/cloud/`: configuración pública, repositorio RPC, sesión/perfil, persistencia, respaldos y fotos privadas.
- `src/components/AuthPanel.tsx`, `ProfilePage.tsx`, `ImportLocal.tsx`: formularios y confirmaciones.
- `src/theme.tsx`, `src/theme.css`, `public/theme-init.js`: temas, tokens y arranque sin destello inicial.
- `src/units.tsx`: entrada/visualización kg/lb con almacenamiento canónico kg.
- `supabase/migrations/`: esquema, RLS, funciones, Storage y catálogo.
- `supabase/functions/delete-account/`: operación administrativa exclusiva del servidor.

Referencias oficiales: [claves](https://supabase.com/docs/guides/api/api-keys), [Auth y contraseñas](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage privado](https://supabase.com/docs/guides/storage/security/access-control), [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).
