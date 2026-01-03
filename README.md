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

Avvia il Metro bundler per lo sviluppo.

```bash
portento start [options]
```

**Opzioni:**

| Parametro | Alias | Tipo | Descrizione | Default |
|-----------|-------|------|-------------|---------|
| `--environment` | `-e` | `string` | Ambiente di destinazione | `dev` |
| `--reset-cache` | - | `boolean` | Resetta la cache di Metro | `false` |

**Ambienti supportati:**
- `local` - Sviluppo locale
- `dev`, `dev3`, `dev6` - Ambienti di sviluppo
- `qa` - Quality Assurance
- `staging` - Pre-produzione
- `prod` - Produzione

**Esempi:**

```bash
# Avvia con ambiente dev (default)
portento start

# Avvia con ambiente QA
portento start -e qa

# Avvia con cache pulita
portento start -e prod --reset-cache
```

---

### `install` - Install and Run App

Installa e avvia l'app su un dispositivo o simulatore. Se non viene specificato un `--deviceId`, il comando trova automaticamente il primo dispositivo disponibile o avvia un emulatore/simulatore.

```bash
portento install [options]
```

**Opzioni:**

| Parametro | Alias | Tipo | Descrizione | Default |
|-----------|-------|------|-------------|---------|
| `--platform` | `-p` | `android\|ios` | **Obbligatorio**. Piattaforma target | - |
| `--environment` | `-e` | `string` | Ambiente di destinazione | `dev` |
| `--buildType` | `-t` | `debug\|prod` | Tipo di build | `prod` |
| `--deviceId` | - | `string` | ID o nome del dispositivo | - |

**Comportamento automatico senza `--deviceId`:**

**Android:**
1. Controlla dispositivi connessi con `adb devices`
2. Se trova un dispositivo connesso, lo usa
3. Altrimenti, avvia il primo emulatore disponibile con `emulator -avd <name>`
4. Restituisce il device ID (es. `emulator-5554`)

**iOS:**
1. Cerca simulatori con `xcrun simctl list devices`
2. Se trova un simulatore già avviato (stato `Booted`), lo usa
3. Altrimenti avvia il primo simulatore disponibile
4. Restituisce il nome del simulatore

**Rilevamento Device ID:**
- **Android**: Se `--deviceId` non è specificato, usa il primo disponibile
- **iOS**: 
  - Se `--deviceId` è in formato UDID (`XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`), viene usato come UDID del simulatore
  - Altrimenti viene interpretato come nome del dispositivo o simulatore
  - Se omesso, usa il primo simulatore disponibile

**Esempi:**

```bash
# Android - trova/avvia automaticamente un device
portento install -p android -e qa

# iOS - trova/avvia automaticamente un simulatore
portento install -p ios -e staging

# Android - dispositivo specifico
portento install -p android --deviceId=emulator-5554 -e dev

# iOS - simulatore specifico
portento install -p ios --deviceId="iPhone 15 Pro" -e qa

# iOS - dispositivo fisico tramite UDID
portento install -p ios --deviceId=00008110-001A12345678901E -e prod
```

---

### `build` - Build App

Compila l'applicazione per la distribuzione in produzione o debug.

```bash
portento build [options]
```

**Opzioni:**

| Parametro | Alias | Tipo | Descrizione | Default |
|-----------|-------|------|-------------|---------|
| `--platform` | `-p` | `android\|ios` | **Obbligatorio**. Piattaforma target | - |
| `--environment` | `-e` | `string` | Ambiente di destinazione | `dev` |
| `--buildType` | `-t` | `debug\|prod` | Tipo di build | `prod` |

**Artifact Generati:**

#### Android

| buildType | Comando Gradle | Artifact | Posizione | Descrizione |
|-----------|----------------|----------|-----------|-------------|
| `debug` | `./gradlew assembleDebug` | **APK** | `dist/v{VERSION}_build_{BUILD}_{ENV}.apk` | File APK installabile per testing |
| `prod` | `./gradlew bundleRelease` | **AAB** | `dist/v{VERSION}_build_{BUILD}_{ENV}.aab` | Android App Bundle per Google Play Store |

**Esempio nome file Android:**
- Debug: `v0.0.4_build_1_DEV.apk`
- Prod: `v0.0.4_build_1_PROD.aab`

#### iOS

| buildType | Configurazione Xcode | Artifact | Posizione | Descrizione |
|-----------|----------------------|----------|-----------|-------------|
| `debug` | `Debug` | **IPA** | `dist/v{VERSION}_build_{BUILD}_{ENV}.ipa` | IPA con configurazione Debug |
| `prod` | `Release` | **IPA** | `dist/v{VERSION}_build_{BUILD}_{ENV}.ipa` | IPA ottimizzato per App Store/TestFlight |

