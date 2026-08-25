/**
 * build.mjs -- erzeugt die eigenstaendige Web-Version des Password Generators
 * aus dem bereits getesteten Extension-Code.
 *
 * WARUM GENERIERT STATT VON HAND GESCHRIEBEN
 * ------------------------------------------
 * Die Ableitungslogik (lib/pyrandom.js, lib/derive.js) und der Tresor
 * (lib/vault.js) sind ein Kompatibilitaetsvertrag: dieselbe Eingabe muss
 * ueberall dasselbe Geraetepasswort ergeben, sonst sind ausgerollte Geraete
 * unerreichbar. Eine dritte, handgepflegte Kopie neben EXE und Extension wuerde
 * unweigerlich auseinanderdriften (siehe CLAUDE.md). Deshalb liest dieser Build
 * die *identischen* Extension-Quellen und fuegt sie zu einer einzigen HTML-Datei
 * zusammen -- eine Quelle der Wahrheit, kein zweiter Ort zum Pflegen.
 *
 * Der einzige Unterschied zur Extension ist die Speicherung: statt
 * chrome.storage.local/session tritt localStorage/sessionStorage. Beides mit
 * gleicher Semantik (dauerhaft verschluesselt / fluechtig entsperrt).
 *
 * Nach dem Zusammenbau verifiziert der Build die eingebettete Ableitung gegen
 * alle Referenzvektoren aus extension/test/vectors.json. Schlaegt das fehl,
 * wird keine Datei geschrieben.
 *
 * Aufruf:  node web/build.mjs
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = join(HERE, '..', 'extension');
const OUT = join(HERE, 'index.html');

/** Liest eine Extension-Quelldatei. */
function src(...p) {
  return readFile(join(EXT, ...p), 'utf8');
}

/** Entfernt ES-Modul-Syntax, damit der Code in einem klassischen <script> laeuft. */
function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+/gm, '');
}

/**
 * vault.js endet mit einem chrome-spezifischen Default (defaultChromeStorage +
 * export const vault). Das braucht die Web-Version nicht -- sie instanziiert
 * ihren eigenen Tresor gegen localStorage/sessionStorage. Alles ab dem
 * markierten Kommentarblock wird abgeschnitten.
 */
function vaultCreateOnly(code) {
  const marker = code.indexOf('\n/**\n * Loest');
  return marker === -1 ? code : code.slice(0, marker);
}

async function assembleJs() {
  const pyrandom = stripModuleSyntax(await src('lib', 'pyrandom.js'));
  const derive = stripModuleSyntax(await src('lib', 'derive.js'));
  const vault = stripModuleSyntax(vaultCreateOnly(await src('lib', 'vault.js')));
  const popup = (await src('popup.js'))
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '');

  const adapter = `
// --- Speicher-Adapter: chrome.storage.StorageArea ueber Web-Storage ---------
// local  -> localStorage   (dauerhaft, haelt den verschluesselten Blob)
// session-> sessionStorage (fluechtig, haelt das entsperrte Master-Passwort;
//                           weg beim Schliessen des Tabs -- nie auf Platte)
function webStorageArea(store) {
  return {
    async get(key) {
      const raw = store.getItem(key);
      return raw === null ? {} : { [key]: JSON.parse(raw) };
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) store.setItem(k, JSON.stringify(v));
    },
    async remove(key) {
      store.removeItem(key);
    },
  };
}
const vault = createVault({
  local: webStorageArea(window.localStorage),
  session: webStorageArea(window.sessionStorage),
});
`;

  return [
    '// ==== generiert aus extension/lib/* durch web/build.mjs -- nicht von Hand aendern ====',
    pyrandom.trim(),
    derive.trim(),
    vault.trim(),
    adapter.trim(),
    popup.trim(),
  ].join('\n\n');
}

/** Baut den <body>-Inhalt aus popup.html (ohne <meta>/<title>/<link>/<script>). */
async function assembleBody() {
  const html = await src('popup.html');
  const start = html.indexOf('<div class="app">');
  const end = html.indexOf('<script');
  return html.slice(start, end).trim();
}

async function assembleHtml() {
  const css = await src('popup.css');
  const body = await assembleBody();
  const js = await assembleJs();

  // Fuer eine frei positionierbare Seite (statt eines 380px-Popups) zentrieren
  // wir den 380px-Block; die Popup-CSS bleibt sonst unveraendert.
  const pageCss = `
html { background: var(--bg); }
body { margin: 0 auto; }
`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IoT-DACH PanelServer Password Generator</title>
<style>
${css.trim()}
${pageCss.trim()}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;
}

/**
 * Verifiziert die eingebettete Ableitung gegen alle Referenzvektoren.
 * Schreibt pyrandom+derive als temporaeres Modul und ruft generatePassword
 * genau so auf, wie es im Browser laufen wuerde.
 */
async function verify() {
  const pyrandom = stripModuleSyntax(await src('lib', 'pyrandom.js'));
  const derive = stripModuleSyntax(await src('lib', 'derive.js'));
  const mod = `${pyrandom}\n${derive}\nexport { generatePassword };\n`;

  const dir = await mkdtemp(join(tmpdir(), 'pwgen-web-'));
  const modPath = join(dir, 'bundle.mjs');
  try {
    await writeFile(modPath, mod, 'utf8');
    const { generatePassword } = await import(pathToFileURL(modPath).href);
    const vectors = JSON.parse(await src('test', 'vectors.json'));

    let ok = 0;
    for (const v of vectors) {
      const got = await generatePassword(v.serial, v.etp, v.master, v.length);
      if (got !== v.expected) {
        throw new Error(
          `Vektor-Abweichung:\n  serial=${JSON.stringify(v.serial)} etp=${JSON.stringify(v.etp)} len=${v.length}\n  erwartet ${v.expected}\n  erhalten ${got}`
        );
      }
      ok++;
    }
    return ok;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const passed = await verify();
const html = await assembleHtml();
await writeFile(OUT, html, 'utf8');
console.log(`Verifiziert: ${passed}/${passed} Referenzvektoren identisch.`);
console.log(`Geschrieben: ${OUT}`);
