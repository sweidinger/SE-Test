/**
 * vault.js -- sicherer Speicher fuer das Master-Passwort.
 *
 * Bedrohungsmodell
 * -----------------
 * Schuetzt gegen: Auslesen der Chrome-Profildateien. `chrome.storage.local`
 * landet unverschluesselt auf der Platte (LevelDB); jeder mit Dateizugriff auf
 * das Profil -- Backup, gestohlene Festplatte, ein anderes Benutzerkonto mit
 * Leserechten -- koennte es sonst im Klartext lesen. Hier liegt dort nur noch
 * AES-256-GCM-Ciphertext, dessen Schluessel per PBKDF2-SHA-256 (hohe
 * Iterationszahl) aus einer Passphrase abgeleitet wird, die NIRGENDS
 * gespeichert wird. Das entsperrte Master-Passwort liegt ausschliesslich in
 * `chrome.storage.session` -- reiner Arbeitsspeicher, nie auf Platte
 * geschrieben, wird beim Neustart des Browsers verworfen.
 *
 * Schuetzt NICHT gegen: Schadsoftware oder eine boesartige Extension mit
 * Zugriff auf den laufenden Browser-Prozess (kann die Session waehrend sie
 * entsperrt ist mitlesen, oder die Passphrase bei Eingabe per Keylogger
 * abgreifen), noch gegen einen Angreifer, der bereits Code im Kontext dieser
 * Extension ausfuehren kann. Das ist kein Ersatz fuer ein echtes
 * Betriebssystem-Secret-Store, sondern schliesst genau die Luecke des
 * Vorgaengertools.
 *
 * Das Vorgaengertool hat Fernet-Key und verschluesseltes Master-Passwort
 * gemeinsam in einer Klartextdatei abgelegt -- der Schluessel lag also neben
 * dem Schloss, das ist Sicherheitstheater, kein Schutz. Dieses Modul speichert
 * den Schluessel nie: er wird bei jedem Entsperren neu aus der Passphrase
 * abgeleitet und existiert nur fluechtig im Speicher.
 */

