# Password Generator with Settings

This is a GUI-based password generator application built with Python and Tkinter.

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
3. Download the artifacts:
   - `Windows-executable` - Contains the Windows .exe file
   - `macOS-executable` - Contains the macOS executable
   - `Linux-executable` - Contains the Linux executable

### Local Development

To run the application locally:

```bash
pip install -r requirements.txt
python passwort_generator_gui_mit_settings.py
```

To build locally using PyInstaller:

```bash
pip install pyinstaller
pyinstaller --onefile --windowed passwort_generator_gui_mit_settings.py
```

## Dependencies

- Python 3.9+
- cryptography
- tkinter (usually included with Python)

## Usage

1. **Settings Tab**: Configure your Fernet key and encrypted master password
2. **Password Generator Tab**: Enter serial number and ETP ID to generate passwords

The generated password will be automatically copied to your clipboard.
