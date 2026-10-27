# Forma · Mi progreso gym

Aplicación de React, TypeScript, Vite y Tailwind para organizar rutinas, registrar series y consultar el progreso. Ahora incluye Supabase Auth, perfiles privados, PostgreSQL con RLS, imágenes en Storage y temas claro/oscuro. Conserva el almacenamiento local anterior para importarlo explícitamente a una cuenta.

**Configuración necesaria:** seguí [la guía de Supabase](docs/SUPABASE.md) para ejecutar las migraciones, configurar correos y redirecciones, desplegar la función segura de eliminación y probar dos usuarios. No se crearon recursos remotos automáticamente. `.env.example` contiene solamente placeholders públicos.

**Correcciones:** las tarjetas de rutinas tienen **Editar/Eliminar** visibles. Cada sesión completada permite **Corregir registro** o **Eliminar registro** con confirmación, manteniendo copias privadas de los valores anteriores. Con la 003 original ya instalada, seguí [la actualización controlada a 004](docs/INSTALAR-004.md), con chequeos de solo lectura, comparación de la cantidad de auditorías y sincronización del historial sin repetir 001/002/003. Uso y conservación en [docs/CORRECCIONES.md](docs/CORRECCIONES.md).

## Diseño y fotografías

El rediseño conserva las funciones existentes y utiliza Poppins local, superficies glass moderadas, tarjetas con portadas y colores semánticos. La navegación principal es **Inicio, Rutinas, Calendario, Progreso y Mi perfil**. El botón de tema está junto al perfil; los colores, formularios, gráficos y modales utilizan tokens de ambos temas.

- **Inicio** muestra actividad semanal real, última sesión y próximo plan, con accesos rápidos. No asigna entrenamientos automáticamente. Los ejemplos de versiones anteriores se conservan en **Ver ejemplos anteriores**, separados de actividad y progreso reales.
- **Rutinas → menú de tres puntos → Editar** permite cambiar la portada, subir una foto propia, quitarla o restaurar la predeterminada. También permite reordenar ejercicios con los botones subir/bajar, conservando sus identificadores.
- **Rutinas → Catálogo de ejercicios → editar** permite asignar una imagen específica al movimiento. Tocar su nombre abre el detalle visual. El selector de rutinas reutiliza ese mismo catálogo.
- Las fotos iniciales están en `public/images/`. El archivo [CREDITS.md](public/images/CREDITS.md) documenta fuente y licencia. Se verificó visualmente cada recurso. Las portadas de fuerza/tren inferior son fotografías de actividad; no se presentan como demostraciones de movimientos concretos. Los ejercicios sin una foto específica usan un placeholder por tipo, en lugar de una fotografía incorrecta o repetida.
- La carga admite **JPG, PNG y WebP**, comprueba el tipo, la firma y un máximo de **8 MB**. El navegador redimensiona la imagen a un máximo de 1400 px y la comprime antes de guardarla. El resultado debe pesar menos de 1,5 MB.
- En modo local, las fotos propias se guardan como blobs en **IndexedDB**, base `forma-media`; localStorage contiene referencias cortas. Con una cuenta, se suben a **Storage privado**, bajo el ID del usuario. La imagen se asocia al **guardar el formulario**. Si cancelás, los valores de la rutina o ejercicio no se modifican.
- Quitar una foto elimina su asociación; se conservan las utilizadas por sesiones anteriores. En la nube se retiran archivos anteriores solo cuando no quedan referencias. Las cargas canceladas pueden dejar archivos propios sin asociación. Las fotos locales solo se envían a Supabase al importar con confirmación; las subidas autenticadas se guardan directamente en Storage.
- Las imágenes usan recorte visual `object-fit: cover`, texto alternativo y carga diferida; una carga fallida conserva un placeholder y el resto de la app sigue funcionando.
- El campo opcional `image` es compatible con los documentos v3 ya guardados: no requiere reiniciar datos ni cambiar IDs. Las migraciones de v1/v2 siguen disponibles.

**Progreso** ahora incluye búsqueda visual con miniaturas y etiquetas, imagen del ejercicio y primera, última y mejor marca del período. La mejor marca es el máximo de la métrica seleccionada; no implica una mejora global del rendimiento. Las unidades permanecen separadas y los datos ausentes siguen sin convertirse en cero.