**Esempio nome file iOS:**
- Debug: `v0.0.4_build_1_STAGING.ipa`
- Prod: `v0.0.4_build_1_PROD.ipa`

**Workflow di Build:**

**Android - Debug (APK):**
1. Configura ambiente
2. Pulisce build precedenti (`./gradlew clean`)
3. Esegue `./gradlew assembleDebug`
4. Genera APK pronto per installazione manuale

**Android - Prod (AAB):**
1. Configura ambiente produzione
2. Imposta keystore per firma
3. Esegue `./gradlew bundleRelease`
4. Genera AAB pronto per Google Play Console

**iOS - Debug/Prod (IPA):**
1. Installa dipendenze CocoaPods
2. Esegue archivio Xcode (`xcodebuild archive`)
3. Esporta IPA (`xcodebuild -exportArchive`)
4. Copia in `dist/`

**Esempi:**

```bash
# Android - Debug APK
portento build -p android -t debug -e qa

# Android - Produzione AAB per Play Store
portento build -p android -t prod -e prod

# iOS - Debug IPA
portento build -p ios -t debug -e staging

# iOS - Produzione IPA per App Store
portento build -p ios -t prod -e prod
```

---

### `devices` - List Devices

Elenca tutti i dispositivi e simulatori/emulatori disponibili per Android e iOS.

```bash
portento devices
```

**Output:**

**Android:**
- Dispositivi connessi con device ID da usare in `--deviceId`
- Emulatori disponibili (non avviati)

**iOS:**
- Simulatori e dispositivi fisici con UDID e stato

**Esempio output:**

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

Pulisce tutti gli artifact di build, cache e dipendenze.

```bash
portento clean
```

**Cosa viene pulito:**
- Build directory Android (`android/build`, `android/app/build`)
- Build directory iOS (`ios/build`, `ios/DerivedData`)
- Node modules cache
- Metro bundler cache
- Temporary files

---

## 📝 Esempi Pratici

### Workflow Sviluppo Tipico

```bash
# Terminal 1 - Avvia Metro bundler
portento start -e dev6

# Terminal 2 - Installa su dispositivo
portento install -p ios -e dev6
```

### Release Android

```bash
# Build AAB per produzione
portento build -p android -t prod -e prod

# Output: dist/v0.0.4_build_1_PROD.aab
# Upload su Google Play Console
```

### Release iOS

```bash
# Build IPA per produzione
portento build -p ios -t prod -e prod

# Output: dist/v0.0.4_build_1_PROD.ipa
# Upload su App Store Connect con Transporter
```

### Testing su Dispositivo Fisico

```bash
# Android - trova device ID
adb devices
portento install -p android --deviceId="RF8N12345AB" -e qa

# iOS - trova UDID
instruments -s devices
portento install -p ios --deviceId=00008110-001A12345678901E -e qa
```

---

## 🐛 Troubleshooting

### Android - Build Fallisce

```bash
cd android
./gradlew clean
cd ..
portento build -p android -t debug
```

### iOS - Pod Install Fallisce

```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
portento build -p ios -t debug
```

### Metro Bundler - Problemi di Cache

```bash
portento start --reset-cache

# In un altro terminale
watchman watch-del-all
```

### ADB Non Rileva Dispositivi

```bash
adb kill-server
adb start-server
adb devices
```

---

## 📂 Struttura Artifact

```
dist/
├── v0.0.4_build_1_DEV.apk          # Android Debug APK
├── v0.0.4_build_1_PROD.aab         # Android Production AAB
├── v0.0.4_build_1_STAGING.ipa      # iOS Staging IPA
└── v0.0.4_build_1_PROD.ipa         # iOS Production IPA
```

**Formato nome file:** `v{VERSION}_build_{BUILD_NUMBER}_{ENVIRONMENT}.{EXTENSION}`

---

## 🔑 Note Importanti

### Tipi di Artifact

- **APK (Android Package)**: File installabile direttamente su dispositivi Android. Usato per testing e distribuzione interna.
- **AAB (Android App Bundle)**: Formato ottimizzato per Google Play Store. Google Play genera APK specifici per ogni dispositivo.
- **IPA (iOS App Store Package)**: File pacchetto iOS per distribuzione via App Store, TestFlight o installazione ad-hoc.

### Build Type

- **debug**: Build non ottimizzata con simboli di debug, adatta per sviluppo e testing
- **prod**: Build ottimizzata, obfuscata, firmata per distribuzione su store

### Ambienti

Ogni ambiente ha le proprie configurazioni (API endpoints, feature flags, ecc.):
- `local`: Sviluppo locale
- `dev3`, `dev6`: Ambienti di sviluppo separati
- `qa`: Quality Assurance testing
- `staging`: Pre-produzione
- `prod`: Produzione

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

