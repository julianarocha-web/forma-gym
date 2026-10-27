# Actualizar la auditoría: 003 original → 004 protegida

Este procedimiento corresponde al estado remoto que confirmaste: tabla y función de 003 existentes, `own_select`/`own_insert`, permiso `INSERT` para `authenticated`, función `SECURITY INVOKER` y ningún rol `forma_session_corrector`. **No se ejecutaron operaciones remotas al preparar estos archivos.**

La [003 original](../supabase/migrations/202610270003_session_corrections.sql) se conserva sin cambios respecto de la versión histórica del repositorio. La protección está exclusivamente en [202610270004_protect_session_audit.sql](../supabase/migrations/202610270004_protect_session_audit.sql). No vuelvas a ejecutar 001, 002 ni 003 en tu base existente.

## 1. Comprobar el estado y guardar la cantidad inicial

1. Abrí el proyecto de Forma. en Supabase y compará su **Project Reference** con el proyecto de `VITE_SUPABASE_URL` en `.env.local`. No compartas claves.
2. Coordiná un intervalo sin nuevas correcciones ni otros cambios en la app, incluyendo otras sesiones/usuarios. Mantenelo hasta terminar la comprobación posterior. Esto permite comparar las cantidades sin confundir nuevas auditorías legítimas con cambios de la instalación.
3. En **SQL Editor → New query**, usá el rol administrativo **postgres** y ejecutá todo [before_004.sql](../supabase/checks/before_004.sql).
4. Debe devolver **`OK: requisitos de 001/002 y 003 original verificados; preparar solo 004`** y una fila con **`auditorias_antes`**. Anotá ese número exacto, incluso si es cero.
5. Ejecutá [migration_history.sql](../supabase/checks/migration_history.sql). Guardá los resultados y los mensajes **REMOTE** de la pestaña de mensajes/avisos. La ausencia de historial es posible si instalaste los SQL manualmente; no implica que las tablas estén ausentes.

Son consultas en transacciones de **solo lectura**, terminadas con `ROLLBACK`. Comprueban los requisitos esenciales de 001/002, los 17 ejercicios compartidos, la versión original de la función 003, sus permisos/políticas y la ausencia del rol de 004. También revisan que 004 no esté registrada como aplicada. No son una comparación completa de todos los índices/columnas ni de las políticas Storage ajenas a Forma.

**Si aparece `STOP`, no avances ni repares el historial.** Conservá el error para revisar la diferencia. No borres objetos ni vuelvas a ejecutar migraciones anteriores para resolverla. Si una consulta fallida deja la transacción abortada, ejecutá `ROLLBACK;`; solo cierra esa transacción.

## 2. Preparar y vincular la CLI local

Si ya tenés la CLI instalada localmente, omití la instalación. Desde PowerShell, dentro del proyecto:

```powershell
npm.cmd install --save-dev --save-exact supabase --cache .npm-cache
npx.cmd --no-install supabase --version
```

Requiere Node 20 o posterior. No hace falta `supabase init`, Docker ni una base local para este procedimiento remoto. La instalación fija la versión local en `package.json`/`package-lock.json`.

Usá variables de esta terminal para las credenciales administrativas; no las pongas en `.env.local` ni como argumentos visibles. El token es un **Personal Access Token** de tu cuenta Supabase y la contraseña es la de PostgreSQL de este proyecto:

```powershell
$tokenSeguro = Read-Host 'Personal Access Token de Supabase' -AsSecureString
$env:SUPABASE_ACCESS_TOKEN = [System.Net.NetworkCredential]::new('', $tokenSeguro).Password
$claveSegura = Read-Host 'Contraseña PostgreSQL del proyecto' -AsSecureString
$env:SUPABASE_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $claveSegura).Password
npx.cmd --no-install supabase link --project-ref TU_PROJECT_REFERENCE
npx.cmd --no-install supabase migration list --linked
```

