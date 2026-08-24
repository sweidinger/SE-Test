/**
 * Tests fuer lib/vault.js -- den sicheren Speicher fuer das Master-Passwort.
 *
 * Nutzt einen In-Memory-Stub fuer `chrome.storage.local`/`chrome.storage.session`
 * (Promise-basierte StorageArea-Schnittstelle), injiziert per `createVault()`.
 * `chrome` selbst wird nicht global gemockt -- vault.js loest `chrome.storage`
 * bewusst lazy auf, genau damit es unter Node ohne `chrome` importierbar ist.
 *
 * Aufruf: node test/vault-tests.mjs
 */

import assert from 'node:assert/strict';
import { createVault } from '../lib/vault.js';

/** Minimaler In-Memory-Nachbau der chrome.storage.StorageArea-API. */
function createStorageAreaStub() {
  let store = {};
  return {
    async get(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const k of keyList) {
        if (k in store) result[k] = store[k];
      }
      return result;
    },
    async set(items) {
      store = { ...store, ...items };
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const next = { ...store };
      for (const k of keyList) delete next[k];
      store = next;
    },
    /** Test-Helfer, kein Teil der chrome-API: liefert den rohen Speicherzustand. */
    _dump() {
      return store;
    },
  };
}

function createTestVault() {
  const local = createStorageAreaStub();
  const session = createStorageAreaStub();
  const vault = createVault({ local, session });
  return { vault, local, session };
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('setup() + unlock() Roundtrip liefert das Master-Passwort zurueck', async () => {
  const { vault } = createTestVault();
  await vault.setup('geheimesMasterPasswort', 'meinePassphrase');

  assert.equal(await vault.isConfigured(), true);
  assert.equal(await vault.isUnlocked(), false);

  const ok = await vault.unlock('meinePassphrase');
  assert.equal(ok, true);
  assert.equal(await vault.isUnlocked(), true);
  assert.equal(await vault.getMasterPassword(), 'geheimesMasterPasswort');
});

test('unlock() mit falscher Passphrase liefert false statt einer Exception', async () => {
  const { vault } = createTestVault();
  await vault.setup('geheimesMasterPasswort', 'richtig');

  const ok = await vault.unlock('falsch');
  assert.equal(ok, false);
  assert.equal(await vault.isUnlocked(), false);
  assert.equal(await vault.getMasterPassword(), null);
});

test('unlock() ohne vorherigen setup() liefert false', async () => {
  const { vault } = createTestVault();
  const ok = await vault.unlock('irgendwas');
  assert.equal(ok, false);
});

test('lock() entfernt das Passwort aus der Session, der local-Blob bleibt', async () => {
  const { vault, local } = createTestVault();
  await vault.setup('geheimesMasterPasswort', 'passphrase');
  await vault.unlock('passphrase');
  assert.equal(await vault.isUnlocked(), true);

  await vault.lock();

  assert.equal(await vault.isUnlocked(), false);
  assert.equal(await vault.getMasterPassword(), null);
  assert.equal(await vault.isConfigured(), true);
  assert.notEqual(Object.keys(local._dump()).length, 0);
});

test('reset() leert local UND session -- isConfigured() wird false', async () => {
  const { vault, local, session } = createTestVault();
  await vault.setup('geheimesMasterPasswort', 'passphrase');
  await vault.unlock('passphrase');

  await vault.reset();

  assert.equal(await vault.isConfigured(), false);
  assert.equal(await vault.isUnlocked(), false);
  assert.deepEqual(local._dump(), {});
  assert.deepEqual(session._dump(), {});
});

test('changePassphrase() funktioniert, alte Passphrase gilt danach nicht mehr', async () => {
  const { vault } = createTestVault();
  await vault.setup('geheimesMasterPasswort', 'alt');

  const ok = await vault.changePassphrase('alt', 'neu');
  assert.equal(ok, true);

  assert.equal(await vault.unlock('alt'), false);
  const unlocked = await vault.unlock('neu');
  assert.equal(unlocked, true);
  assert.equal(await vault.getMasterPassword(), 'geheimesMasterPasswort');
});

test('changePassphrase() mit falscher alter Passphrase liefert false und aendert nichts', async () => {
  const { vault } = createTestVault();
  await vault.setup('geheimesMasterPasswort', 'richtig');

  const ok = await vault.changePassphrase('falsch', 'neu');
  assert.equal(ok, false);

  // Alte Passphrase muss weiterhin funktionieren.
  assert.equal(await vault.unlock('richtig'), true);
});

test('im local-Storage taucht das Master-Passwort nirgends im Klartext auf', async () => {
  const { vault, local } = createTestVault();
  const masterPassword = 'SuperGeheimesPanelServerPasswort#42';
  await vault.setup(masterPassword, 'egal-welche-passphrase');

  const serialized = JSON.stringify(local._dump());
  assert.equal(serialized.includes(masterPassword), false);

  // Auch die Passphrase selbst darf nicht im gespeicherten Blob stehen.
  assert.equal(serialized.includes('egal-welche-passphrase'), false);
});

test('zwei setup()-Aufrufe mit gleichem Input erzeugen unterschiedliche Ciphertexts', async () => {
  const { vault: vaultA, local: localA } = createTestVault();
  const { vault: vaultB, local: localB } = createTestVault();

  await vaultA.setup('gleichesPasswort', 'gleichePassphrase');
  await vaultB.setup('gleichesPasswort', 'gleichePassphrase');

  const entryA = localA._dump()['vault.encryptedMasterPassword'];
  const entryB = localB._dump()['vault.encryptedMasterPassword'];

  assert.notEqual(entryA.salt, entryB.salt);
  assert.notEqual(entryA.iv, entryB.iv);
  assert.notEqual(entryA.ciphertext, entryB.ciphertext);

  // Beide muessen trotzdem korrekt entschluesselbar bleiben.
  assert.equal(await vaultA.unlock('gleichePassphrase'), true);
  assert.equal(await vaultA.getMasterPassword(), 'gleichesPasswort');
});

let ok = 0;
const failures = [];

for (const { name, fn } of tests) {
  try {
    await fn();
    ok++;
  } catch (err) {
    failures.push({ name, err });
  }
}

console.log(`Tests gesamt : ${tests.length}`);
console.log(`bestanden    : ${ok}`);
console.log(`fehlgeschlagen: ${tests.length - ok}`);

if (failures.length) {
  console.error('\nFehlgeschlagene Tests:');
  for (const { name, err } of failures) {
    console.error(`  - ${name}`);
    console.error(`    ${err.stack ?? err}`);
  }
  process.exit(1);
}

console.log('\nOK - vault.js verhaelt sich wie spezifiziert.');
