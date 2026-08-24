# IoT-DACH PanelServer Password Generator - iOS App

This is a native iOS implementation of the IoT-DACH PanelServer Password Generator using SwiftUI.

## Features

- ✅ **Native iOS interface** with SwiftUI
- ✅ **Same password algorithm** as the Python version
- ✅ **Automatic clipboard copying**
- ✅ **Secure password field** for master password
- ✅ **Clean, professional UI**
- ✅ **Real-time validation**

## Requirements

- **Xcode 14.0+**
- **iOS 15.0+**
- **Apple Developer Account** (for App Store distribution)

## Setup Instructions

### 1. Create New Xcode Project

1. Open Xcode
2. Create a new project: **iOS → App**
3. Product Name: `IoT-DACH PanelServer Password Generator`
4. Bundle Identifier: `com.schneider.iot-dach-password-generator`
5. Language: **Swift**
6. Interface: **SwiftUI**
7. Use Core Data: **No**

### 2. Replace Files

1. Replace `ContentView.swift` with the provided file
2. Replace the main app file with `PasswordGeneratorApp.swift`

### 3. Configure App Icon

1. Add your `SE-Icon.ico` to the project
2. Convert to iOS icon sizes (App Icon & Image on the Apple Developer site)
3. Add to `Assets.xcassets/AppIcon.appiconset`

### 4. App Store Configuration

Add these to `Info.plist`:

```xml
<key>CFBundleDisplayName</key>
<string>IoT-DACH PanelServer</string>
<key>CFBundleShortVersionString</key>
<string>1.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

## Alternative Options

### Option 2: Progressive Web App (PWA)
- Create a web version that works like a native app
- Can be "installed" on iPhone home screen
- No App Store approval needed
- Cross-platform compatibility

### Option 3: React Native
- Single codebase for iOS and Android
- Good performance
- Easier if you know JavaScript/React

### Option 4: Flutter
- Single codebase for iOS and Android
- Excellent performance
- Growing ecosystem

## Distribution

### TestFlight (Beta Testing)
1. Archive the app in Xcode
2. Upload to App Store Connect
3. Create TestFlight build
4. Invite internal/external testers

### App Store
1. Complete app review guidelines compliance
2. Submit for review
3. Typical review time: 24-48 hours

## Password Algorithm Compatibility

The iOS version uses the exact same algorithm as the Python version:
- SHA256 hashing of `serial:etp_id:master_password`
- Base64 URL-safe encoding
- Deterministic special character injection
- Character class requirements (uppercase, lowercase, digit, special)

This ensures **identical passwords** are generated across all platforms.

## Security Features

- ✅ **No data storage** - everything is computed on-demand
- ✅ **Secure text fields** for master password
- ✅ **Memory-safe Swift implementation**
- ✅ **No network communication**
- ✅ **Cryptographically secure hashing**