Reemplazá `TU_PROJECT_REFERENCE`. No uses `--debug` ni compartas tokens/contraseñas. La vinculación guarda metadatos dentro de `supabase/.temp`, ignorado por Git.

## 3. Sincronizar únicamente el historial que falte

Compará LOCAL y REMOTE. Como ya comprobaste el esquema instalado, **001, 002 y 003 deben quedar registradas como aplicadas**, sin ejecutar sus SQL otra vez.

- Si las tres aparecen en REMOTE, no ejecutes `repair`.
- Si falta alguna, pasá a `repair` **solo las versiones ausentes y ya verificadas**.
- Si faltan las tres, el comando es:

```powershell
npx.cmd --no-install supabase migration repair 202610270001 202610270002 202610270003 --status applied --linked
npx.cmd --no-install supabase migration list --linked
```

Si falta solo 003, por ejemplo:

```powershell
npx.cmd --no-install supabase migration repair 202610270003 --status applied --linked
```

`repair --status applied` registra el historial sin ejecutar los archivos SQL. **No marques 004 como aplicada anticipadamente.** Si hay versiones remotas sin archivo local, o 004 ya figura aplicada con permisos antiguos, detenete y revisá esa discrepancia. No uses `--status reverted` para forzar el avance. [Referencia oficial de migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair).

## 4. Dry-run y confirmación antes de instalar

Revisá la 004 y ejecutá:

```powershell
npx.cmd --no-install supabase db push --linked --dry-run
```

**Debe proponer exclusivamente `202610270004_protect_session_audit.sql`.** Si propone 001/002/003 u otra migración, no continúes. No uses `--include-all`, `--include-roles`, `--include-seed` ni `--yes`.

Antes del comando real, confirmá que:

1. El proyecto vinculado es el correcto.
2. El prechequeo pasó y anotaste `auditorias_antes`.
3. 001/002/003 figuran en ambos lados del historial y solo 004 está pendiente.
4. No hay escrituras nuevas ni otro operador instalando simultáneamente.

Solo después de esa revisión, ejecutá este bloque de confirmación explícita:

```powershell
$confirmacion004 = Read-Host 'Para instalar únicamente 004, escribí APLICAR SOLO 004'
if ($confirmacion004 -ceq 'APLICAR SOLO 004') {
    npx.cmd --no-install supabase db push --linked
} else {
    Write-Host 'Instalación cancelada. No se ejecutó db push.'
}
```

