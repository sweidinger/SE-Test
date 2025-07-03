#!/bin/bash

echo "🚀 iOS TestFlight Setup Helper"
echo "================================"
echo ""
echo "This script will guide you through setting up TestFlight distribution."
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

echo "📋 Required Steps:"
echo ""
echo "1. APPLE DEVELOPER ACCOUNT"
echo "   - Ensure you have an active Apple Developer Account ($99/year)"
echo "   - URL: https://developer.apple.com/account/"
echo ""

echo "2. APP STORE CONNECT SETUP"
echo "   - Create app in App Store Connect"
echo "   - URL: https://appstoreconnect.apple.com"
echo "   - Bundle ID: com.schneider.iot-dach-password-generator"
echo ""

echo "3. CERTIFICATES & PROVISIONING PROFILES"
echo "   - iOS Distribution Certificate"
echo "   - App Store Provisioning Profile"
echo ""

echo "4. APP STORE CONNECT API KEY"
echo "   - Create API Key for GitHub Actions"
echo "   - URL: https://appstoreconnect.apple.com/access/api"
echo ""

read -p "Do you have an Apple Developer Account? (y/n): " has_account

if [[ $has_account != "y" ]]; then
    echo ""
    echo "❌ You need an Apple Developer Account to use TestFlight."
    echo "   Sign up at: https://developer.apple.com/programs/"
    echo "   Cost: $99/year"
    exit 1
fi

echo ""
echo "📱 CERTIFICATE GENERATION"
echo "========================="
echo ""

# Check if Keychain Access is available
echo "1. Generate Certificate Signing Request (CSR)"
echo "   - Open Keychain Access"
echo "   - Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority"
echo "   - User Email: Your Apple ID email"
echo "   - Common Name: Your name or company"
echo "   - Save to disk"
echo ""

read -p "Have you created a CSR file? (y/n): " has_csr

if [[ $has_csr == "y" ]]; then
    echo ""
    echo "2. Create iOS Distribution Certificate"
    echo "   - Go to: https://developer.apple.com/account/resources/certificates/list"
    echo "   - Click '+' to create new certificate"
    echo "   - Choose 'iOS Distribution (App Store and Ad Hoc)'"
    echo "   - Upload your CSR file"
    echo "   - Download the certificate (.cer file)"
    echo ""
    
    echo "3. Install Certificate"
    echo "   - Double-click the downloaded .cer file"
    echo "   - It will be added to your Keychain"
    echo ""
    
    echo "4. Export Certificate as .p12"
    echo "   - Open Keychain Access"
    echo "   - Find your iOS Distribution certificate"
    echo "   - Right-click → Export"
    echo "   - Choose .p12 format"
    echo "   - Set a password (remember this!)"
    echo ""
fi

echo ""
echo "📄 PROVISIONING PROFILE"
echo "======================="
echo ""
echo "1. Create App Store Provisioning Profile"
echo "   - Go to: https://developer.apple.com/account/resources/profiles/list"
echo "   - Click '+' to create new profile"
echo "   - Choose 'App Store' distribution"
echo "   - Select your App ID: com.schneider.iot-dach-password-generator"
echo "   - Select your iOS Distribution certificate"
echo "   - Download the .mobileprovision file"
echo ""

echo ""
echo "🔑 APP STORE CONNECT API KEY"
echo "============================"
echo ""
echo "1. Create API Key"
echo "   - Go to: https://appstoreconnect.apple.com/access/api"
echo "   - Click '+' to create new key"
echo "   - Name: 'GitHub Actions CI/CD'"
echo "   - Access: Developer"
echo "   - Download the .p8 file (you can only download once!)"
echo "   - Note the Key ID and Issuer ID"
echo ""

echo ""
echo "🔒 GITHUB SECRETS SETUP"
echo "======================="
echo ""
echo "You'll need to add these secrets to your GitHub repository:"
echo ""
echo "Required secrets:"
echo "- APP_STORE_CONNECT_API_KEY: Content of the .p8 file"
echo "- APP_STORE_CONNECT_API_KEY_ID: The Key ID from App Store Connect"
echo "- APP_STORE_CONNECT_ISSUER_ID: The Issuer ID from App Store Connect"
echo "- DISTRIBUTION_CERTIFICATE: Base64 encoded .p12 certificate"
echo "- DISTRIBUTION_CERTIFICATE_PASSWORD: Password for .p12 file"
echo "- DISTRIBUTION_PROVISIONING_PROFILE: Base64 encoded .mobileprovision"
echo ""

echo "To base64 encode files:"
echo "base64 -i certificate.p12 | pbcopy"
echo "base64 -i profile.mobileprovision | pbcopy"
echo ""

echo ""
echo "✅ Next Steps:"
echo "1. Complete the manual steps above"
echo "2. Add secrets to GitHub repository"
echo "3. Update GitHub Actions workflow"
echo "4. Push code to trigger TestFlight build"
echo ""

echo "Need help? Check the detailed guide in iOS/TESTFLIGHT_SETUP.md"
