/**
 * Passwortableitung -- 1:1 aequivalent zu generate_password() in
 * src/passwort_generator_gui_mit_settings.py.
 *
 * ACHTUNG: Diese Funktion ist ein Kompatibilitaetsvertrag, kein Design.
 * Jede Aenderung invalidiert bereits ausgerollte Geraetepasswoerter. Wer hier
 * etwas anfasst, muss test/run-tests.mjs gruen halten -- die Vektoren stammen
 * aus dem Originaltool.
 */

import { PyRandom } from './pyrandom.js';

const SPECIAL_CHARS = '!@#$%^&*()';
const DIGITS = '0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

/** Python: base64.urlsafe_b64encode(bytes).decode() -- inklusive "="-Padding */
function base64urlFromBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
}

/** Python: int.from_bytes(bytes, 'big') */
function bytesToBigInt(bytes) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

/** Zeichen an Position `pos` ersetzen (Python-Slicing-Aequivalent) */
function replaceAt(str, pos, ch) {
  return str.slice(0, pos) + ch + str.slice(pos + 1);
}

/**
 * @param {string} serial          Seriennummer
 * @param {string} etpId           ETP Identification
 * @param {string} masterPassword  Master-Passwort im Klartext
 * @param {number} length          Passwortlaenge (Original-Default: 16)
 * @returns {Promise<string>}
 */
export async function generatePassword(serial, etpId, masterPassword, length = 16) {
  const combined = `${serial}:${etpId}:${masterPassword}`;
  const hashBytes = await sha256(combined);
  const b64 = base64urlFromBytes(hashBytes);

  const rng = new PyRandom(bytesToBigInt(hashBytes));

  let password = b64.repeat(Math.floor(length / b64.length) + 1).slice(0, length);

  const numSpecials = Math.max(2, Math.floor(length / 8));
  for (let i = 0; i < numSpecials; i++) {
    const pos = rng.randint(0, password.length - 1);
    password = replaceAt(password, pos, rng.choice(SPECIAL_CHARS));
  }

  // Reihenfolge der Zweige ist relevant: jeder verbraucht RNG-Zustand.
  if (!/[0-9]/.test(password)) {
    const pos = rng.randint(0, password.length - 1);
    password = replaceAt(password, pos, rng.choice(DIGITS));
  }
  if (!/[A-Z]/.test(password)) {
    const pos = rng.randint(0, password.length - 1);
    password = replaceAt(password, pos, rng.choice(UPPER));
  }
  if (!/[a-z]/.test(password)) {
    const pos = rng.randint(0, password.length - 1);
    password = replaceAt(password, pos, rng.choice(LOWER));
  }

  return password;
}
