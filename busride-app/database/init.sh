#!/bin/bash
# ============================================================
# BusRide — Inicialización idempotente de la BD (resuelve INF-1)
#
# La imagen mcr.microsoft.com/mssql/server NO ejecuta los scripts de
# /docker-entrypoint-initdb.d (ese mecanismo es de postgres/mysql).
# Este script corre DENTRO de un contenedor mssql:
#   - vía el servicio one-shot `sqlserver-init` del docker-compose, o
#   - manualmente: docker exec -i busride_sqlserver bash < database/init.sh
#
# Idempotente: si busride_db ya existe con schema, solo re-aplica los
# stored procedures (CREATE OR ALTER) y no falla.
# NOTA: debe guardarse con finales de línea LF (no CRLF).
# ============================================================
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
# Sin fallback: los secretos vienen del entorno (compose los interpola desde .env)
SA_PASSWORD="${SA_PASSWORD:?SA_PASSWORD es requerido (compose lo toma de busride-app/.env)}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:?APP_DB_PASSWORD es requerido (password del login busride_app; compose lo toma de busride-app/.env)}"
SCRIPTS_DIR="${SCRIPTS_DIR:-/docker-entrypoint-initdb.d}"

# La imagen mssql/server:2022 trae mssql-tools18 (exige -C por TLS autofirmado);
# la imagen mcr.microsoft.com/mssql-tools trae la ruta antigua sin TLS forzado.
if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
    SQLCMD=(/opt/mssql-tools18/bin/sqlcmd -C)
elif [ -x /opt/mssql-tools/bin/sqlcmd ]; then
    SQLCMD=(/opt/mssql-tools/bin/sqlcmd)
else
    echo "ERROR: no se encontró sqlcmd en el contenedor" >&2
    exit 1
fi

# -I: QUOTED_IDENTIFIER ON (los índices espaciales del schema lo exigen)
# -b: terminar con código de error si el script SQL falla
SQLCMD+=(-I -b -S "$DB_HOST" -U sa -P "$SA_PASSWORD")

# Esperar a que SQL Server acepte conexiones (hasta ~90 s)
listo=0
for i in $(seq 1 30); do
    if "${SQLCMD[@]}" -Q "SELECT 1" >/dev/null 2>&1; then
        listo=1
        break
    fi
    echo "Esperando a SQL Server en $DB_HOST ($i/30)..."
    sleep 3
done
if [ "$listo" -ne 1 ]; then
    echo "ERROR: SQL Server no respondió a tiempo" >&2
    exit 1
fi

# 01 — crea busride_db solo si no existe (el .sql ya es idempotente)
echo ">> 01_create_database.sql"
"${SQLCMD[@]}" -i "$SCRIPTS_DIR/01_create_database.sql"

# 02 — el schema usa CREATE TABLE sin IF NOT EXISTS: solo se ejecuta
#      si la BD está vacía (se usa la tabla 'roles' como centinela)
tablas=$("${SQLCMD[@]}" -d busride_db -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables WHERE name = 'roles';" | tr -dc '0-9')
if [ "${tablas:-0}" = "0" ]; then
    echo ">> 02_schema.sql"
    "${SQLCMD[@]}" -i "$SCRIPTS_DIR/02_schema.sql"
else
    echo ">> 02_schema.sql omitido: busride_db ya tiene schema"
fi

# 03 — stored procedures con CREATE OR ALTER: siempre re-aplicables
echo ">> 03_stored_procedures.sql"
"${SQLCMD[@]}" -i "$SCRIPTS_DIR/03_stored_procedures.sql"

# 04 — admin inicial (idempotente: IF NOT EXISTS por email)
echo ">> 04_seed_admin.sql"
"${SQLCMD[@]}" -i "$SCRIPTS_DIR/04_seed_admin.sql"

# 05 — usuario de aplicación busride_app (idempotente; sincroniza la password
#      con APP_DB_PASSWORD, así el mismo script sirve para rotarla)
echo ">> 05_app_user.sql"
"${SQLCMD[@]}" -v APP_DB_PASSWORD="$APP_DB_PASSWORD" -i "$SCRIPTS_DIR/05_app_user.sql"

# 06 — parche debe_cambiar_password + marca del admin seed (idempotente)
echo ">> 06_forzar_cambio_password_admin.sql"
"${SQLCMD[@]}" -i "$SCRIPTS_DIR/06_forzar_cambio_password_admin.sql"

echo "Inicialización de busride_db completada."
