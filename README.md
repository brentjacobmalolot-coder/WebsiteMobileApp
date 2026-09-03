# CampusAlert Pro

## Next-Generation Campus Safety Platform

**Seconds Matter.** CampusAlert Pro is a high-security, real-time emergency response and notification ecosystem for university campuses — delivering sub-second alerts, on-device AI threat monitoring, and encrypted mesh communication.

---

## Repository Structure

```
CampusAlertPro/
├── website/                          # Marketing landing page (HTML5 / Tailwind CSS)
│   └── CampusAlert.html             # Production-optimized, responsive landing page
│
├── backend/                          # Firebase Cloud Functions backend
│   ├── functions/
│   │   ├── src/index.ts              # Secure broadcast, subscribe, acknowledge functions
│   │   └── package.json
│   └── firestore.rules               # Immutable RBAC Firestore security rules
│
└── mobile/                           # Native mobile clients
    ├── android/                      # Android (Kotlin / Jetpack Compose / Room)
    │   └── app/src/main/java/com/campusalert/pro/
    │       ├── data/
    │       │   ├── dao/EmergencyDao.kt
    │       │   ├── database/CampusDatabase.kt
    │       │   └── entity/EmergencyProtocolEntity.kt
    │       ├── domain/
    │       │   ├── model/EmergencyProtocol.kt
    │       │   └── repository/EmergencyRepository.kt
    │       ├── di/AppModule.kt
    │       └── ui/
    │           ├── theme/Theme.kt
    │           └── screens/
    │               ├── EmergencyScreen.kt
    │               └── EmergencyViewModel.kt
    │
    └── ios/                          # iOS (Swift / SwiftUI / CoreData)
        └── CampusAlertPro/
            ├── AppDelegate.swift
            ├── Data/PersistentController.swift
            ├── Models/EmergencyProtocolEntity.swift
            ├── Repository/EmergencyRepository.swift
            └── Views/EmergencyView.swift
```

---

## Architecture Overview

### Multi-Layer Defense

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Presentation** | Jetpack Compose / SwiftUI | Reactive, offline-aware UI |
| **Domain** | Kotlin Coroutines + Flow | Business logic, state management |
| **Data** | Room (Android) / CoreData (iOS) | Encrypted local persistence |
| **Sync** | Firebase Firestore | Real-time protocol distribution |
| **Messaging** | Firebase Cloud Messaging v2 | Sub-second push delivery |
| **Auth** | Firebase Auth + MFA | Multi-factor authentication |
| **AI** | TensorFlow Lite | On-device anomaly detection |
| **Security** | SQLCipher / FileProtection | AES-256 at-rest encryption |

### Security Model

- **RBAC**: Custom claims (`dispatcher`, `soc_operator`, `admin`) enforced at every Cloud Function entry point
- **Dual-control**: CRITICAL alerts require a second-authorizer token from a separate dispatcher
- **Immutable audit log**: Every alert dispatch is written to `emergency_audit_log` with `serverTimestamp()`
- **MFA gate**: All dispatch operations require TOTP MFA enrollment
- **TLS 1.3**: All data in transit; AES-256 at rest via SQLCipher / iOS FileProtection
- **FERPA/GDPR compliant**: No student records stored outside institutional tenancy

---

## Quick Start

### Backend

```bash
cd backend/functions
npm install
npm run build

# Deploy to Firebase
firebase login
firebase deploy --only functions
```

### Android

```bash
cd mobile/android
./gradlew assembleDebug

# Install on device
adb install app/build/outputs/apk/debug/app-debug.apk
```

### iOS

```bash
cd mobile/ios
xcodebuild -workspace CampusAlertPro.xcworkspace \
  -scheme CampusAlertPro \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build
```

---

## Landing Page

Open `website/CampusAlert.html` directly in any browser — no build step required.

To open in Visual Studio Code:

```bash
code C:/Users/HomePC/Projects/CampusAlertPro/website/CampusAlert.html
```

---

## Environment Variables

### Firebase Configuration (Android)
Place `google-services.json` in `mobile/android/app/`.

### Firebase Configuration (iOS)
Place `GoogleService-Info.plist` in `mobile/ios/`.

### Cloud Functions Secrets
```bash
firebase functions:secrets:set FIRESTORE_EMULATOR_HOST=localhost:8080
```

---

## License

Proprietary. All rights reserved. CampusAlert Pro, Inc.
