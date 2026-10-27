# Editar rutinas y corregir entrenamientos

## Cómo usarlo

- **Rutinas:** cada tarjeta tiene botones visibles **Editar** y **Eliminar**, además del menú existente. Se pueden usar aunque la rutina ya tenga entrenamientos completados. Editar la plantilla no reescribe sesiones de otras fechas; eliminarla conserva sus registros históricos y pide confirmación.
- **Entrenamiento completado:** desde Inicio o al tocar la fecha en Calendario, elegí **Corregir registro**. Podés cambiar nombre, fecha, cargas, repeticiones, series, duración, distancia y notas según el tipo de ejercicio. **Cancelar** conserva el original; **Guardar corrección** actualiza únicamente esa sesión y sus gráficos. Se mantienen el ID de sesión y los IDs de ejercicios.
- **Eliminar registro:** elegí esa acción y luego **Confirmar eliminación**. Se retira del historial activo, los gráficos y el estado completado del calendario. La plantilla y otras sesiones se conservan. Si existía un plan, vuelve a estar pendiente; si no había plan ni otras sesiones ese día, queda sin registro.
- Para reemplazar la rutina o sus ejercicios en una sesión equivocada, eliminá ese registro y registrá la rutina correcta. Las plantillas se editan desde Rutinas.

No se guardan correcciones automáticamente mientras escribís. Las fechas inválidas, futuras y las que duplican otra finalización de la misma rutina se rechazan. El éxito solo se anuncia después de confirmar el guardado.

## Habilitarlo en una cuenta Supabase existente

Se agregó una migración nueva: **`supabase/migrations/202610270003_session_corrections.sql`**.

1. Abrí el mismo proyecto de Supabase que usa Forma.
2. Entrá en **SQL Editor → New query**.
3. Copiá todo el archivo `202610270003_session_corrections.sql` y ejecutalo una sola vez.
4. Verificá que termine sin errores y luego recargá Forma.

Si ya ejecutaste 001 y 002, **no las vuelvas a ejecutar**. La 003 agrega una tabla y una función; no borra ni corrige entrenamientos durante su instalación. Requiere que la primera migración esté instalada. Si la nueva tabla o función ya existen, conservá el error para revisar el estado antes de repetir la instalación; no borres objetos para forzarla.

La nueva tabla `forma_session_corrections` conserva una copia privada del antes/después de cada corrección, o del registro retirado. Tiene RLS y permisos de lectura/inserción propios; no admite modificación o borrado directo de esas copias desde el cliente. Las fotos referenciadas por esas copias se conservan. Eliminar toda la cuenta también elimina sus copias.

La función `forma_correct_session` opera con la identidad autenticada, bloquea la revisión del workspace y admite un único registro por operación. Guarda la copia y aplica los cambios en una transacción. Las correcciones repetidas con el mismo identificador no duplican el registro. El guardado normal sigue rechazando alteraciones históricas accidentales al editar rutinas.

Hasta aplicar la 003, las nuevas correcciones muestran un error explícito y conservan el registro anterior y una copia pendiente. Después de instalarla, podés reintentar el guardado pendiente. No se ejecutó esta migración en tu proyecto remoto durante la implementación.

En modo local, las copias de correcciones se conservan en `forma-session-corrections-v1` antes de reemplazar los datos activos. Si no se puede conservar esa copia, la operación falla y mantiene el registro anterior. Estas copias no tienen todavía una pantalla de restauración; las exportaciones actuales incluyen el historial activo. Las copias locales no se importan automáticamente a otra cuenta.

## Verificación

Las pruebas comprueban edición/cancelación, eliminación con confirmación, persistencia al recargar, conservación de plantillas y otros registros, rechazo de fechas duplicadas/futuras y selección de la RPC específica. En PostgreSQL local se aplican las tres migraciones y se prueban las series corregidas, respaldo privado, aislamiento entre dos usuarios, idempotencia, reversión por error y orden al volver a registrar después de eliminar una sesión. La integración remota requiere aplicar la migración y repetir los flujos con cuentas de prueba.
