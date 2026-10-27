# Corrección de la regresión del layout

La integración de los estados de guardado agregó un `fieldset.workspace-fields.modal-fields` como hijo directo de `.app-shell`, junto al `main`. `.app-shell` es un contenedor flex y el fieldset tenía `width: 100%`, incluso sin un modal abierto. Por eso ocupaba una segunda posición en la fila y el algoritmo de flex reducía el ancho de `main`, dejando una gran región vacía a la derecha.

El fieldset ahora es hermano de `.app-shell`, fuera de su fila. Conserva el bloqueo de sus controles durante guardados, errores pendientes y carga de cuenta. La prueba de regresión abre y cierra un editor, comprueba esa separación y verifica que no cambien los datos.

Los selectores globales `main` se limitaron a `.app-shell > main` para separar el layout autenticado de las pantallas Auth. El contenido principal crece para ocupar el espacio restante; contenido y encabezado conservan un límite de 1420 px y quedan centrados dentro de ese espacio en pantallas amplias.

Los cambios adicionales son de estructura: mínimo cero para hijos de grillas y campos, columnas de calendario con `minmax(0, 1fr)`, controles y etiquetas que pueden envolver, tarjetas laterales apiladas en tablet estrecha, métricas móviles en dos columnas y resumen de progreso en una. En 320 px, las tarjetas de sesiones y accesos rápidos también se apilan. No se modificaron colores, imágenes, tipografía ni lógica de Supabase, datos o migraciones.

## Matriz para la revisión visual

Los valores siguientes se derivan de las reglas CSS y no son mediciones de un navegador. La anchura real puede variar por el scrollbar o el zoom.

| Viewport | Navegación            | Ancho previsto de main                | Dashboard                                                       |
| -------- | --------------------- | ------------------------------------- | --------------------------------------------------------------- |
| 1920 px  | Sidebar de escritorio | 1657 px; contenido limitado a 1420 px | Hero y semana en proporción 1,8:1                               |
| 1440 px  | Sidebar de escritorio | 1177 px                               | Hero y semana en proporción 1,75:1                              |
| 1024 px  | Sidebar               | 780 px                                | Hero y semana en filas; bloque lateral inferior en dos columnas |
| 768 px   | Sidebar               | 524 px                                | Hero y semana en filas; bloque lateral inferior apilado         |
| 390 px   | Navegación inferior   | 390 px                                | Una columna principal; texto y foto del hero separados          |
| 320 px   | Navegación inferior   | 320 px                                | Una columna; tarjetas de sesiones y accesos apilados            |

En cada ancho revisar claro y oscuro, sin cambiar el zoom:

1. Inicio: proporción de tarjetas, margen derecho, imagen y CTA legibles, métricas y calendario compacto.
2. Rutinas: tarjetas, nombres largos, filtros y botones. Abrir detalle, editor y catálogo, manteniendo visible el cierre del modal.
3. Calendario: siete columnas, navegación mensual y etiquetas sin ampliar la página.
4. Progreso: selector, búsqueda, métricas, puntos del gráfico y tablas de series; tocar un punto y revisar el valor exacto.
5. Perfil: nombre/correo largos, objetivos, unidades, selector de tema y botones de cuenta.
6. Ingreso/registro/recuperación: centrado sin margen de sidebar, campos y mensajes dentro del viewport.
7. Confirmar que no haya desplazamiento horizontal de la página ni texto superpuesto. Los nombres largos deben envolver, sin reducir su fuente para hacerlos entrar.

## Verificación realizada

- Suite completa: 56 pruebas aprobadas, incluidos flujos de rutinas, calendario, progreso, perfil, temas, imágenes y la regresión de estructura.
- Build de TypeScript/Vite correcto.
- No se cambiaron datos locales ni recursos remotos para comprobar la corrección.
- La inspección visual en Brave fue detenida por el control automático porque no pudo identificar la URL activa con certeza. La matriz visual de seis anchos, el scroll horizontal y el contraste real siguen pendientes de comprobación en navegador; las pruebas con jsdom no calculan layout.

Para revisar sin modificar una cuenta real, ejecutá `npm.cmd run dev` y abrí `/tests/visual-preview.html` en la dirección que muestre Vite. Esa vista utiliza datos ficticios y un repositorio en memoria. Para revisar Auth, utilizá la raíz de la aplicación sin iniciar sesión; no hace falta enviar formularios para comprobar el responsive.
