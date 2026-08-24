# IoT-DACH PanelServer Password Generator

This is a GUI-based password generator application for IoT-DACH PanelServer systems, built with Python and Tkinter.

## Features

- Generate secure passwords based on serial number and ETP ID
- Encrypted master password storage
- Cross-platform GUI interface
- Settings management

## Building Executables

This project uses GitHub Actions to automatically build executables for multiple platforms:

### Automatic Builds

1. **Push to main/master branch**: Automatically triggers builds for Windows, macOS, and Linux
2. **Manual trigger**: Go to Actions tab → "Build Executables" → "Run workflow"
3. **Tagged releases**: Create a git tag to automatically create a release with executables

### Download Built Executables

After a successful build:

1. Go to the "Actions" tab in your GitHub repository
2. Click on the latest workflow run
3. Download the artifacts (each contains a ZIP of the application folder):
   - `Windows-executable` - `PanelServerPasswordGenerator-windows.zip`
   - `macOS-executable` - `PanelServerPasswordGenerator-macos.zip`
   - `Linux-executable` - `PanelServerPasswordGenerator-linux.zip`

Unpack the ZIP and keep the folder together — the `.exe` needs the files next to it.

### Local Development

To run the application locally:

```bash
pip install -r requirements.txt
python src/passwort_generator_gui_mit_settings.py
```

To build locally using PyInstaller:

```bash
pip install pyinstaller
pyinstaller --onedir --windowed --noupx \
  --name PanelServerPasswordGenerator \
  --icon=assets/SE-Icon.ico \
  --version-file=assets/version_info.txt \
  src/passwort_generator_gui_mit_settings.py
```

This produces a **folder** `dist/PanelServerPasswordGenerator/` — ship the whole
folder (the CI packages it as a ZIP), not just the `.exe`.

> **Note:** The build deliberately uses `--onedir` rather than `--onefile`.
> `--onefile` unpacks a full Python runtime into `%TEMP%` on every start, which
> SentinelOne flags as malware on company laptops. See
> [CLAUDE.md](CLAUDE.md#sentinelone-false-positive) before changing the build flags.

## Dependencies

- Python 3.9+
- cryptography
- tkinter (usually included with Python)

## Usage

1. **Settings Tab**: Configure your Fernet key and encrypted master password
2. **Password Generator Tab**: Enter serial number and ETP ID to generate passwords

The generated password will be automatically copied to your clipboard.
