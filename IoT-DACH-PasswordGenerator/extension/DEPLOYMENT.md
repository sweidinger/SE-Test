# Deployment — IoT-DACH PanelServer Password Generator (Chrome-Extension)

Diese Anleitung beschreibt drei Wege, die Extension zu verteilen: lokales
Testen, Self-Hosting mit erzwungener Installation (Force-Install) über
Firmenrichtlinien, und alternativ der Chrome Web Store als „unlisted"
Eintrag.

> **Entscheidung für dieses Projekt: kein Store-Eintrag.** Die Extension wird
> ausschließlich intern bereitgestellt — Abschnitt 2. Abschnitt 3 (Web Store)
> ist damit nur noch zur Einordnung dokumentiert.

## 0. Warum es keine „manuelle Installation" gibt

Der naheliegende Wunsch — CRX-Datei per Mail oder Dateifreigabe verteilen, der
Benutzer doppelklickt sie — funktioniert in Chrome **nicht mehr**. Das ist kein
Konfigurationsproblem, sondern seit Chrome 33 bewusst zugenagelt:

- **Drag & Drop einer `.crx` auf `chrome://extensions` wird blockiert.** Chrome
  meldet sinngemäß, Erweiterungen ließen sich nur aus dem Web Store hinzufügen.
- **Der Registry-Weg über einen lokalen Dateipfad ist abgeschafft.** Der frühere
  `path`-Schlüssel für externe Installationen erlaubt keine lokale `.crx` mehr;
  das verbliebene `update_url`-Verfahren dieser Methode akzeptiert nur Googles
  eigene Store-URL.
- **Entpackte Erweiterungen** (Entwicklermodus) lassen sich zwar laden, sind
  aber für den Dauerbetrieb ungeeignet: Chrome blendet eine wiederkehrende
  Warnung zum Entwicklermodus ein, es gibt keine automatischen Updates, der
  Code liegt für jeden Benutzer veränderbar im Klartext auf der Platte, und in
  vielen verwalteten Umgebungen ist der Entwicklermodus per Richtlinie gesperrt.

**Was bleibt — und dem Wunsch am nächsten kommt:** die Bereitstellung per
Gruppenrichtlinie von einem **internen** Server. Die Installation über
Richtlinien funktioniert ausdrücklich unabhängig davon, wo die Extension liegt.
Es geht also nichts an Google, kein Review, kein Store-Eintrag, der Code bleibt
vollständig im Haus — nur der Auslöser ist eine Richtlinie statt eines
Doppelklicks.

> ⚠️ **Voraussetzung:** Eine nicht aus dem Web Store stammende Extension, die
> per Richtlinie installiert wird, wird auf einem Gerät, das **nicht** in der
> Domäne bzw. nicht per Chrome Browser Cloud Management verwaltet ist, von
> Chrome **hart deaktiviert**. Für verwaltete Firmenlaptops ist das erfüllt,
> für Privatgeräte nicht.

## 1. Lokal testen (unpacked)

1. `chrome://extensions` öffnen.
2. Oben rechts **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** klicken und den `extension/`-Ordner
   auswählen (den, der `manifest.json` enthält).
4. Chrome lädt die Extension direkt aus dem Verzeichnis; Änderungen an den
   Dateien erfordern einen Klick auf **Aktualisieren** in der
   Kachel der Extension.

Für ein sauberes Verteilungspaket (ohne Test-/Tool-Dateien) steht
`tools/package.sh` bereit; es erzeugt
`dist/panelserver-pwgen-<version>.zip` aus `manifest.json`, `popup.html`,
`popup.css`, `popup.js`, `lib/` und `icons/`.

## 2. Self-Hosting mit Force-Install (empfohlen für verwaltete Firmen-Laptops)

Das ist der bevorzugte Weg für Geräte, die per Chrome-Browser-Cloud-
Management oder Windows-Gruppenrichtlinie/macOS-Profil verwaltet werden:
die Extension wird zentral bereitgestellt, Nutzer können sie weder
deinstallieren noch deaktivieren, und ein Update auf dem internen Server
reicht aus, um alle Geräte zu aktualisieren.

### 2.1 CRX packen

Ein `.crx` ist eine signierte, gepackte Version der Extension. Drei Wege,
eine zu erzeugen:

