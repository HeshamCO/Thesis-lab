#!/usr/bin/env bash
# Export the local SQLite database to a clean snapshot and print upload instructions.
#
# Usage:
#   ./scripts/export-db.sh [--container <name|id>] [--host user@host] [--remote-path /path/on/server]
#
# Examples:
#   ./scripts/export-db.sh --container thesis-lab-app
#   ./scripts/export-db.sh --host deploy@my-server.com --remote-path /data/volumes/thesis/thesis-lab.sqlite

set -euo pipefail

LOCAL_DB="data/thesis-lab.sqlite"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_FILE="data/thesis-lab-export-${TIMESTAMP}.sqlite"

CONTAINER=""
SSH_HOST=""
REMOTE_PATH="/app/data/thesis-lab.sqlite"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--container) CONTAINER="$2"; shift 2 ;;
		--host)      SSH_HOST="$2";  shift 2 ;;
		--remote-path) REMOTE_PATH="$2"; shift 2 ;;
		*) echo "Unknown flag: $1"; exit 1 ;;
	esac
done

if [[ ! -f "$LOCAL_DB" ]]; then
	echo "Error: $LOCAL_DB not found. Run from the project root." >&2
	exit 1
fi

echo "Checkpointing WAL and creating clean snapshot…"
# VACUUM INTO produces a fully-checkpointed, defragmented copy — safe to copy while server runs
sqlite3 "$LOCAL_DB" "VACUUM INTO '${EXPORT_FILE}';"
echo "Snapshot: ${EXPORT_FILE}"

SIZE=$(du -sh "$EXPORT_FILE" | cut -f1)
echo "Size: ${SIZE}"
echo ""

if [[ -n "$CONTAINER" ]]; then
	echo "Uploading to Docker container '${CONTAINER}'…"
	docker cp "${EXPORT_FILE}" "${CONTAINER}:${REMOTE_PATH}"
	echo "Done. Restart the container for the new DB to take effect if the server caches the path."

elif [[ -n "$SSH_HOST" ]]; then
	echo "Uploading via SCP to ${SSH_HOST}:${REMOTE_PATH}…"
	scp "${EXPORT_FILE}" "${SSH_HOST}:${REMOTE_PATH}"
	echo "Done."

else
	echo "No upload target specified. Manual upload instructions:"
	echo ""
	echo "  # Docker container (Dokploy):"
	echo "  docker cp ${EXPORT_FILE} <container-name-or-id>:${REMOTE_PATH}"
	echo ""
	echo "  # SSH / SCP:"
	echo "  scp ${EXPORT_FILE} user@prod-host:${REMOTE_PATH}"
	echo ""
	echo "  # Dokploy file manager:"
	echo "  Upload '${EXPORT_FILE}' to the volume path mapped to /app/data/"
	echo ""
	echo "After upload, restart the container so the server picks up the new file."
fi
