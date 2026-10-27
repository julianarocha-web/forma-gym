# Editar rutinas y corregir entrenamientos

## Cómo usarlo

- **Rutinas:** cada tarjeta tiene botones visibles **Editar** y **Eliminar**, además del menú existente. Se pueden usar aunque la rutina ya tenga entrenamientos completados. Editar la plantilla no reescribe sesiones de otras fechas; eliminarla conserva sus registros históricos y pide confirmación.
- **Entrenamiento completado:** desde Inicio o al tocar la fecha en Calendario, elegí **Corregir registro**. Podés cambiar nombre, fecha, cargas, repeticiones, series, duración, distancia y notas según el tipo de ejercicio. **Cancelar** conserva el original; **Guardar corrección** actualiza únicamente esa sesión y sus gráficos. Se mantienen el ID de sesión y los IDs de ejercicios.
- **Eliminar registro:** elegí esa acción y luego **Confirmar eliminación**. Se retira del historial activo, los gráficos y el estado completado del calendario. La plantilla y otras sesiones se conservan. Si existía un plan, vuelve a estar pendiente; si no había plan ni otras sesiones ese día, queda sin registro.
- Para reemplazar la rutina o sus ejercicios en una sesión equivocada, eliminá ese registro y registrá la rutina correcta. Las plantillas se editan desde Rutinas.

No se guardan correcciones automáticamente mientras escribís. Las fechas inválidas, futuras y las que duplican otra finalización de la misma rutina se rechazan. El éxito solo se anuncia después de confirmar el guardado.

## Habilitarlo en una cuenta Supabase existente

La **003 original** habilitó las correcciones. La nueva **`supabase/migrations/202610270004_protect_session_audit.sql`** protege su auditoría sin recrear tablas ni modificar filas.

Para la base existente con 003 instalada, seguí [el procedimiento controlado de actualización](INSTALAR-004.md): comprobá el estado de 001/002/003 y el historial con SQL de solo lectura, guardá la cantidad inicial de auditorías, sincronizá únicamente las versiones ya instaladas que falten en el historial y aplicá solo 004 después del `dry-run` y la confirmación. Después compará cantidades y verificá permisos.

**No vuelvas a ejecutar 001, 002 ni 003** en esa base. La 003 se conserva en su versión histórica original; la 004 cambia únicamente permisos, una política y el contexto de ejecución de la función existente. Si hay un estado distinto al esperado, revisalo antes de continuar; no borres objetos para forzar la instalación.

Después de 004, `forma_session_corrections` conserva una copia privada del antes/después de cada corrección, o del registro retirado. El cliente tiene únicamente lectura propia mediante RLS: no puede insertar auditorías inventadas, modificarlas ni borrarlas. Solo la RPC puede crear una copia, usando un propietario dedicado sin login ni BYPASSRLS que hereda las políticas autenticadas y no puede ser asumido por clientes. Las filas previas se conservan sin certificar retroactivamente las que se pudieron insertar con los permisos antiguos. Las fotos referenciadas por esas copias se conservan. Eliminar toda la cuenta también elimina sus copias.

La función `forma_correct_session` opera con la identidad autenticada, bloquea la revisión del workspace y admite un único registro por operación. Guarda la copia y aplica los cambios en una transacción. Las correcciones repetidas con el mismo identificador no duplican el registro. El guardado normal sigue rechazando alteraciones históricas accidentales al editar rutinas.

Sin 003, la falta de la RPC produce un error explícito y conserva el registro anterior y una copia pendiente. Con 003 antigua, las correcciones funcionan pero el cliente todavía puede insertar auditorías directamente: la protección requiere 004. No se ejecutaron operaciones remotas al preparar esta actualización.

En modo local, las copias de correcciones se conservan en `forma-session-corrections-v1` antes de reemplazar los datos activos. Si no se puede conservar esa copia, la operación falla y mantiene el registro anterior. Estas copias no tienen todavía una pantalla de restauración; las exportaciones actuales incluyen el historial activo. Las copias locales no se importan automáticamente a otra cuenta.

## Verificación

Las pruebas comprueban edición/cancelación, eliminación con confirmación, persistencia al recargar, conservación de plantillas y otros registros, rechazo de fechas duplicadas/futuras y selección de la RPC específica. En PostgreSQL local se prueba la instalación 001 → 002 → 003 → 004 y la actualización de 003 con registros existentes, comparando todas las filas antes/después. También se prueban series corregidas, respaldo privado, aislamiento entre dos usuarios, idempotencia, reversión por error, falsificación rechazada y segunda instalación rechazada. La integración remota requiere ejecutar el procedimiento y luego probar con cuentas exclusivas de prueba.
