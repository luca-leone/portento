# @portento/cli

General-purpose CLI for React Native project build and deployment with support for iOS and Android platforms.

## Installation

```bash
npm install -g @portento/cli
```

## Requirements

- Node.js >= 20.11.0
- For iOS builds: Xcode, CocoaPods
- For Android builds: Android SDK, Gradle
- Ruby (for iOS certificate/provisioning management)

## Usage

After installation, use the `portento` command:

```bash
portento <command> [options]
```

## Commands

### start

Start Metro bundler with environment-specific configuration.

```bash
portento start --env <environment>
```

**Options:**
- `--env, -e <environment>`: Environment to use (required)
- `--reset-cache`: Reset Metro bundler cache

**Example:**
```bash
portento start --env dev
portento start --env prod --reset-cache
```

### build

Build iOS or Android application for specified environment.

```bash
portento build --platform <platform> --env <environment> [options]
```

**Options:**
- `--platform, -p <platform>`: Platform to build (ios|android) (required)
- `--env, -e <environment>`: Environment to use (required)
- `--build-type, -b <type>`: Build type (debug|prod) (default: debug)

**Examples:**
```bash
portento build --platform ios --env prod --build-type prod
portento build --platform android --env dev --build-type debug
```

**Output:**
- iOS: IPA file in `dist/v{VERSION}_{BUILD}_{ENV}.ipa`
- Android: AAB (prod) or APK (debug) in `dist/v{VERSION}_{BUILD}_{ENV}.{aab|apk}`

### install

Install and run the app on a connected device or simulator.

```bash
portento install --platform <platform> --env <environment> [options]
```

**Options:**
- `--platform, -p <platform>`: Platform to install on (ios|android) (required)
- `--env, -e <environment>`: Environment to use (required)
- `--device, -d <deviceId>`: Specific device ID to install on (optional)

**Examples:**
```bash
portento install --platform ios --env dev
portento install --platform android --env qa --device emulator-5554
```

### devices

List all connected iOS and Android devices/simulators.

```bash
portento devices
```

### clean

Clean all build artifacts, caches, and dependencies.

```bash
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

## Development

To work on this CLI:

```bash
git clone https://github.com/portento/cli.git
cd cli
npm install
npm run build
npm link
```

## License

MIT

## Support

For issues and questions, please visit: https://github.com/portento/cli/issuesMIT
