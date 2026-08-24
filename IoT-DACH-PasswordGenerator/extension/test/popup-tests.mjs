/**
 * Führt die Popup-Logik ohne Browser aus.
 *
 * popup.js ist die einzige Schicht, die weder von run-tests.mjs noch von
 * vault-tests.mjs berührt wird. Ein reiner ID-Abgleich zwischen HTML und JS
 * würde zwar Tippfehler finden, aber keine Zustandsfehler -- etwa dass eine
 * Ansicht im falschen Zustand sichtbar ist.
 *
 * Der DOM-Ersatz unten ist bewusst minimal: er legt für jede in popup.html
 * vergebene id ein Stub-Element an und merkt sich die registrierten Handler,
 * damit der Test Formulare abschicken und Buttons klicken kann.
 *
 * Aufruf: node test/popup-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const extensionDir = join(here, '..');

// --- DOM-Ersatz -------------------------------------------------------------

const html = readFileSync(join(extensionDir, 'popup.html'), 'utf8');
const ids = [...html.matchAll(/id=["']([^"']+)["']/g)].map((m) => m[1]);

const elements = new Map();
for (const id of ids) {
  elements.set(id, {
    id,
    // Anfangszustand aus dem Markup uebernehmen: steht am Tag ein `hidden`?
    hidden: new RegExp(`id=["']${id}["'][^>]*\\shidden`).test(html),
    value: '',
    textContent: '',
    disabled: false,
    _handlers: {},
    addEventListener(type, fn) { this._handlers[type] = fn; },
    select() {},
    reset() {},
  });
}

globalThis.document = {
  getElementById: (id) => elements.get(id) ?? null,
};

const clipboard = { last: null };
// Node bringt seit v21 ein eigenes `navigator` mit, das nur einen Getter hat --
// deshalb ueberschreiben statt zuweisen.
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { clipboard: { writeText: async (t) => { clipboard.last = t; } } },
});

// --- chrome.storage-Ersatz (in-memory) --------------------------------------

const makeArea = () => {
  const data = {};
  return {
    get: async (k) => (k in data ? { [k]: data[k] } : {}),
    set: async (o) => { Object.assign(data, o); },
    remove: async (k) => { delete data[k]; },
    _raw: data,
  };
};
const storageLocal = makeArea();
const storageSession = makeArea();
globalThis.chrome = { storage: { local: storageLocal, session: storageSession } };

// --- Testhilfen -------------------------------------------------------------

const el = (id) => {
  const e = elements.get(id);
  if (!e) throw new Error(`Element #${id} fehlt in popup.html`);
  return e;
};

async function fire(id, type) {
  const handler = el(id)._handlers[type];
  if (!handler) throw new Error(`#${id} hat keinen ${type}-Handler`);
  await handler({ preventDefault() {} });
  await tick();
}

const tick = () => new Promise((r) => setTimeout(r, 0));

let passed = 0;
let failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.error(`  FAIL ${label}`); }
}

const visible = (id) => el(id).hidden === false;

// --- Ablauf -----------------------------------------------------------------

await import(join(extensionDir, 'popup.js'));
await tick();

console.log('\nZustand 1 - frisch installiert:');
check('Ersteinrichtung sichtbar', visible('view-setup'));
check('Gesperrt-Ansicht verborgen', !visible('view-locked'));
check('Entsperrt-Ansicht verborgen', !visible('view-unlocked'));
check('Zuruecksetzen verborgen (nichts einzurichten)', !visible('view-reset'));

console.log('\nErsteinrichtung - Passphrasen stimmen nicht ueberein:');
el('setup-master').value = '03_Schneider_IOT!';
el('setup-passphrase').value = 'passphrase-a';
el('setup-passphrase-confirm').value = 'passphrase-b';
await fire('form-setup', 'submit');
check('Fehler wird angezeigt', visible('setup-error'));
check('bleibt in Ersteinrichtung', visible('view-setup'));

console.log('\nErsteinrichtung - korrekt:');
el('setup-passphrase').value = 'passphrase-a';
el('setup-passphrase-confirm').value = 'passphrase-a';
await fire('form-setup', 'submit');
check('Tresor ist eingerichtet', !!storageLocal._raw['vault.encryptedMasterPassword']);
check('wechselt in Gesperrt (Passphrase muss bestaetigt werden)', visible('view-locked'));

console.log('\nZustand 2 - gesperrt:');
check('Zuruecksetzen ist JETZT erreichbar', visible('view-reset'));
el('unlock-passphrase').value = 'falsche-passphrase';
await fire('form-unlock', 'submit');
check('falsche Passphrase: Fehler', visible('unlock-error'));
check('falsche Passphrase: bleibt gesperrt', visible('view-locked'));

el('unlock-passphrase').value = 'passphrase-a';
await fire('form-unlock', 'submit');
check('richtige Passphrase entsperrt', visible('view-unlocked'));

console.log('\nZustand 3 - entsperrt:');
el('gen-serial').value = '';
el('gen-etp').value = 'A'.repeat(40);
await fire('form-generate', 'submit');
check('leere Seriennummer wird abgefangen', visible('generate-error'));

el('gen-serial').value = 'SN-0001';
await fire('form-generate', 'submit');
check('Passwort entspricht dem Python-Original',
  el('gen-result').value === '*EFo1m)HzGOcsoOU');

await fire('btn-copy', 'click');
check('Kopieren legt das Passwort in die Zwischenablage',
  clipboard.last === '*EFo1m)HzGOcsoOU');

console.log('\nSperren:');
await fire('btn-lock', 'click');
check('wechselt in Gesperrt', visible('view-locked'));
check('Ergebnisfeld geleert', el('gen-result').value === '');
check('verschluesselter Eintrag bleibt', !!storageLocal._raw['vault.encryptedMasterPassword']);

console.log('\nZuruecksetzen aus dem gesperrten Zustand:');
await fire('btn-reset', 'click');
check('Bestaetigung erscheint', visible('reset-confirm'));
await fire('btn-reset-confirm', 'click');
check('zurueck zur Ersteinrichtung', visible('view-setup'));
check('Eintrag geloescht', !storageLocal._raw['vault.encryptedMasterPassword']);
check('Zuruecksetzen wieder verborgen', !visible('view-reset'));

console.log(`\nTests gesamt: ${passed + failed}, bestanden: ${passed}, fehlgeschlagen: ${failed}`);
process.exit(failed ? 1 : 0);
