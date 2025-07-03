# 🚀 TestFlight Distribution Setup Guide

This guide will walk you through setting up automated TestFlight distribution for the IoT-DACH PanelServer Password Generator iOS app.

## Prerequisites

- ✅ Apple Developer Account ($99/year)
- ✅ Access to App Store Connect
- ✅ macOS computer with Xcode
- ✅ GitHub repository with admin access

## Step 1: Apple Developer Account Setup

### 1.1 Register App Identifier

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Click "+" to register new App ID
3. Select "App IDs" → "App"
4. Configure:
   - **Description**: `IoT-DACH PanelServer Password Generator`
   - **Bundle ID**: `com.schneider.iot-dach-password-generator`
   - **Capabilities**: Default (no special capabilities needed)
5. Click "Continue" and "Register"

## Step 2: App Store Connect Setup

### 2.1 Create New App

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Configure:
   - **Platform**: iOS
   - **Name**: `IoT-DACH PanelServer Password Generator`
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.schneider.iot-dach-password-generator`
   - **SKU**: `iot-dach-password-generator`
4. Click "Create"

### 2.2 App Information

Fill in basic app information:
- **Category**: Productivity
- **Subcategory**: (Optional)
- **Description**: Password generator for IoT-DACH PanelServer systems

## Step 3: Certificates & Provisioning Profiles

### 3.1 Create Certificate Signing Request (CSR)

1. Open **Keychain Access** on macOS
2. **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Fill in:
   - **User Email Address**: Your Apple ID email
   - **Common Name**: Your name or organization
   - **CA Email Address**: Leave empty
   - **Request is**: Saved to disk
4. Save the `.certSigningRequest` file

### 3.2 Create iOS Distribution Certificate

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click "+" → **iOS Distribution (App Store and Ad Hoc)**
3. Upload your CSR file
4. Download the certificate (`.cer` file)
5. Double-click to install in Keychain

### 3.3 Export Certificate as .p12

1. Open **Keychain Access**
2. Find your **iOS Distribution** certificate
3. Right-click → **Export**
4. Choose **Personal Information Exchange (.p12)**
5. Set a strong password (remember this!)
6. Save as `distribution_certificate.p12`

### 3.4 Create Provisioning Profile

1. Go to [Apple Developer Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click "+" → **App Store**
3. Select your App ID: `com.schneider.iot-dach-password-generator`
4. Select your iOS Distribution certificate
5. Name: `IoT-DACH PanelServer App Store Profile`
6. Download the `.mobileprovision` file

## Step 4: App Store Connect API Key

### 4.1 Generate API Key

1. Go to [App Store Connect API](https://appstoreconnect.apple.com/access/api)
2. Click "+" in **Keys** section
3. Configure:
   - **Name**: `GitHub Actions CI/CD`
   - **Access**: **Developer**
4. Click "Generate"
5. **Download the `.p8` file** (you can only download once!)
6. Note the **Key ID** and **Issuer ID**

## Step 5: GitHub Secrets Configuration

### 5.1 Base64 Encode Files

```bash
# Encode certificate
base64 -i distribution_certificate.p12 | pbcopy

# Encode provisioning profile  
base64 -i profile.mobileprovision | pbcopy

# Read API key content
cat AuthKey_XXXXXXXXXX.p8 | pbcopy
```

### 5.2 Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `APP_STORE_CONNECT_API_KEY` | Content of `.p8` file | App Store Connect API key |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID (e.g., `X8R3HHXXXX`) | From App Store Connect |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (UUID format) | From App Store Connect |
| `DISTRIBUTION_CERTIFICATE` | Base64 encoded `.p12` | Exported certificate |
| `DISTRIBUTION_CERTIFICATE_PASSWORD` | Password for `.p12` | Your certificate password |
| `DISTRIBUTION_PROVISIONING_PROFILE` | Base64 encoded `.mobileprovision` | Downloaded profile |

## Step 6: Update GitHub Actions Workflow

The workflow will be automatically updated to use these secrets for TestFlight uploads.

## Step 7: TestFlight Distribution Process

### 7.1 Automatic Builds

1. **Push to main branch** → Triggers build
2. **Create a git tag** → Triggers release build
3. **GitHub Actions** builds and uploads to TestFlight
4. **App Store Connect** processes the build
5. **TestFlight** notifies beta testers

### 7.2 Manual TestFlight Management

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. **My Apps** → **IoT-DACH PanelServer Password Generator** → **TestFlight**
3. **Manage builds**, add testers, create test groups
4. **Send invitations** to beta testers

## Step 8: Beta Tester Management

### 8.1 Internal Testing (Up to 25 users)

- Add team members by Apple ID
- No App Review required
- Instant access to new builds

### 8.2 External Testing (Up to 10,000 users)

- Requires Apple Review (usually 24-48 hours)
- Add testers by email or public link
- More comprehensive testing

## Testing the Setup

1. **Commit and push** your changes
2. **Create a tag**: `git tag v1.0.0 && git push --tags`
3. **Monitor GitHub Actions** for build progress
4. **Check App Store Connect** for uploaded build
5. **Invite testers** in TestFlight

## Troubleshooting

### Common Issues

- **Code signing errors**: Check certificate and profile validity
- **API key errors**: Verify Key ID, Issuer ID, and .p8 file content
- **Bundle ID mismatch**: Ensure consistent Bundle ID across all configurations
- **Build processing stuck**: Can take 10-60 minutes in App Store Connect

### Useful Commands

```bash
# Check certificate expiration
security find-certificate -c "iPhone Distribution" -p | openssl x509 -text -noout

# Validate provisioning profile
security cms -D -i profile.mobileprovision

# Check GitHub Actions logs
# Go to repository → Actions → Latest workflow run
```

## Security Best Practices

- ✅ Use strong passwords for certificates
- ✅ Regularly rotate App Store Connect API keys
- ✅ Limit API key access to minimum required
- ✅ Store secrets securely in GitHub
- ✅ Monitor build logs for sensitive information

## Next Steps

Once setup is complete:

1. **Test the complete pipeline**
2. **Invite internal beta testers**
3. **Gather feedback** and iterate
4. **Prepare for App Store review** (if planning public release)

## Support

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [TestFlight Help](https://developer.apple.com/testflight/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