## Ejecutar y verificar

```powershell
npm.cmd install
npm.cmd run dev
```

Abrí la dirección que muestra Vite, normalmente http://127.0.0.1:5173. Usá el mismo navegador y origen que antes para acceder a tus datos existentes. En otros sistemas podés usar `npm` en lugar de `npm.cmd`.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`npm.cmd run format` formatea el código. Las pruebas usan Node, jsdom y Testing Library; no necesitan un navegador instalado. Verifican flujos de interfaz y reglas de datos, pero no sustituyen la revisión visual en un navegador real.

## Probar las funciones

1. **Mis rutinas → Crear rutina:** indicá nombre, descripción opcional, etiquetas y ejercicios. Cada ejercicio tiene su propio tipo de registro y etiquetas por actividad, grupo muscular y equipamiento. Las etiquetas de la rutina son independientes. Podés agregar etiquetas personalizadas y filtrar las tarjetas.
2. **Abrir rutina:** consultá ejercicios, valores planificados y etiquetas. En el menú de tres puntos podés editar, duplicar, asignar una fecha o eliminar, con confirmación. La copia tiene un ID de rutina y filas nuevos, y conserva las referencias a los mismos ejercicios del catálogo. Sus valores planificados se editan independientemente.
3. **Asignar fecha:** elegí una fecha desde el selector del panel y guardá la asignación. La misma rutina puede planificarse en varias fechas sin copiar sus ejercicios. Hay una asignación planificada o de descanso por fecha; se conservan todas las sesiones históricas de ese día.
4. **Calendario:** tocá una fecha para consultar el estado, elegir otra rutina, añadir una nota, marcar descanso o quitar una asignación. Verde con check = completado; amarillo con calendario = planificado; azul con luna = descanso. El contorno marca hoy. Sin registro queda neutro, incluso en fechas pasadas.
5. **Registrar:** desde el dashboard, elegí manualmente la rutina de hoy, o abrí una fecha pasada/actual en el calendario. Ajustá los valores realizados y confirmá con **Completar entrenamiento**. Las cargas y notas de cada ejercicio se guardan como borrador. La nota general se guarda al completar; la nota del día, al guardar la asignación.
6. **Aeróbico:** registra minutos, distancia en km y resistencia opcionales; no solicita kilos ni repeticiones. Movilidad registra duración. Musculación registra series, repeticiones y kilos. Elegir el tipo de registro no impone etiquetas.
7. **Mi progreso:** elegí un ejercicio, período y métrica para ver sus registros de todas las rutinas. El historial debajo del gráfico conserva cargas, series y notas originales, incluso si eliminaste la rutina. El historial general de entrenamientos sigue permitiendo abrir cada fecha.

## Catálogo y progreso individual

1. **Mis rutinas → Catálogo de ejercicios:** buscá por nombre o filtrá por etiqueta. Podés crear un ejercicio con nombre, tipo, grupos musculares y equipamiento, o editar sus datos generales. Al cambiar un nombre no cambia su identidad ni se pierde su historial.
2. **Crear/editar rutina → Agregar ejercicio:** se abre el mismo catálogo. Seleccioná un ejercicio existente o creá uno nuevo. El peso, series, repeticiones o duración que configures pertenecen únicamente a esa rutina. Por ejemplo, podés asignar Hip thrust con 40 kg a una rutina y con 65 kg a otra.
3. **Registrar series:** el formulario mantiene el registro rápido con valores comunes. Si los pesos o repeticiones cambian entre series, usá **Registrar series con valores distintos** para editar cada una, agregar o quitar series. Al completar se conservan los valores reales; la plantilla de la rutina no se modifica.
4. **Mi progreso:** seleccioná el mismo ejercicio para reunir los entrenamientos de todas las rutinas. Los filtros son último mes, últimos tres meses y todo el historial; usan meses calendario hacia atrás desde la fecha local actual.
5. **Musculación:** podés ver el máximo peso por sesión, la suma de repeticiones registradas o el historial completo por serie. Son métricas separadas. El peso máximo no expresa por sí solo el rendimiento completo.
6. **Aeróbico:** seleccioná duración en minutos o distancia en kilómetros. Si no registraste una distancia, queda **Sin registrar** y aparece un corte en la línea; no se reemplaza por cero. Si hay varios registros del ejercicio en la misma sesión, se suman duración/distancia solo cuando todos tienen esa medición.
7. Tocá un punto del gráfico para ver fecha, rutina y valor exacto. También podés activar sus puntos con teclado o usar los botones de valores del historial. El primer y último valor del período usan únicamente mediciones existentes. No se calculan porcentajes de mejora ni se mezclan unidades.

