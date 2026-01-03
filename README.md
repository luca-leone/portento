# @portento/cli

CLI tool for building and deploying React Native applications for iOS and Android platforms.

## 📦 Installation

Install globally via npm:

```bash
npm install -g @portento/cli
```

Or use directly with npx:

```bash
npx @portento/cli <command> [options]
```

## 🔧 Requirements

- **Node.js**: >= 20.11.0
- **iOS**: Xcode, CocoaPods
- **Android**: Android SDK, Gradle, JDK

## 🚀 Quick Start

```bash
# Start Metro bundler
portento start -e dev

# Install on device (auto-detects/starts device)
portento install -p android
portento install -p ios

# Build for production
portento build -p android -t prod -e prod
portento build -p ios -t prod -e prod
```

## 📖 Commands

### `start` - Start Metro Bundler

Start the Metro bundler for development.

```bash
portento start [options]
```

**Options:**

| Parameter | Alias | Type | Description | Default |
|-----------|-------|------|-------------|---------|
| `--environment` | `-e` | `string` | Target environment | `dev` |
| `--reset-cache` | - | `boolean` | Reset Metro cache | `false` |

**Supported environments:**
- `local` - Local development
- `dev`, `dev3`, `dev6` - Development environments
- `qa` - Quality Assurance
- `staging` - Pre-production
- `prod` - Production

**Examples:**

```bash
# Start with dev environment (default)
portento start

# Start with QA environment
portento start -e qa

# Start with clean cache
portento start -e prod --reset-cache
```

---

### `install` - Install and Run App

Install and run the app on a device or simulator. If no `--deviceId` is specified, the command automatically finds the first available device or starts an emulator/simulator.

```bash
portento install [options]
```

**Options:**

| Parameter | Alias | Type | Description | Default |
|-----------|-------|------|-------------|---------|
| `--platform` | `-p` | `android\|ios` | **Required**. Target platform | - |
| `--environment` | `-e` | `string` | Target environment | `dev` |
| `--buildType` | `-t` | `debug\|prod` | Build type | `prod` |
| `--deviceId` | - | `string` | Device ID or name | - |

**Automatic behavior without `--deviceId`:**

**Android:**
1. Checks connected devices with `adb devices`
2. If a connected device is found, uses it
3. Otherwise, starts the first available emulator with `emulator -avd <name>`
4. Returns the device ID (e.g., `emulator-5554`)

**iOS:**
1. Searches for simulators with `xcrun simctl list devices`
2. If a booted simulator is found (state `Booted`), uses it
3. Otherwise starts the first available simulator
4. Returns the simulator name

**Device ID Detection:**
- **Android**: If `--deviceId` is not specified, uses the first available
- **iOS**: 
  - If `--deviceId` is in UDID format (`XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`), it's used as simulator UDID
  - Otherwise it's interpreted as device or simulator name
  - If omitted, uses the first available simulator

**Examples:**

```bash
# Android - auto-find/start device
portento install -p android -e qa

# iOS - auto-find/start simulator
portento install -p ios -e staging

# Android - specific device
portento install -p android --deviceId=emulator-5554 -e dev

# iOS - specific simulator
portento install -p ios --deviceId="iPhone 15 Pro" -e qa

# iOS - physical device via UDID
portento install -p ios --deviceId=00008110-001A12345678901E -e prod
```

---

### `build` - Build App

Build the application for production or debug distribution.

```bash
portento build [options]
```

**Options:**

| Parameter | Alias | Type | Description | Default |
|-----------|-------|------|-------------|---------|
| `--platform` | `-p` | `android\|ios` | **Required**. Target platform | - |
| `--environment` | `-e` | `string` | Target environment | `dev` |
| `--buildType` | `-t` | `debug\|prod` | Build type | `prod` |

**Generated Artifacts:**

#### Android

| buildType | Gradle Command | Artifact | Location | Description |
|-----------|----------------|----------|-----------|-------------|
| `debug` | `./gradlew assembleDebug` | **APK** | `dist/v{VERSION}_build_{BUILD}_{ENV}.apk` | Installable APK file for testing |
| `prod` | `./gradlew bundleRelease` | **AAB** | `dist/v{VERSION}_build_{BUILD}_{ENV}.aab` | Android App Bundle for Google Play Store |

