# IoT-DACH PanelServer Password Generator

Internes Tool zur **deterministischen Ableitung von Gerätepasswörtern** für Schneider
EcoStruxure Panel Server. Aus Seriennummer + ETP-ID + einem geheimen Master-Passwort
wird reproduzierbar dasselbe Gerätepasswort erzeugt — dieselbe Eingabe ergibt immer
dieselbe Ausgabe, damit der Service ein Gerätepasswort jederzeit rekonstruieren kann,
ohne es irgendwo speichern zu müssen.

## Aktuelle Aufgabe

**SentinelOne stuft die Windows-EXE wiederholt als Schadsoftware ein und löscht sie auf
den Firmenlaptops.** Das ist ein False Positive; der Build soll so umgestellt werden,
dass er nicht mehr anschlägt. Details und Lösungsweg: siehe [SentinelOne](#sentinelone-false-positive).

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