- **Chrome selbst (empfohlen für den ersten Build):**
  `chrome://extensions` → Entwicklermodus → **Erweiterung packen** →
  Stammverzeichnis der Extension (`extension/`) auswählen. Beim ersten
  Packen ohne vorhandenen Schlüssel erzeugt Chrome automatisch eine
  `.crx`-Datei **und** eine `.pem`-Datei (den privaten Signaturschlüssel).
- **Für spätere Updates:** beim Packen unter „Privater Schlüssel" die
  vorhandene `.pem`-Datei angeben, damit dieselbe Extension-ID erhalten
  bleibt (siehe 2.4).
- **Kommandozeile:**
  `chrome.exe --pack-extension=<pfad-zum-extension-ordner> --pack-extension-key=<pfad>.pem`

### 2.2 update.xml hosten

Chrome prüft in regelmässigen Abständen nicht die `.crx` direkt, sondern
ein XML-Update-Manifest. Vorlage: `tools/update.xml.template` in diesem
Repo — Platzhalter `__EXTENSION_ID__`, `__VERSION__` und `__CRX_URL__`
ausfüllen und als `update.xml` auf einem internen (idealerweise HTTPS-)
Server ablegen, erreichbar für alle verwalteten Geräte.

**Wichtiger, häufiger Fehler:** Die Richtlinie (siehe 2.3) muss auf die
`update.xml` zeigen, **nicht** direkt auf die `.crx`-Datei. Die `.crx`
wird stattdessen im `codebase`-Attribut *innerhalb* der `update.xml`
referenziert. Zeigt die Richtlinie direkt auf die `.crx`, schlägt die
automatische Installation/Aktualisierung fehl.

### 2.3 MIME-Type für `.crx` korrekt setzen

Der Webserver muss `.crx`-Dateien mit dem Content-Type
`application/x-chrome-extension` ausliefern (Nginx-Beispiel:
`types { application/x-chrome-extension crx; }`). Alternativ akzeptiert
Chrome auch einen der Typen `text/plain`, `application/octet-stream`,
`unknown/unknown`, `application/unknown` oder `*/*`, solange die Datei
auf `.crx` endet. In jedem Fall darf der Server für diese Datei **keinen**
`X-Content-Type-Options: nosniff`-Header senden — sonst verweigert Chrome
die Installation.

### 2.4 Extension-ID: Herkunft und warum der `.pem`-Schlüssel sicher
    aufbewahrt werden muss

Die Extension-ID (die 32-stellige Zeichenfolge aus den Buchstaben a–p,
z. B. `abcdefghijklmnopabcdefghijklmnop`) wird **nicht** frei vergeben,
sondern kryptographisch aus dem öffentlichen Schlüssel abgeleitet, der zum
privaten Signaturschlüssel (`.pem`) gehört: Chrome bildet den SHA-256-Hash
des öffentlichen Schlüssels und wandelt die ersten 16 Bytes davon in die
a–p-Zeichenfolge um.

Daraus folgt direkt:

- Solange dieselbe `.pem`-Datei beim Packen wiederverwendet wird, bleibt
  die Extension-ID über alle Versionen hinweg identisch.
- **Geht die `.pem`-Datei verloren**, kann keine neue `.crx` mehr mit der
  ursprünglichen ID erzeugt werden — ein Neupacken ohne den alten
  Schlüssel erzeugt zwangsläufig einen neuen Schlüssel und damit eine
  **neue** Extension-ID.
- Die Force-Install-Richtlinie (`ExtensionInstallForcelist` bzw.
  `ExtensionSettings`) referenziert die Extension-ID fest. Ändert sich die
  ID, greift die bestehende Richtlinie nicht mehr auf die neue `.crx` —
  aus Sicht der verwalteten Geräte "verschwindet" die alte Extension und
  eine neue müsste unter der neuen ID separat ausgerollt werden.
- Deshalb: `.pem`-Datei **nicht** ins Git-Repository einchecken, sondern
  in einem Passwort-/Secret-Manager oder einem restriktiv
  zugriffsgeschützten internen Speicherort sichern, mit Backup.

### 2.5 Rollout per Richtlinie