**Android filename example:**
- Debug: `v0.0.4_build_1_DEV.apk`
- Prod: `v0.0.4_build_1_PROD.aab`

#### iOS

| buildType | Xcode Configuration | Artifact | Location | Description |
|-----------|----------------------|----------|-----------|-------------|
| `debug` | `Debug` | **IPA** | `dist/v{VERSION}_build_{BUILD}_{ENV}.ipa` | IPA with Debug configuration |
| `prod` | `Release` | **IPA** | `dist/v{VERSION}_build_{BUILD}_{ENV}.ipa` | Optimized IPA for App Store/TestFlight |

**iOS filename example:**
- Debug: `v0.0.4_build_1_STAGING.ipa`
- Prod: `v0.0.4_build_1_PROD.ipa`

**Build Workflow:**

**Android - Debug (APK):**
1. Configure environment
2. Clean previous builds (`./gradlew clean`)
3. Run `./gradlew assembleDebug`
4. Generate APK ready for manual installation

**Android - Prod (AAB):**
1. Configure production environment
2. Set up keystore for signing
3. Run `./gradlew bundleRelease`
4. Generate AAB ready for Google Play Console

**iOS - Debug/Prod (IPA):**
1. Install CocoaPods dependencies
2. Run Xcode archive (`xcodebuild archive`)
3. Export IPA (`xcodebuild -exportArchive`)
4. Copy to `dist/`

**Examples:**

```bash
# Android - Debug APK
portento build -p android -t debug -e qa

# Android - Production AAB for Play Store
portento build -p android -t prod -e prod

# iOS - Debug IPA
portento build -p ios -t debug -e staging

# iOS - Production IPA for App Store
portento build -p ios -t prod -e prod
```

---

### `devices` - List Devices

List all available devices and simulators/emulators for Android and iOS.

```bash
portento devices
```

**Output:**

**Android:**
- Connected devices with device ID to use in `--deviceId`
- Available emulators (not running)

**iOS:**
- Simulators and physical devices with UDID and state

**Example output:**

```
Android - Connected devices
Use the Device ID in the --deviceId parameter

  • emulator-5554 (Pixel 9 API 35)
  • RF8N12345AB (Physical Device)

Android - Available emulators (not running)
To use these, start them first with: emulator -avd <name>

  • Pixel_8_API_34
  • Pixel_7_API_33

iOS - Available devices and simulators
iPhone 15 Pro (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) (Booted)
iPhone 14 (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) (Shutdown)
```

---

### `clean` - Clean Build Artifacts

Clean all build artifacts, caches, and dependencies.

```bash
portento clean
```

**What gets cleaned:**
- Android build directories (`android/build`, `android/app/build`)
- iOS build directories (`ios/build`, `ios/DerivedData`)
- Node modules cache
- Metro bundler cache
- Temporary files

---

## 📝 Practical Examples

### Typical Development Workflow

```bash
# Terminal 1 - Start Metro bundler
portento start -e dev6

# Terminal 2 - Install on device
portento install -p ios -e dev6
```

### Android Release

```bash
# Build AAB for production
portento build -p android -t prod -e prod

# Output: dist/v0.0.4_build_1_PROD.aab
# Upload to Google Play Console
```

### iOS Release

```bash
# Build IPA for production
portento build -p ios -t prod -e prod

# Output: dist/v0.0.4_build_1_PROD.ipa
# Upload to App Store Connect with Transporter
```

### Testing on Physical Device

```bash
# Android - find device ID
adb devices
portento install -p android --deviceId="RF8N12345AB" -e qa

# iOS - find UDID
instruments -s devices
portento install -p ios --deviceId=00008110-001A12345678901E -e qa
```

---

## 🐛 Troubleshooting

### Android - Build Fails

```bash
cd android
./gradlew clean
cd ..
portento build -p android -t debug
```

### iOS - Pod Install Fails

```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
portento build -p ios -t debug
```

### Metro Bundler - Cache Issues

