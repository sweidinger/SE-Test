# IoT-DACH PanelServer Password Generator

Internes Tool zur **deterministischen Ableitung von Gerätepasswörtern** für Schneider
EcoStruxure Panel Server. Aus Seriennummer + ETP-ID + einem geheimen Master-Passwort
wird reproduzierbar dasselbe Gerätepasswort erzeugt — dieselbe Eingabe ergibt immer
dieselbe Ausgabe, damit der Service ein Gerätepasswort jederzeit rekonstruieren kann,
ohne es irgendwo speichern zu müssen.

## Aktuelle Aufgabe

**Ausgangsproblem:** SentinelOne stuft die Windows-EXE wiederholt als Schadsoftware ein
und löscht sie auf den Firmenlaptops (False Positive). Zwei Stränge verfolgt:

1. **EXE gehärtet** (`--onedir` + Metadaten) — entschärft, aber nicht die Wurzel.
   Details: siehe [SentinelOne](#sentinelone-false-positive).
2. **Chrome-Erweiterung als Ersatz** (`extension/`) — löst es an der Wurzel, weil es
   kein PE-Binary mehr gibt. **Das ist der eingeschlagene Weg.** Stand: siehe
   [Chrome Web Store](#chrome-web-store-veröffentlichung).

**Aktueller Fokus:** Die Extension wird als **öffentlicher** Eintrag im Chrome Web
Store veröffentlicht (Entscheidung des Nutzers, trotz des Hinweises unten zur
Offenlegung des Algorithmus). Listing ist in Arbeit.

## Struktur

```
IoT-DACH-PasswordGenerator/
├── src/
│   ├── passwort_generator_gui_mit_settings.py  ← AKTUELLE HAUPTVERSION (Tkinter-GUI)
│   ├── passwort_generator_with_etp_id.py        Konsolenvariante derselben Logik
│   └── encrypt_master_password.py               Helfer: Fernet-Key + Master-PW verschlüsseln
├── assets/
│   ├── SE-Icon.ico                              App-Icon (auch für macOS/Linux via Pillow)
│   └── version_info.txt                         PE-Versionsressource für den Windows-Build
├── dist/windows/                                gebaute EXEn (eingecheckt)
├── dist/macos/                                  gebauter macOS-Build
├── extension/                                   Chrome-Erweiterung (MV3) — s. u.
├── ios/                                         SwiftUI-App + TestFlight-Setup
├── scripts/setup-testflight.sh                  interaktiver TestFlight-Helfer
├── legacy/SE-PWD-GEN/                           Vorgängerversionen, NICHT verwenden (s.u.)
└── README.md                                    Anwenderdoku
```

Die CI-Workflows liegen weiterhin unter `../.github/workflows/` — GitHub Actions
akzeptiert Workflows **ausschließlich** im Repo-Root, sie können nicht mit in diesen
Ordner. Ihre Pfade zeigen auf `IoT-DACH-PasswordGenerator/…`; bei Umbenennung dieses
Ordners müssen `build.yml` und `build-ios.yml` mit angepasst werden.

## Entwickeln

```bash
pip install -r requirements.txt
python src/passwort_generator_gui_mit_settings.py
```

Lokaler Build — muss die Flags der CI spiegeln, sonst testet man etwas anderes,
als ausgeliefert wird:

```bash
pyinstaller --onedir --windowed --noupx \
  --name PanelServerPasswordGenerator \
  --icon=assets/SE-Icon.ico \
  --version-file=assets/version_info.txt \    # nur unter Windows wirksam
  src/passwort_generator_gui_mit_settings.py
```

Ergebnis ist ein **Ordner** `dist/PanelServerPasswordGenerator/`, nicht mehr eine
einzelne EXE.

> ⚠️ **Offener Punkt vor dem Rollout:** `SETTINGS_FILE = "settings.json"` ist ein
> relativer Pfad und wird damit gegen das **Arbeitsverzeichnis** aufgelöst, nicht
> gegen den EXE-Ordner. Beim Doppelklick im Explorer fällt das zusammen, bei Start
> über eine Verknüpfung mit abweichendem „Ausführen in" nicht. Sobald die Anwendung
> wie geplant nach `C:\Program Files\…` installiert wird, kommt hinzu, dass dieser
> Pfad für normale Benutzer **nicht schreibbar** ist — „Einstellungen speichern"
> schlägt dann fehl. Richtig wäre `%LOCALAPPDATA%\PanelServerPasswordGenerator\
> settings.json`. Das ist zu ändern, *bevor* auf eine Installation nach Program
> Files umgestellt wird.

## Chrome-Erweiterung (`extension/`)

Manifest V3, vollständig offline, einzige Berechtigung `storage`. Sie ist der
geplante Ersatz für die Windows-EXE: Es gibt kein PE-Binary mehr, damit entfällt
das SentinelOne-Problem an der Wurzel statt es zu entschärfen. Zwangsinstalliert
per Richtlinie kann sie zudem nicht mehr von den Geräten verschwinden.

```
extension/
├── manifest.json
├── popup.html / popup.css / popup.js    Oberfläche (deutschsprachig)
├── lib/pyrandom.js                      CPython-Mersenne-Twister, bit-genau
├── lib/derive.js                        Ableitung, äquivalent zum Python-Original
├── lib/vault.js                         Master-Passwort: PBKDF2 + AES-256-GCM
├── manifest.json                        MV3, nur Berechtigung "storage"
├── icons/icon-{16,32,48,128}.png        neutrales Schlüsselloch-Icon (KEINE Fremdmarke)
├── test/vectors.json                    3005 Referenzvektoren aus dem Original
├── test/run-tests.mjs                   Regressionsgatter der Ableitung
├── test/vault-tests.mjs                 Tests des Tresors
├── test/popup-tests.mjs                 Popup-Logik gegen DOM-Ersatz (22 Fälle)
├── tools/gen_vectors.py                 erzeugt vectors.json aus der Originalfunktion
├── tools/package.sh                     baut dist/panelserver-pwgen-<version>.zip
├── tools/update.xml.template            Update-Manifest für Self-Hosting (ungenutzt, s.u.)
└── DEPLOYMENT.md                        Verteilwege (Store/Self-Hosting/OU-Zuweisung)
```

Tests (brauchen nur Node, keine Abhängigkeiten):

```bash
cd extension
node test/run-tests.mjs      # Ableitung gegen die Referenzvektoren (3005/3005)
node test/vault-tests.mjs    # Tresor (9/9)
node test/popup-tests.mjs    # Popup-Ablauf: Einrichtung/Entsperren/Erzeugen/Sperren/Reset (22/22)
```

Das **Icon** wurde bewusst neu erzeugt (`tools/`-Skript im Scratchpad war einmalig):
ein neutrales weißes Schlüsselloch auf dunkelblauem Grund. Das offizielle
Schneider-Electric-Logo wird **nicht** verwendet — Markenschutz, zumal der öffentliche
Store-Eintrag unter einem privaten Konto läuft. Quelle `assets/SE-Icon.ico` enthält nur
32×32; für ein scharfes 128er wäre eine hochauflösende Grafik nötig.

### Der Kompatibilitätsvertrag

`lib/derive.js` und `lib/pyrandom.js` sind **kein Neuentwurf, sondern eine
Nachbildung**. Die Ableitung hängt an CPythons Mersenne Twister — `random.seed()`,
`randint()`, `choice()`. Ein naiver JS-Nachbau erzeugt andere Passwörter, und
damit wären alle im Feld stehenden Geräte unerreichbar.

`test/vectors.json` enthält 3005 mit der Originalfunktion erzeugte Vektoren
(inklusive aller drei Fallback-Zweige, Unicode, Leerstrings, verschiedene
Längen). **Schlägt `run-tests.mjs` fehl, ist niemals der Test das Problem.**

Neue Vektoren: `python3 tools/gen_vectors.py 3000 test/vectors.json`

Verifiziert wurde außerdem, dass `_randbelow`/`randrange`/`choice` zwischen
CPython 3.9 (Zielversion der EXE) und 3.14 identisch sind — lokal erzeugte
Vektoren gelten also auch für die ausgelieferte Python-Version.

### Sicherheitsmodell des Tresors

Das Master-Passwort liegt AES-256-GCM-verschlüsselt in `chrome.storage.local`;
der Schlüssel wird per PBKDF2-SHA-256 (600.000 Iterationen, ~50 ms) aus einer
Passphrase abgeleitet, die nirgends gespeichert wird. Das entsperrte Passwort
liegt ausschließlich in `chrome.storage.session` — reiner Speicher, nie auf
Platte, weg beim Browser-Neustart.

Das schützt gegen das Auslesen der Profildateien. Es schützt **nicht** gegen
Schadsoftware im laufenden Browser oder einen Keylogger. Es ist damit deutlich
besser als das Vorgängerverfahren, wo Fernet-Key und Token gemeinsam in einer
Klartextdatei lagen — der Schlüssel lag neben dem Schloss.

> ⚠️ **Offen vor dem Produktivgang:** ein Abgleich gegen ein real ausgerolltes
> Gerätepasswort. Die Vektoren beweisen, dass JS und Python identisch rechnen —
> nicht, dass in der Praxis dasselbe Master-Passwort verwendet wurde.

> ⚠️ **Zwei Implementierungen derselben Krypto driften auseinander.** Entweder
> die Extension wird die einzige Quelle und die EXE wird stillgelegt, oder beide
> bekommen die Vektoren als CI-Gate. „Einfach beide pflegen" ist keine Option.

### Feld-Zuordnung EXE ↔ Extension (Stolperfalle)

Die Einstellungsfelder heißen unterschiedlich und bedeuten **nicht** dasselbe. In die
Ableitung geht in beiden Versionen nur der **Klartext des Master-Passworts** ein.

| EXE (`settings.json`) | Extension | Bedeutung |
|---|---|---|
| `fernet_key` + `encrypted_master` | — | zusammen ergeben sie den Klartext (`Fernet.decrypt`) |
| (Ergebnis der Entschlüsselung) | **Master-Passwort** | **direkt** der Klartext, der in die Ableitung geht |
| — | **Passphrase** | NEU, nur lokaler Tresorschutz (PBKDF2). Beeinflusst die erzeugten Passwörter **nicht**, frei wählbar. |

Für passwortkompatiblen Umstieg gilt: In das Extension-Feld „Master-Passwort" gehört der
**entschlüsselte** Wert aus `settings.json`, **nicht** der Fernet-Key und nicht der Token.

Den Klartext gewinnt man aus `settings.json`:

```python
from cryptography.fernet import Fernet; import json
d = json.load(open("settings.json"))
print(Fernet(d["fernet_key"].encode()).decrypt(d["encrypted_master"].encode()).decode())
```

> Der Klartextwert steht **bewusst nicht in dieser Datei** — CLAUDE.md ist im Git.
> Verifiziert (Test SN-TESTGERAET-01): EXE-Logik und Extension liefern mit demselben
> Klartext-Master dasselbe Gerätepasswort. Damit ist der Umstieg passwortkompatibel.

## Chrome Web Store — Veröffentlichung

**Sichtbarkeit: öffentlich** (Nutzerentscheidung). Publisher ist derzeit ein
**privates** Google-Konto (`sweidinger03…@gmail.com`), nicht ein Firmenkonto.

- **Store-Item-ID:** `mjilpihhhiidgbjkjojaalnmgiabgmip` — von Google beim ZIP-Upload
  vergeben. Das ist die maßgebliche ID (für spätere Force-Install/Allowlist).
- Die lokal per `chrome --pack-extension` erzeugte CRX hatte eine **andere** ID
  (`jhpbeibpkhpmfdpnjkjnlilnhgkfjjab`). Für den Store-Weg **irrelevant** — die dabei
  entstandene `.pem` wird nicht gebraucht (Google signiert selbst).
- **Datenschutz-URL** (Pflicht): öffentlicher Gist,
  `https://gist.github.com/sweidinger/1768d98e330a9d03432fb950d5aff6d8`
- **Screenshots:** `Screenshots/store/store_{1,2,3}.png` — auf 1280×800, 24-Bit-PNG
  ohne Alpha gebracht (Store-Vorgabe). Originale liegen in `Screenshots/`.
- **Listing-Pflichtangaben** (remote code = **Nein**, `storage`-Begründung,
  Beschreibungstexte, Kategorie „Workflow-Planung", Sprache Deutsch) wurden im Chat
  geliefert; Manifest-`description` musste auf ≤132 Zeichen gekürzt werden.

> ⚠️ **EU-DSA-Trader-Pflicht:** Ein öffentlicher Eintrag verlangt Trader-Angaben
> (Firmenname, Adresse, Telefon), die **öffentlich am Listing** erscheinen. Am
> privaten Konto hingen sie an einer Privatperson. Vor endgültigem Einreichen mit dem
> Haus klären → besser Firmenkonto.

> ⚠️ **Verteilung ist keine Zugriffskontrolle.** Ohne das Master-Passwort erzeugt die
> Extension nichts. Der sicherheitskritische Schritt ist die Weitergabe des
> Master-Passworts an den berechtigten Personenkreis — nicht der Store-Eintrag.
> Details/Verteilwege: `extension/DEPLOYMENT.md`.

### 🔴 Rotation vor dem Öffentlich-Gehen (offen, wichtig)

Mit dem öffentlichen Eintrag wird der **Ableitungscode weltweit lesbar**. Danach hängt
die Sicherheit *aller* Geräte nur noch am Master-Passwort. Wer ein einziges
Gerätepasswort kennt (Seriennummer/ETP-ID stehen oft am Gerät), kann es offline
zurückrechnen und jedes andere ableiten. **Empfehlung: Master-Passwort vor der
Veröffentlichung rotieren** und auf allen Geräten neu ausrollen. Entscheidung liegt
bei der Security des Hauses.

## Ableitungslogik — nicht unbedacht ändern

```
combined  = f"{serial}:{etp_id}:{master_password}"
hash      = sha256(combined).digest()
password  = base64.urlsafe_b64encode(hash)[:16]
           + Sonderzeichen/Zeichenklassen, eingestreut über random.seed(int(hash))
```

**Jede Änderung an dieser Funktion invalidiert sämtliche bereits ausgerollten
Gerätepasswörter.** Geräte im Feld behalten ihr altes Passwort — das Tool könnte es
danach nicht mehr reproduzieren. Änderungen an `generate_password()` daher nur mit
Versionierung (z. B. Schema-Kennzeichen und Beibehaltung des alten Pfads), nie in-place.

Bekannte Schwächen der Konstruktion, für später:
- `random.seed()` mit dem Hash als Seed ist ein Mersenne-Twister, kein CSPRNG. Die
  Sonderzeichen-Positionen sind aus dem Passwort selbst ableitbar und tragen keine
  echte Entropie bei.
- Effektiv sind es 16 base64-Zeichen aus SHA-256 — ausreichend, aber ein KDF
  (PBKDF2/scrypt/Argon2) statt eines einfachen SHA-256 wäre die richtige Wahl,
  falls die Logik ohnehin einmal versioniert wird.

## Secrets

Die aktuelle Version hält **keine** Geheimnisse im Code. Fernet-Key und verschlüsseltes
Master-Passwort stehen zur Laufzeit in `settings.json` neben der EXE — diese Datei ist
in `.gitignore` und darf nicht eingecheckt werden.

Eine echte `settings.json` liegt lokal unter `IoT-DACH-PasswordGenerator/settings.json`
(gitignored, nicht gepusht — geprüft). Sie enthält den produktiven Fernet-Key und das
verschlüsselte Master-Passwort. Der Klartext daraus = das Extension-Feld
„Master-Passwort" (siehe [Feld-Zuordnung](#feld-zuordnung-exe--extension-stolperfalle)).

Zusätzlich gitignored: `*.pem`, `*.crx` (Signaturmaterial) und
`extension/dist/` (gepackte Artefakte).

> ⚠️ **`legacy/SE-PWD-GEN/Neuer Ordner/` enthält kompromittiertes Material:**
> `key.py` enthält das Master-Passwort im Klartext (`03_Schneider_IOT!`), `PWDGEN.py`
> den zugehörigen Fernet-Key *zusammen mit* dem verschlüsselten Token. Wer diese
> Dateien hat, kann jedes je erzeugte Gerätepasswort nachrechnen. Der Ordner war nie
> in Git (immer untracked) — die Belastung ist also lokal. **Das Master-Passwort sollte
> rotiert werden**; danach können die Altdateien gelöscht werden.

Die `legacy/`-Varianten leiten außerdem noch aus **Seriennummer + MAC1 + MAC2** ab,
nicht aus der ETP-ID. Sie sind nicht kompatibel mit der aktuellen Version.

## SentinelOne False Positive

Die EXE ist ein **PyInstaller-`--onefile`-Build** (Python 3.9, verifiziert am
eingebetteten CArchive). Genau diese Bauform löst bei EDR-Produkten regelmäßig aus,
und zwar aus nachvollziehbaren Gründen:

| Auslöser | Warum es verdächtig aussieht |
|---|---|
| `--onefile` | Der Bootloader entpackt bei **jedem Start** eine komplette Python-Runtime nach `%TEMP%\_MEIxxxxxx` und führt sie von dort aus — das ist verhaltensseitig exakt das Muster eines Droppers |
| Nicht signiert | Kein Publisher, keine Reputation |
| Neue Hashes | Jeder CI-Build erzeugt ein Unikat; Prevalence-basierte Bewertung stuft „auf 3 Rechnern weltweit gesehen" als riskant ein |
| Fehlende PE-Metadaten | Kein CompanyName/ProductName/Version im Binary |
| UPX | Falls im Build verfügbar, packt PyInstaller — Packer sind ein starker Heuristik-Trigger |
| Domäne | Crypto-Bibliotheken + Zwischenablage + Passwortgenerierung liest sich wie Credential-Tooling |

**Reihenfolge der Gegenmaßnahmen** (wirksamste zuerst):

1. ⬜ **Code Signing mit Firmenzertifikat.** Der mit Abstand größte Hebel. Ein
   Zertifikat (idealerweise EV) gibt dem Binary eine stabile Identität, die über
   Rebuilds hinweg bestehen bleibt. *Offen — braucht ein Zertifikat von der IT.*
2. ⬜ **Allowlisting über SecOps — nach Zertifikat, nicht nach Hash.** Eine
   Hash-Ausnahme ist nach dem nächsten Build wieder wertlos. Parallel dazu den Fund
   als False Positive bei SentinelOne einreichen. *Offen.*
3. ✅ **`--onedir` statt `--onefile`.** Entfernt das Entpacken nach `%TEMP%` und damit
   den stärksten Verhaltens-Trigger. Umgesetzt in `build.yml`; Auslieferung erfolgt
   jetzt als ZIP. Installation nach `C:\Program Files\…` statt als lose EXE im
   Download-Ordner ist noch offen — siehe dazu den `settings.json`-Hinweis oben.
4. ✅ **`--noupx`** und **`--version-file`** mit Firmenmetadaten
   (`assets/version_info.txt`). Ein CI-Schritt verifiziert nach dem Build, dass die
   Versionsressource tatsächlich im Binary gelandet ist und `OriginalFilename` zum
   Dateinamen passt — eine Abweichung wäre selbst ein Verdachtsmoment.
5. ⬜ **Grundsatzfrage:** Muss es überhaupt eine EXE sein? Ein internes Web-Tool oder
   die bereits vorhandene iOS-App umgeht das Problem vollständig.

`CompanyName` in `assets/version_info.txt` steht auf „Schneider Electric" und **muss
mit dem Subject des Code-Signing-Zertifikats übereinstimmen** — bei abweichender
juristischer Firmierung dort anpassen.

**Vor der Umsetzung:** den konkreten Detection-Namen aus der SentinelOne-Konsole holen.
Ein statischer Treffer (Packer-/ML-Heuristik) verlangt andere Schritte als ein
behavioraler (Ausführung aus `%TEMP%`). Ohne diese Information wird geraten.

Nicht der richtige Weg: Verschleierung, Entropie-Padding oder sonstige Versuche, die
Erkennung zu umgehen. Das verschiebt das Problem zum nächsten Signaturupdate und macht
das Tool gegenüber der eigenen Security-Abteilung unglaubwürdig. Ziel ist, dass das Tool
als das erkennbar wird, was es ist — nicht, dass es unerkannt bleibt.

## Konventionen

- Code und UI sind **deutschsprachig** (Labels, Meldungen) — beibehalten.
- Ziel-Laufzeit ist **Python 3.9** (CI-Pinning), Abhängigkeit ist nur `cryptography`.
- `legacy/` ist Archiv. Dort nichts weiterentwickeln.
- `dist/` enthält eingecheckte Binaries. Wenn dort ein neuer Build landet, den alten
  ersetzen statt danebenlegen.