Los entrenamientos antiguos guardaban valores comunes (`series × repeticiones · peso`), sin desglose individual. Se muestran con esa aclaración; no se inventan series diferenciadas. Para sus repeticiones totales se calcula `series × repeticiones` a partir del registro existente. En Mi perfil podés elegir kg o lb: la carga canónica permanece en kg y se convierte únicamente para ingresar y mostrar valores.

Un plan no equivale a una sesión completada. No se completan fechas futuras. Para evitar duplicados accidentales, cada rutina puede completarse una vez por fecha; un día puede conservar sesiones de distintas rutinas.

## Migración y conservación

- La clave local actual es `forma-data-v3`: catálogo independiente, rutinas libres, sesiones, planes y borradores en un documento versionado. Al autenticar, Supabase pasa a ser la fuente principal; el documento local se conserva y puede importarse después de revisar el resumen y descargar un respaldo. Nunca se incorpora automáticamente a otra cuenta.
- Al abrir se migra `forma-data-v2`, o las claves originales `forma-routines-v1`, `forma-sessions-v1` y `forma-drafts-v1`. Todas las claves anteriores quedan intactas como respaldo. No se borran rutinas, ejercicios, borradores ni sesiones existentes, incluidos los ejemplos que ya estaban guardados.
- Cada fila de rutina/sesión conserva su ID original y recibe `exerciseId`, que referencia un ID estable del catálogo. Las copias anteriores con nombre normalizado, tipo y etiquetas coincidentes comparten identidad; las variantes con metadatos distintos se mantienen separadas. Se conservan los IDs anteriores como alias. No se usa el nombre como identidad en el funcionamiento normal de la app.
- Los valores planificados pertenecen a cada fila de rutina; `performedSets` contiene las series reales de las nuevas sesiones. Editar el catálogo actualiza los datos generales de las rutinas, sin alterar borradores ni snapshots históricos. Un ejercicio nuevo se guarda en el catálogo aunque después canceles la edición de una rutina.
- Se conservan IDs, nombres, ejercicios y valores históricos. La bicicleta anterior convierte sus repeticiones/minutos a duración y mantiene sus campos originales. Las rutinas pierden su asociación fija a lunes, martes, miércoles o viernes.
- Ya no se generan sesiones por día de la semana. El modo local nuevo incluye cuatro rutinas originales. Las cuentas nuevas empiezan con espacio privado vacío y acceso al catálogo general; pueden crear sus propias rutinas o importar las anteriores.
- Cada sesión conserva una copia de los valores realizados. Editar o eliminar una rutina no modifica ese historial; los planes de rutinas eliminadas permanecen visibles para reasignarlos o quitarlos.
- Se validan los datos al leer y guardar. Si hay JSON dañado o una versión incompatible, se informa y se bloquea la escritura; no se reemplazan silenciosamente los datos. Si falla el guardado, no se confirma la operación.
- Las fechas usan `YYYY-MM-DD` construido con la fecha local, sin convertirlas a UTC. Las fechas de calendario se interpretan a mediodía local.
- En cuentas autenticadas, los datos se recuperan del servidor al ingresar o pulsar actualizar. No hay Realtime ni fusión offline. Las revisiones rechazan sobrescrituras simultáneas; los errores conservan una copia pendiente por usuario, con reintento y exportación. Borrar datos del navegador elimina copias locales, pero no los registros confirmados en Supabase. El modo local sin configurar continúa sin sincronización.

## Corrección de vidrio y fotografías