```bash
portento start --reset-cache

# In another terminal
watchman watch-del-all
```

### ADB Not Detecting Devices

```bash
adb kill-server
adb start-server
adb devices
```

---

## 📂 Artifact Structure

```
dist/
├── v0.0.4_build_1_DEV.apk          # Android Debug APK
├── v0.0.4_build_1_PROD.aab         # Android Production AAB
├── v0.0.4_build_1_STAGING.ipa      # iOS Staging IPA
└── v0.0.4_build_1_PROD.ipa         # iOS Production IPA
```

**Filename format:** `v{VERSION}_build_{BUILD_NUMBER}_{ENVIRONMENT}.{EXTENSION}`

---

## 🔑 Important Notes

### Artifact Types

- **APK (Android Package)**: Directly installable file on Android devices. Used for testing and internal distribution.
- **AAB (Android App Bundle)**: Optimized format for Google Play Store. Google Play generates device-specific APKs.
- **IPA (iOS App Store Package)**: iOS package file for distribution via App Store, TestFlight, or ad-hoc installation.

### Build Type

- **debug**: Unoptimized build with debug symbols, suitable for development and testing
- **prod**: Optimized, obfuscated, signed build for store distribution

### Environments

Each environment has its own configurations (API endpoints, feature flags, etc.):
- `local`: Local development
- `dev3`, `dev6`: Separate development environments
- `qa`: Quality Assurance testing
- `staging`: Pre-production
- `prod`: Production

---

## 📄 License

MIT

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

**Built with ❤️ for React Native developers**

portento clean [options]
```

**Options:**
- `--deep`: Perform deep clean including node_modules and lock files

**Examples:**
```bash
portento clean
portento clean --deep
```

**Cleans:**
- Android: build/, .gradle/, app/build/, resource files with "node_modules" in name
- iOS: build/, Pods/, Gemfile.lock, vendor/, out/, *.xcarchive
- General: Metro cache, React Native cache
- Deep: node_modules/, yarn.lock, package-lock.json

## Configuration Files

The CLI expects the following files in your project root:

### environments.json

Contains environment-specific configuration:

```json
{
  "dev": {
    "api_url": "https://api-dev.example.com",
    "api_key": "dev-key-123"
  },
  "prod": {
    "api_url": "https://api.example.com",
    "api_key": "prod-key-456"
  }
}
```

The CLI generates `src/properties.ts` from this file with TypeScript exports.

### manifest.yaml

Contains app metadata and versioning:

```yaml
name: MyApp
packageName: com.example.myapp
bundle:
  versionName: 1.0.0
  versionCode: 1
  buildNumber: 1
```

### certificates/credentials.yaml

Contains paths to iOS certificates and provisioning profiles:

```yaml
ios:
  certificatePath: certificates/ios/certificate.p12
  certificatePassword: password123
  provisioningProfilePath: certificates/ios/profile.mobileprovision
```

## Project Structure

```
your-project/
├── environments.json
├── manifest.yaml
├── certificates/
│   └── credentials.yaml
├── android/
│   └── app/
│       └── build.gradle
├── ios/
│   └── YourApp.xcodeproj/
└── src/
    └── properties.ts (auto-generated)
```

## Build Artifacts

### Android
- **Debug builds**: Generate APK (not obfuscated)
- **Production builds**: Generate AAB with ProGuard/R8 obfuscation

### iOS
- **All builds**: Generate IPA with code signing
- Automatically manages certificates and provisioning profiles via Ruby scripts

## Environment Variables

The CLI generates `src/properties.ts` from `environments.json`:

```typescript
export const environment = "dev";
export const apiUrl = "https://api-dev.example.com";
export const apiKey = "dev-key-123";
```

Import in your React Native code:

```typescript
import { apiUrl, apiKey } from './properties';
```

## Error Handling

All commands provide detailed error messages. If a command fails:

1. Check that required configuration files exist
2. Verify environment name matches `environments.json`
3. Ensure platform tools are installed (Xcode, Android SDK)
4. Try running `portento clean --deep` and rebuilding

## License

MIT

## Support

For issues and questions, please visit: https://github.com/portento/cli/issuesMIT
