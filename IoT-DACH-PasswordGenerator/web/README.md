# Web-Version — IoT-DACH PanelServer Password Generator

Eine einzige, eigenständige HTML-Datei (`index.html`), die **im Browser
geöffnet** wird — ohne Installation, ohne Erweiterung, ohne EXE. Damit entfällt
sowohl das SentinelOne-Problem (kein PE-Binary) als auch die Chrome-Enterprise-
Sperre für Erweiterungen (es *ist* keine Erweiterung).

## Warum diese Variante

Die Chrome-Erweiterung wird auf verwalteten Firmenlaptops durch die
Enterprise-Richtlinie blockiert (Allowlist-Prinzip: alles nicht ausdrücklich
Freigegebene ist gesperrt). Freigeben kann nur die IT. Eine normale Web-Seite
unterliegt dieser Extension-Richtlinie nicht — sie lässt sich einfach öffnen.

## Kompatibilität — identische Passwörter

`index.html` ist **generiert**, nicht von Hand geschrieben. `web/build.mjs` fügt
die *identischen* Extension-Quellen (`extension/lib/pyrandom.js`,
`extension/lib/derive.js`, `extension/lib/vault.js`) zu einer Datei zusammen.
Es gibt damit **keine** dritte Krypto-Implementierung, die auseinanderdriften
könnte — nur eine Quelle der Wahrheit.

Der Build verifiziert vor dem Schreiben gegen alle 3005 Referenzvektoren
(`extension/test/vectors.json`), dass dieselbe Eingabe dasselbe Gerätepasswort
ergibt wie EXE und Extension. Schlägt das fehl, wird nichts geschrieben.

```bash
node web/build.mjs      # verifiziert + erzeugt web/index.html neu
```

> **Nach jeder Änderung an `extension/lib/*` muss `web/build.mjs` neu laufen**,
> sonst hinkt die Web-Version hinterher. Am besten als CI-Gate mit einlaufen
> lassen (analog zu den Extension-Tests).

## Verwenden

Zwei Wege, technisch gleichwertig:

1. **Datei öffnen (`file://`).** `index.html` doppelklicken oder in Chrome per
   `Datei → Öffnen` laden. Chrome behandelt `file://` als *secure context*,
   daher steht die für Verschlüsselung nötige Web-Crypto-API zur Verfügung.
2. **Intern hosten (`https://`) — empfohlen für den Rollout.** Die Datei auf
   einen internen Webserver oder in SharePoint legen und den Link verteilen.
   Vorteile: garantierter secure context, zentrale Aktualisierung an einer
   Stelle, kein „woher habe ich die Datei"-Wildwuchs. Es ist eine einzelne
   statische Datei ohne Serverlogik.

### Ersteinrichtung (einmalig pro Browser)

Beim ersten Öffnen ist noch kein Tresor eingerichtet. Es werden abgefragt:

- **Master-Passwort** — der Klartextwert, der in die Ableitung eingeht. Das ist
  **derselbe** Wert wie in der Extension. Wer von der EXE kommt, nimmt hier den
  **entschlüsselten** Wert aus `settings.json` (`Fernet.decrypt`), **nicht** den
  Fernet-Key. Siehe Feld-Zuordnungstabelle in der Projekt-`CLAUDE.md`.
- **Passphrase** — schützt nur lokal den Tresor (PBKDF2 + AES-256-GCM). Frei
  wählbar, beeinflusst die erzeugten Gerätepasswörter **nicht**.

Danach: Passphrase eingeben → entsperren → Seriennummer + ETP Identification →
Passwort generieren.

## Speicher- und Sicherheitsmodell

Identisch zur Extension, nur das Backend ist Web-Storage statt `chrome.storage`:

| | Extension | Web |
|---|---|---|
| verschlüsselter Blob (dauerhaft) | `chrome.storage.local` | `localStorage` |
| entsperrtes Master-PW (flüchtig) | `chrome.storage.session` | `sessionStorage` |

`localStorage` hält nur AES-256-GCM-**Ciphertext**; der Schlüssel wird bei jedem
Entsperren per PBKDF2-SHA-256 (600.000 Iterationen) aus der Passphrase abgeleitet
und **nie** gespeichert. Das entsperrte Master-Passwort liegt in `sessionStorage`
— pro Tab, weg beim Schließen des Tabs, nie auf Platte.

Schützt gegen: Auslesen der Profildateien. Schützt **nicht** gegen Schadsoftware
im laufenden Browser oder einen Keylogger — wie bei der Extension.

> **Hinweis zum `file://`-Betrieb:** `localStorage` ist an den *origin* gebunden.
> Bei `file://` teilen sich alle lokalen Dateien denselben origin — der Tresor
> ist also nicht an *diese* Datei gebunden, sondern an „lokale Dateien in diesem
> Browserprofil". Beim Hosten über `https://` ist der Tresor sauber an die
> Host-Domain gebunden. Auch das spricht für die gehostete Variante.

## Verhältnis zu EXE und Extension

Drei Auslieferungsformen, **eine** Ableitungslogik:

- **EXE** (`src/`) — Alt-Weg, SentinelOne-belastet.
- **Extension** (`extension/`) — von der Enterprise-Richtlinie blockiert, bis die
  IT die Store-ID freigibt.
- **Web** (`web/`, diese Datei) — braucht weder Signatur noch Extension-Freigabe.

Wenn diese Variante der Weg wird, sollte — wie in `CLAUDE.md` vermerkt — eine der
beiden anderen stillgelegt werden, damit nicht drei Krypto-Pfade parallel
gepflegt werden. Die Web-Version teilt sich ihre Logik bereits mit der Extension;
das Vektoren-Gate hält beide zusammen.