/** OWASP-Empfehlung (Stand 2023) fuer PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AES_KEY_BITS = 256;
const VAULT_SCHEMA_VERSION = 1;

const LOCAL_STORAGE_KEY = 'vault.encryptedMasterPassword';
const SESSION_STORAGE_KEY = 'vault.unlockedMasterPassword';

/** @param {Uint8Array} bytes */
function bytesToBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** @param {string} b64 */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Leitet per PBKDF2-SHA-256 einen AES-GCM-Schluessel aus der Passphrase ab. */
async function deriveAesKey(passphrase, salt, iterations) {
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    passphraseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Verschluesselt das Master-Passwort mit frischem Salt und IV.
 * Salt und IV sind nicht geheim und werden zusammen mit dem Ciphertext
 * gespeichert; die Iterationszahl wird mitgespeichert, damit sie spaeter
 * erhoeht werden kann, ohne bereits verschluesselte Eintraege unlesbar zu
 * machen.
 */
async function encryptMasterPassword(masterPassword, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(masterPassword)
  );
  return {
    version: VAULT_SCHEMA_VERSION,
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Entschluesselt einen Vault-Eintrag. Liefert bei falscher Passphrase `null`
 * statt eine Exception zu werfen -- AES-GCM meldet einen falschen Schluessel
 * ueber einen fehlgeschlagenen Auth-Tag, und der Aufrufer soll daraus nicht
 * mehr ableiten koennen (muessen) als "hat nicht geklappt".
 */
async function decryptMasterPassword(entry, passphrase) {
  try {
    const salt = base64ToBytes(entry.salt);
    const iv = base64ToBytes(entry.iv);
    const ciphertext = base64ToBytes(entry.ciphertext);
    const key = await deriveAesKey(passphrase, salt, entry.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

/**
 * Erstellt eine Vault-Instanz gegen ein injizierbares Storage-Backend.
 *
 * @param {{local: object, session: object}} storage  Objekte mit der
 *   `chrome.storage.StorageArea`-Schnittstelle (get/set/remove, Promise-
 *   basiert). `local` haelt den verschluesselten Blob dauerhaft, `session`
 *   haelt das entsperrte Master-Passwort nur fuer die laufende Sitzung.
 */
export function createVault(storage) {
  /** @returns {Promise<object|null>} der gespeicherte Vault-Eintrag oder null */
  async function readVaultEntry() {
    const result = await storage.local.get(LOCAL_STORAGE_KEY);
    return result[LOCAL_STORAGE_KEY] ?? null;
  }

  /**
   * @returns {Promise<boolean>} true, wenn ein verschluesseltes Master-
   *   Passwort hinterlegt ist.
   */
  async function isConfigured() {
    return (await readVaultEntry()) !== null;
  }

  /**
   * Verschluesselt das Master-Passwort mit der Passphrase und speichert es.
   * Ueberschreibt einen eventuell vorhandenen aelteren Eintrag.
   *
   * @param {string} masterPassword
   * @param {string} passphrase
   */
  async function setup(masterPassword, passphrase) {
    const entry = await encryptMasterPassword(masterPassword, passphrase);
    await storage.local.set({ [LOCAL_STORAGE_KEY]: entry });
  }

  /**
   * Entschluesselt das Master-Passwort mit der angegebenen Passphrase. Bei
   * Erfolg wird es in `chrome.storage.session` abgelegt.
   *
   * @param {string} passphrase
   * @returns {Promise<boolean>} true bei Erfolg, false bei falscher
   *   Passphrase oder wenn noch kein Master-Passwort hinterlegt ist.
   */
  async function unlock(passphrase) {
    const entry = await readVaultEntry();
    if (!entry) return false;

    const masterPassword = await decryptMasterPassword(entry, passphrase);
    if (masterPassword === null) return false;

    await storage.session.set({ [SESSION_STORAGE_KEY]: masterPassword });
    return true;
  }

  /** @returns {Promise<boolean>} true, wenn aktuell ein Master-Passwort entsperrt ist. */
  async function isUnlocked() {
    const result = await storage.session.get(SESSION_STORAGE_KEY);
    return result[SESSION_STORAGE_KEY] !== undefined;
  }

  /** @returns {Promise<string|null>} das entsperrte Master-Passwort, oder null. */
  async function getMasterPassword() {
    const result = await storage.session.get(SESSION_STORAGE_KEY);
    return result[SESSION_STORAGE_KEY] ?? null;
  }

  /** Entfernt das entsperrte Master-Passwort aus der Session. Der verschluesselte Eintrag in `local` bleibt unangetastet. */
  async function lock() {
    await storage.session.remove(SESSION_STORAGE_KEY);
  }

  /**
   * Wechselt die Passphrase: entschluesselt mit der alten, verschluesselt
   * das Master-Passwort neu mit der neuen (neuer Salt/IV).
   *
   * @param {string} alt
   * @param {string} neu
   * @returns {Promise<boolean>} true bei Erfolg, false wenn `alt` falsch ist.
   */
  async function changePassphrase(alt, neu) {
    const entry = await readVaultEntry();
    if (!entry) return false;

    const masterPassword = await decryptMasterPassword(entry, alt);
    if (masterPassword === null) return false;

    await setup(masterPassword, neu);
    return true;
  }

  /** Loescht sowohl den verschluesselten Eintrag als auch die entsperrte Session. */
  async function reset() {
    await storage.local.remove(LOCAL_STORAGE_KEY);
    await storage.session.remove(SESSION_STORAGE_KEY);
  }

  return {
    isConfigured,
    setup,
    unlock,
    isUnlocked,
    getMasterPassword,
    lock,
    changePassphrase,
    reset,
  };
}

/**
 * Loest `chrome.storage` erst beim tatsaechlichen Zugriff auf, nicht beim
 * Modul-Import -- so bleibt `vault.js` auch unter Node importierbar (dort
 * gibt es kein globales `chrome`), solange die Default-Instanz nicht
 * tatsaechlich benutzt wird.
 */
const defaultChromeStorage = {
  get local() {
    return chrome.storage.local;
  },
  get session() {
    return chrome.storage.session;
  },
};

export const vault = createVault(defaultChromeStorage);
