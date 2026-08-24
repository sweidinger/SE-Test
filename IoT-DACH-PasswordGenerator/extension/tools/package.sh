#!/usr/bin/env bash
#
# package.sh — baut ein verteilbares ZIP der Chrome-Extension.
#
# Bündelt manifest.json, popup.html/.css/.js, lib/ und icons/ aus dem
# extension/-Verzeichnis in dist/panelserver-pwgen-<version>.zip. Die
# Version wird aus manifest.json (Feld "version") gelesen.
#
# Aufruf funktioniert unabhängig vom aktuellen Arbeitsverzeichnis:
#   ./tools/package.sh
#   /pfad/zu/extension/tools/package.sh
#
set -euo pipefail

# Pfade relativ zum Skript auflösen, nicht relativ zum Aufruf-Cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
EXT_DIR="$(cd "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"
DIST_DIR="${EXT_DIR}/dist"

MANIFEST="${EXT_DIR}/manifest.json"

# Dateien/Verzeichnisse, die ins Paket gehören (relativ zu EXT_DIR).
INCLUDE_FILES=(
  "manifest.json"
  "popup.html"
  "popup.css"
  "popup.js"
)
INCLUDE_DIRS=(
  "lib"
  "icons"
)

fail() {
  echo "Fehler: $1" >&2
  exit 1
}

command -v zip >/dev/null 2>&1 || fail "'zip' ist nicht installiert oder nicht im PATH."

[ -f "${MANIFEST}" ] || fail "manifest.json wurde nicht gefunden unter ${MANIFEST}. Wurde sie schon angelegt?"

for f in "${INCLUDE_FILES[@]}"; do
  [ -f "${EXT_DIR}/${f}" ] || fail "Erwartete Datei fehlt: ${f} (gesucht in ${EXT_DIR})."
done

for d in "${INCLUDE_DIRS[@]}"; do
  [ -d "${EXT_DIR}/${d}" ] || fail "Erwartetes Verzeichnis fehlt: ${d}/ (gesucht in ${EXT_DIR})."
done

for icon in icon-16.png icon-32.png icon-48.png icon-128.png; do
  [ -f "${EXT_DIR}/icons/${icon}" ] || fail "Icon fehlt: icons/${icon}."
done

# Version aus manifest.json lesen (kein grep-Gebastel).
VERSION="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "${MANIFEST}" 2>/dev/null || true)"

if [ -z "${VERSION}" ]; then
  # Fallback, falls python3 nicht verfügbar ist.
  VERSION="$(node -p "require(process.argv[1]).version" "${MANIFEST}" 2>/dev/null || true)"
fi

[ -n "${VERSION}" ] || fail "Konnte 'version' nicht aus manifest.json lesen (weder python3 noch node verfügbar/erfolgreich)."

mkdir -p "${DIST_DIR}"

ZIP_NAME="panelserver-pwgen-${VERSION}.zip"
ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

rm -f "${ZIP_PATH}"

# In einem temporären Staging-Verzeichnis sammeln, damit unerwünschte
# Dateien (test/, tools/, *.md, versteckte Dateien, .DS_Store) garantiert
# draussen bleiben, unabhängig davon, was sonst noch im Baum liegt.
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "${STAGE_DIR}"' EXIT

for f in "${INCLUDE_FILES[@]}"; do
  cp "${EXT_DIR}/${f}" "${STAGE_DIR}/${f}"
done

for d in "${INCLUDE_DIRS[@]}"; do
  mkdir -p "${STAGE_DIR}/${d}"
  # Versteckte Dateien und .DS_Store beim Kopieren aussparen.
  find "${EXT_DIR}/${d}" -type f ! -name ".*" -print0 | while IFS= read -r -d '' src; do
    rel="${src#"${EXT_DIR}/"}"
    dest="${STAGE_DIR}/${rel}"
    mkdir -p "$(dirname "${dest}")"
    cp "${src}" "${dest}"
  done
done

( cd "${STAGE_DIR}" && zip -r -X -q "${ZIP_PATH}" . -x ".*" -x "__MACOSX/*" )

echo "Paket erstellt: ${ZIP_PATH} (Version ${VERSION})"
