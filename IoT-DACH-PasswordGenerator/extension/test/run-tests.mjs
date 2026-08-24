/**
 * Regressionsgatter fuer die Passwortableitung.
 *
 * Vergleicht die JS-Implementierung gegen Vektoren, die mit der Originalfunktion
 * aus src/passwort_generator_gui_mit_settings.py erzeugt wurden. Schlaegt das
 * hier fehl, wuerden im Feld stehende Geraete unerreichbar -- der Fehler ist
 * niemals "die Tests anpassen".
 *
 * Neue Vektoren erzeugen: python3 tools/gen_vectors.py 3000 test/vectors.json
 *
 * Aufruf: node test/run-tests.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generatePassword } from '../lib/derive.js';

const here = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(join(here, 'vectors.json'), 'utf8'));

let ok = 0;
const failures = [];
const branchCoverage = {};

for (const v of vectors) {
  for (const b of v.branches ?? []) {
    branchCoverage[b] = (branchCoverage[b] ?? 0) + 1;
  }
  const got = await generatePassword(v.serial, v.etp, v.master, v.length);
  if (got === v.expected) {
    ok++;
  } else if (failures.length < 5) {
    failures.push({ ...v, got });
  }
}

console.log(`Vektoren geprueft : ${vectors.length}`);
console.log(`identisch         : ${ok}`);
console.log(`abweichend        : ${vectors.length - ok}`);
console.log(`Fallback-Zweige   : ${JSON.stringify(branchCoverage)}`);

if (failures.length) {
  console.error('\nAbweichungen (max. 5):');
  for (const f of failures) {
    console.error(`  serial=${JSON.stringify(f.serial.slice(0, 24))} length=${f.length}`);
    console.error(`    erwartet (Python): ${f.expected}`);
    console.error(`    erhalten (JS)    : ${f.got}`);
  }
  process.exit(1);
}

console.log('\nOK - JS-Ableitung ist deckungsgleich mit dem Python-Original.');