Zwei Richtlinien stehen zur Verfügung, um Force-Install zu konfigurieren
(Chrome Enterprise, über Windows-GPO, macOS-Konfigurationsprofil oder die
Google Admin-Konsole für Chrome-Browser-Cloud-Management):

- **`ExtensionInstallForcelist`** (älter, einfacher): Liste von Strings
  im Format `<extension_id>;<update_url>`, z. B.
  `abcdefghijklmnopabcdefghijklmnop;https://intern.example.com/update.xml`.
  Der `update_url`-Teil wird laut Google-Dokumentation nur für die
  **initiale Installation** herangezogen; danach nutzt Chrome die im
  Manifest bzw. in der Update-Antwort hinterlegte URL weiter — daher
  sollte `update.xml` dauerhaft unter derselben URL erreichbar bleiben.
- **`ExtensionSettings`** (neuer, granularer, JSON-basiert): pro
  Extension-ID ein Objekt mit `"installation_mode": "force_installed"`
  und `"update_url"`. Beispiel:

  ```json
  {
    "abcdefghijklmnopabcdefghijklmnop": {
      "installation_mode": "force_installed",
      "update_url": "https://intern.example.com/update.xml"
    }
  }
  ```

  `ExtensionSettings` überschreibt `ExtensionInstallForcelist`, falls
  beide für dieselbe Extension-ID gesetzt sind. Für neue Rollouts ist
  `ExtensionSettings` der von Google empfohlene, feingranularere Weg.

Beide Richtlinien werden über die üblichen Verwaltungskanäle verteilt:
Windows-Gruppenrichtlinien-Vorlagen (ADMX von Google), macOS-
Konfigurationsprofile, oder zentral über die Google Admin-Konsole bei
Chrome-Browser-Cloud-Management.

## 3. Alternative: Chrome Web Store (unlisted)

Statt Self-Hosting kann die Extension als **unlisted** Eintrag im Chrome
Web Store veröffentlicht werden: nur Nutzer mit direktem Link sehen den
Eintrag, Google übernimmt Hosting und Auto-Updates, und
`ExtensionInstallForcelist`/`ExtensionSettings` können direkt auf die
Web-Store-ID zeigen (ohne eigenen `update.xml`-Server).

**Abwägung:** Der Weg ist organisatorisch einfacher (kein eigener Server,
kein `.pem`-Handling, kein manuelles `.crx`-Packen bei jedem Update), aber
der Code durchläuft dafür Googles Review-Prozess im Chrome Web Store,
bevor eine neue Version live geht bzw. für neue Reviewer sichtbar wird.
Ob das für ein internes Werkzeug mit sensiblen Ableitungslogiken
akzeptabel ist, ist eine Abwägung, die dieses Dokument nicht trifft.

## 4. Nur für einen ausgewählten Personenkreis

Zwei getrennte Fragen, die oft vermischt werden: **wer den Eintrag sehen kann**
(Sichtbarkeit) und **wer die Extension bekommt** (Zuweisung). Für „nur bestimmte
Mitarbeiter" ist die zweite die entscheidende.

### Sichtbarkeit im Chrome Web Store

| Einstellung | Bedeutung |
|---|---|
| **Öffentlich** | Gelistet und durchsuchbar. Für dieses Werkzeug ungeeignet. |
| **Nicht gelistet** (unlisted) | Kein Eintrag in Suche und Kategorien, aber **jeder mit dem Link kann installieren**. Verbirgt, schützt aber nicht. |
| **Privat** | Installierbar nur für Nutzer **der eigenen Organisation**; für alle anderen ist der Eintrag unsichtbar. Der Administrator muss dafür in der Admin-Konsole erlauben, dass private, auf die Domain beschränkte Apps veröffentlicht werden dürfen. |
| **Self-Hosting** | Gar kein Store-Eintrag. Volle Kontrolle, nichts verlässt das Haus. |

„Privat" ist die richtige Wahl, wenn es überhaupt in den Store soll —
„nicht gelistet" ist nur Verschleierung.

### Zuweisung an einzelne Mitarbeiter

