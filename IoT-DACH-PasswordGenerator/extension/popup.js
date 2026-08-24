import { generatePassword } from './lib/derive.js';
import { vault } from './lib/vault.js';

const views = {
  setup: document.getElementById('view-setup'),
  locked: document.getElementById('view-locked'),
  unlocked: document.getElementById('view-unlocked'),
};

const viewReset = document.getElementById('view-reset');
const globalError = document.getElementById('global-error');

function showView(name) {
  for (const key of Object.keys(views)) {
    views[key].hidden = key !== name;
  }
}

function setText(el, text) {
  el.textContent = text;
}

function showError(el, message) {
  setText(el, message);
  el.hidden = false;
}

function hideError(el) {
  el.hidden = true;
  setText(el, '');
}

function showGlobalError(message) {
  showError(globalError, message);
}

/**
 * Aktuellen Zustand ermitteln und passende Ansicht rendern.
 *
 * Der Zuruecksetzen-Bereich (#view-reset) ist bewusst kein vierter Eintrag in
 * `views`, sondern wird unabhaengig davon ein-/ausgeblendet: Er muss sowohl im
 * gesperrten als auch im entsperrten Zustand erreichbar sein, damit eine
 * vergessene Passphrase nicht in eine Sackgasse fuehrt. Vor der
 * Ersteinrichtung gibt es dagegen noch nichts zum Zuruecksetzen.
 */
async function refresh() {
  hideError(globalError);
  try {
    const configured = await vault.isConfigured();
    viewReset.hidden = !configured;

    if (!configured) {
      showView('setup');
      return;
    }
    const unlocked = await vault.isUnlocked();
    if (!unlocked) {
      showView('locked');
      return;
    }
    showView('unlocked');
  } catch (err) {
    showGlobalError('Der Tresorstatus konnte nicht ermittelt werden.');
  }
}

// --- Zustand 1: Ersteinrichtung -------------------------------------------

const formSetup = document.getElementById('form-setup');
const setupMaster = document.getElementById('setup-master');
const setupPassphrase = document.getElementById('setup-passphrase');
const setupPassphraseConfirm = document.getElementById('setup-passphrase-confirm');
const setupError = document.getElementById('setup-error');

formSetup.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(setupError);

  const master = setupMaster.value;
  const passphrase = setupPassphrase.value;
  const passphraseConfirm = setupPassphraseConfirm.value;

  if (!master.trim()) {
    showError(setupError, 'Bitte ein Master-Passwort eingeben.');
    return;
  }
  if (!passphrase) {
    showError(setupError, 'Bitte eine Passphrase eingeben.');
    return;
  }
  if (passphrase !== passphraseConfirm) {
    showError(setupError, 'Die Passphrasen stimmen nicht überein.');
    return;
  }

  try {
    await vault.setup(master, passphrase);
    formSetup.reset();
    await refresh();
  } catch (err) {
    showError(setupError, 'Einrichtung fehlgeschlagen. Bitte erneut versuchen.');
  }
});

// --- Zustand 2: Gesperrt ---------------------------------------------------

const formUnlock = document.getElementById('form-unlock');
const unlockPassphrase = document.getElementById('unlock-passphrase');
const unlockError = document.getElementById('unlock-error');

formUnlock.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(unlockError);

  const passphrase = unlockPassphrase.value;
  if (!passphrase) {
    showError(unlockError, 'Bitte die Passphrase eingeben.');
    return;
  }

  try {
    const ok = await vault.unlock(passphrase);
    if (!ok) {
      showError(unlockError, 'Passphrase ist falsch.');
      return;
    }
    formUnlock.reset();
    await refresh();
  } catch (err) {
    showError(unlockError, 'Passphrase ist falsch.');
  }
});

// --- Zustand 3: Entsperrt --------------------------------------------------

const formGenerate = document.getElementById('form-generate');
const genSerial = document.getElementById('gen-serial');
const genEtp = document.getElementById('gen-etp');
const generateError = document.getElementById('generate-error');
const genResult = document.getElementById('gen-result');
const btnCopy = document.getElementById('btn-copy');
const copyStatus = document.getElementById('copy-status');
const btnLock = document.getElementById('btn-lock');

formGenerate.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(generateError);
  setText(copyStatus, '');

  const serial = genSerial.value.trim();
  const etpId = genEtp.value.trim();

  if (!serial) {
    showError(generateError, 'Bitte die Seriennummer eingeben.');
    return;
  }
  if (!etpId) {
    showError(generateError, 'Bitte die ETP Identification eingeben.');
    return;
  }

  try {
    const master = await vault.getMasterPassword();
    if (!master) {
      showError(generateError, 'Tresor ist gesperrt. Bitte erneut entsperren.');
      await refresh();
      return;
    }
    const password = await generatePassword(serial, etpId, master);
    genResult.value = password;
    btnCopy.disabled = false;
  } catch (err) {
    showError(generateError, 'Passwort konnte nicht generiert werden.');
  }
});

genResult.addEventListener('click', () => {
  if (genResult.value) {
    genResult.select();
  }
});

btnCopy.addEventListener('click', async () => {
  setText(copyStatus, '');
  if (!genResult.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(genResult.value);
    setText(copyStatus, 'In die Zwischenablage kopiert.');
  } catch (err) {
    setText(copyStatus, 'Kopieren fehlgeschlagen. Bitte manuell markieren und kopieren.');
  }
});

btnLock.addEventListener('click', async () => {
  try {
    await vault.lock();
  } finally {
    genResult.value = '';
    btnCopy.disabled = true;
    setText(copyStatus, '');
    formGenerate.reset();
    await refresh();
  }
});

// --- Einstellungen: Passphrase ändern ---------------------------------------

const formChangePassphrase = document.getElementById('form-change-passphrase');
const changeOld = document.getElementById('change-old');
const changeNew = document.getElementById('change-new');
const changeError = document.getElementById('change-error');
const changeStatus = document.getElementById('change-status');

formChangePassphrase.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(changeError);
  setText(changeStatus, '');

  const oldPassphrase = changeOld.value;
  const newPassphrase = changeNew.value;

  if (!oldPassphrase || !newPassphrase) {
    showError(changeError, 'Bitte beide Felder ausfüllen.');
    return;
  }

  try {
    const ok = await vault.changePassphrase(oldPassphrase, newPassphrase);
    if (!ok) {
      showError(changeError, 'Aktuelle Passphrase ist falsch.');
      return;
    }
    formChangePassphrase.reset();
    setText(changeStatus, 'Passphrase wurde geändert.');
  } catch (err) {
    showError(changeError, 'Passphrase konnte nicht geändert werden.');
  }
});

// --- Zurücksetzen (geteilter Bereich, gesperrt und entsperrt erreichbar) ---

const btnReset = document.getElementById('btn-reset');
const resetConfirm = document.getElementById('reset-confirm');
const btnResetConfirm = document.getElementById('btn-reset-confirm');
const btnResetCancel = document.getElementById('btn-reset-cancel');

btnReset.addEventListener('click', () => {
  resetConfirm.hidden = false;
});

btnResetCancel.addEventListener('click', () => {
  resetConfirm.hidden = true;
});

btnResetConfirm.addEventListener('click', async () => {
  try {
    await vault.reset();
  } finally {
    resetConfirm.hidden = true;
    genResult.value = '';
    btnCopy.disabled = true;
    formGenerate.reset();
    formChangePassphrase.reset();
    setText(changeStatus, '');
    await refresh();
  }
});

refresh();
