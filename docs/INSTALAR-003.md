# Guía anterior de 003 reemplazada

La versión original de 003 ya está instalada en tu Supabase. **No vuelvas a ejecutarla ni reemplaces su historial con una versión modificada.**

Seguí [INSTALAR-004.md](INSTALAR-004.md): comprobar estado e historial con SQL de solo lectura, guardar la cantidad de auditorías, sincronizar únicamente las versiones instaladas que falten en el historial y aplicar solo la 004 tras revisar el `dry-run` y confirmar.

La 003 se conserva como archivo histórico. La protección de auditorías se instala mediante `202610270004_protect_session_audit.sql`, preservando las filas existentes. La guía anterior que indicaba instalar una 003 protegida dejó de corresponder al estado confirmado de tu proyecto.