Die Beschränkung auf einen Personenkreis passiert **nicht** über die
Store-Sichtbarkeit, sondern in der Admin-Konsole: Die betreffenden Konten kommen
in eine eigene **Organisationseinheit (OU) oder Gruppe**, und die
Force-Install-Richtlinie wird ausschließlich für diese OU/Gruppe gesetzt statt
für die oberste Ebene. Das funktioniert für den privaten Store-Eintrag und für
Self-Hosting gleichermaßen.

**Empfehlung:** Self-Hosting plus Force-Install auf eine dedizierte OU. Damit
geht der Code nicht durch Googles Review, die Zuweisung ist exakt steuerbar, und
zwangsinstalliert kann die Extension von den Benutzern weder deaktiviert noch
entfernt werden.

### Wichtig: Sichtbarkeit ist keine Zugriffskontrolle

Wer die Extension installiert, kann damit noch nichts anfangen. Ohne das
**Master-Passwort** — das bei der Ersteinrichtung eingegeben und mit einer
persönlichen Passphrase verschlüsselt wird — erzeugt sie keine Gerätepasswörter.
Die eigentliche Zugangskontrolle ist also die Weitergabe des Master-Passworts,
nicht die Store-Einstellung.

Umgekehrt heißt das: **Die Verteilung des Master-Passworts an den ausgewählten
Personenkreis ist der sicherheitskritische Schritt**, nicht das Ausrollen der
Extension. Es gehört nicht in eine E-Mail und nicht in ein Ticket.

## Quellen

- [Use alternative installation methods | Chrome for Developers](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions) — externe Installationsverfahren, Registry-Schlüssel, Einschränkungen des `update_url`-Feldes.
- [Extensions Deployment FAQ | Chromium](https://www.chromium.org/developers/extensions-deployment-faq/) — seit Chrome 33 keine externen Installationen aus einem lokalen `.crx`-Pfad; per Richtlinie installierte Nicht-Store-Extensions werden auf nicht domänengebundenen Geräten hart deaktiviert, während die Richtlinien-Installation für Unternehmen unabhängig vom Hosting-Ort unterstützt bleibt.
- [Self-host for Linux | Chrome Extensions | Chrome for Developers](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux) — Update-Manifest-XML-Format, `.crx`-Packen, MIME-Type-Anforderungen (`application/x-chrome-extension`, `nosniff`-Falle).
- [ExtensionInstallForcelist: Configure the list of force-installed apps and extensions | Chrome Enterprise](https://chromeenterprise.google/policies/extension-install-forcelist/) — Format `extension_id;update_url`, Hinweis dass die URL nur zur Erstinstallation verwendet wird.
- [ExtensionSettings: Extension management settings | Chrome Enterprise](https://chromeenterprise.google/policies/extension-settings/) — `installation_mode: force_installed`, `update_url`-Feld, Verhältnis zu `ExtensionInstallForcelist`.
- [Configure ExtensionSettings policy – Chrome Enterprise and Education Help](https://support.google.com/chrome/a/answer/9867568?hl=en) — Praktische Konfigurationsschritte und JSON-Beispiel.
- [Extension Settings Full Description – chromium.org](https://www.chromium.org/administrators/policy-list-3/extension-settings-full/) — Detaillierte Feldbeschreibung von `installation_mode` und `update_url`.
- [Manifest – key field | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/manifest/key) — Zusammenhang zwischen dem `key`-Feld/öffentlichem Schlüssel und einer stabilen Extension-ID.
- Ableitung der Extension-ID als SHA-256-Hash des öffentlichen Schlüssels (erste 16 Bytes → a–p-Zeichenfolge) ist ein seit Jahren dokumentiertes, öffentlich bekanntes Chromium-Verhalten (u. a. beschrieben in Community-Quellen wie [Extension ID generation from public key – Medium](https://medium.com/@thiruak1024/extension-id-generation-from-public-key-11b72d2b79ce) und im [ChromeIdGenerator-Tool auf GitHub](https://github.com/dsoprea/ChromeIdGenerator)); eine offizielle Chrome-for-Developers-Seite, die den genauen Hash-Algorithmus in dieser Detailtiefe beschreibt, konnte bei dieser Recherche nicht gefunden werden — die offizielle Doku (siehe `key`-Feld oben) beschreibt nur das *Verhalten* (ID bleibt stabil bei gleichem Schlüssel), nicht die genaue Hash-Formel.