Revisá también cualquier lista/confirmación que presente la CLI. El `dry-run` no aplica migraciones; el comando real registra la 004 tras instalarla correctamente. No ejecutes además la 004 desde SQL Editor. [Referencia oficial de db push](https://supabase.com/docs/reference/cli/supabase-db-push).

La actualización es una transacción de cambios de permisos/metadatos. Bloquea temporalmente las escrituras sobre la tabla de auditoría, cuenta sus filas, cambia la política existente con `ALTER POLICY`, conserva la misma función y comprueba nuevamente la cantidad. Emite un aviso **`FORMA004: auditorias antes=N, despues=N`**. No crea de nuevo la tabla ni ejecuta la función de corrección, y no contiene operaciones de modificación de filas.

Si falla o se pierde la conexión, **no repitas a ciegas**: consultá el historial y el estado protegido. Una transacción fallida se revierte; un éxito cuya respuesta se perdió puede estar ya instalado. La 004 rechaza deliberadamente una segunda instalación o una versión diferente de la función. No borres objetos para saltear ese rechazo.

## 5. Verificar cantidad, permisos e historial

Antes de reabrir la app o ejecutar pruebas que generen nuevas auditorías:

1. Copiá [after_004.sql](../supabase/checks/after_004.sql) a una nueva consulta en SQL Editor, rol **postgres**.
2. En esa copia, reemplazá **solo** `null` en `expected_audit_count bigint := null;` por el número exacto `auditorias_antes` que anotaste. Por ejemplo, si eran 12: `expected_audit_count bigint := 12;`.
3. Ejecutá toda la consulta. Si dejás `null` o las cantidades no coinciden, se detiene con `STOP`.
4. Debe devolver **`OK: 004 protegida; cantidad de auditorias conservada; RPC y RLS verificados`**, `auditorias_despues` igual al valor anterior y las políticas `own_select` / `server_insert`.
5. Ejecutá nuevamente `migration_history.sql` y estos comandos:

```powershell
npx.cmd --no-install supabase migration list --linked
npx.cmd --no-install supabase db push --linked --dry-run
```

Las **cuatro** versiones deben aparecer en LOCAL y REMOTE. El `dry-run` final no debe proponer migraciones. Guardá la comparación de cantidades y estos resultados. Si hubo actividad concurrente y las cantidades difieren, revisá las nuevas acciones; no elimines auditorías ni reinstales la migración. Después de nuevas correcciones legítimas, la cantidad crecerá: no reutilices una cantidad antigua para una comparación posterior.

## 6. Prueba funcional posterior, opcional y separada de la instalación

Terminada la comparación de cantidades, podés usar dos cuentas vacías exclusivas de prueba. No cambies las políticas ni desactives la confirmación por email para probar. Email/password debe estar habilitado y las cuentas deben tener su email confirmado.

```powershell
$env:FORMA_TEST_EMAIL_A = Read-Host 'Email de prueba A'
$passwordSeguroA = Read-Host 'Contraseña de prueba A' -AsSecureString
$env:FORMA_TEST_PASSWORD_A = [System.Net.NetworkCredential]::new('', $passwordSeguroA).Password
$env:FORMA_TEST_EMAIL_B = Read-Host 'Email de prueba B'
$passwordSeguroB = Read-Host 'Contraseña de prueba B' -AsSecureString
$env:FORMA_TEST_PASSWORD_B = [System.Net.NetworkCredential]::new('', $passwordSeguroB).Password
$env:FORMA_ALLOW_AUDIT_TEST_WRITES = 'yes'
node scripts/corrections-smoke.mjs
```

El script usa URL y clave pública de `.env.local`. Comprueba inserción inventada rechazada, una corrección real con sus valores antes/después, idempotencia y aislamiento A/B/anon. Conserva el ejercicio, la rutina, el entrenamiento y la auditoría sintéticos, incluso ante un fallo; no realiza limpiezas ni elimina usuarios. No usa claves administrativas. No ejecutes `scripts/security-smoke.mjs` para este procedimiento: ese script anterior sí contiene limpieza de datos temporales. Cerrá la terminal al terminar para descartar las credenciales en memoria.

## Conservación y alcance de la protección

La 004 conserva **todas las auditorías anteriores**, incluidas las que pudieran haberse insertado directamente con los permisos antiguos. No las reescribe ni les atribuye una autenticidad retroactiva que no puede demostrar. Desde la actualización, los clientes solo pueden leer sus propias auditorías y la RPC genera los nuevos registros a partir de la sesión del servidor.

La función conserva su cuerpo, firma y OID. Pasa a `SECURITY DEFINER` con un propietario dedicado sin login ni BYPASSRLS que hereda RLS de `authenticated`. El cliente no puede asumir ese rol; `search_path` permanece vacío y `row_security=on`. Las funciones originales de 001 no cambian.

Se prueban localmente dos escenarios: instalación nueva **001 → 002 → 003 → 004**, y actualización de 003 con perfiles, rutinas, ejercicios, sesiones y auditorías ya existentes. En el segundo se comparan íntegramente las filas de todas las tablas `forma_*` antes/después, además de la cantidad de auditorías. También se prueba el rechazo de falsificación, las correcciones válidas, RLS, idempotencia y la segunda instalación rechazada. Estas pruebas no certifican la ejecución remota: esa verificación corresponde a los pasos anteriores.