Las tarjetas y la navegación usan transparencias más visibles sobre un fondo multicolor, blur y bordes de luz. Se mantiene mayor opacidad en formularios y gráficos para leer los valores con claridad.

Los 17 ejercicios iniciales tienen fotos específicas. La biblioteca también incluye Smith, sentadilla búlgara, curl femoral sentado y tríceps en polea (21 movimientos en total). El detalle muestra la foto completa, sin el recorte de la miniatura. Las portadas de piernas, glúteos y tren superior son distintas. Los archivos viven en `public/images/`; no requieren internet durante el uso.

En **Rutinas → Catálogo de ejercicios → Editar ejercicio**, podés abrir **Elegir una foto del catálogo**, buscar una foto y guardarla. También se mantiene la subida de fotos propias. Las referencias personalizadas y las imágenes quitadas explícitamente se respetan. No se modifican registros ni claves de localStorage para aplicar estas mejoras.

`src/exercise-photos.ts` centraliza fotos y nombres equivalentes para seleccionar imágenes; esos nombres no identifican ejercicios ni unen historiales. Para regenerar recursos se usan `scripts/collect-exercise-photos.mjs` y luego `scripts/prepare-video-photos.mjs` (requieren conexión). FFmpeg es una herramienta de desarrollo para extraer los fotogramas: no se incluye en la aplicación web. Fuentes, autores y licencias en `public/images/CREDITS.md`.

## Archivos

- `src/App.tsx`: controla autenticación, restauración de sesión y acceso privado. `src/AppShell.tsx` conserva navegación, dashboard y pantallas originales.
- `src/cloud/`, `supabase/` y `src/components/ProfilePage.tsx`: repositorio, respaldo/importación, perfiles, imágenes y esquema seguro. Configuración y límites en [docs/SUPABASE.md](docs/SUPABASE.md).
- `src/theme.tsx`, `src/theme.css` y `public/theme-init.js`: preferencia de tema local/remota, tokens y aplicación del tema antes de React.
- `src/components/HomeOverview.tsx`: nueva composición de Inicio con datos reales y accesos rápidos.
- `src/design-system.css`: tokens, superficies, navegación, tarjetas, calendario, formularios y ajustes responsive del rediseño; respeta movimiento reducido.
- `src/media.ts` y `src/components/Media.tsx`: validación, optimización, IndexedDB, previews, placeholders y selector de fotos reutilizable.
- `public/images/`: fotografías locales y créditos.
- `src/data.ts`: modelo v3, catálogo, migración, validación y operaciones de rutinas, planes y sesiones.
- `src/progress.ts`: filtros de fechas y métricas de sesión sin sustituir mediciones ausentes por cero.
- `src/legacyV2.ts`: compatibilidad con datos v1/v2; las operaciones actuales viven en `data.ts`.
- `src/legacyData.ts`: definiciones originales utilizadas en la migración y las rutinas iniciales; sin generación de sesiones.
- `src/useAppData.ts`: lectura y guardado con manejo de errores.
- `src/components/`: calendario, panel de fecha, editor de rutinas, registro de ejercicios, etiquetas, gráficos, modal accesible y menú de acciones reutilizables.
- `src/index.css`: diseño base original, formateado.
- `src/enhancements.css`: mejoras responsive, chips, formularios, estados del calendario y tarjetas.
- `src/exercise-catalog.css`: estilos del catálogo, registro por serie y progreso individual.
- `tests/` y `scripts/test.mjs`: pruebas de migración, integridad, formularios, calendario y teclado.
- `package.json` y `package-lock.json`: herramientas de desarrollo y comandos de pruebas/formato.

Para revisar el diseño móvil, abrí la app con ancho de 360–390 px en ambos temas y comprobá navegación inferior, tarjetas, calendario, formularios y desplazamiento de modales. Las pruebas de interfaz usan jsdom y no verifican layout visual ni codificación nativa de imágenes. Las políticas SQL se prueban con PostgreSQL embebido; el script remoto y el recorrido manual están documentados en la guía. La inspección visual de Chrome fue detenida automáticamente al no poder verificar la URL activa; queda pendiente la revisión real en móvil/escritorio.
