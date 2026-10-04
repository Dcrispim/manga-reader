# Android Toolchain Setup for Manga Reader App

**Status:** Complete  
**Date:** 2026-10-04  
**Platform:** CachyOS (Arch Linux)  
**Shell:** fish

## Installation Summary

All tools have been successfully installed and configured for Expo development builds on Android.

### Java Development Kit (JDK)
- **Version:** 17.0.20.1 (OpenJDK)
- **Command:** `java -version`
- **Status:** ✓ Installed and verified

### Android SDK

#### cmdline-tools
- **Location:** `~/Android/Sdk/cmdline-tools/latest/`
- **Version:** Latest (2026-10-04)
- **Status:** ✓ Installed

#### Platform-tools
- **Version:** 37.0.1
- **Components:** adb, fastboot, and utilities
- **Status:** ✓ Installed

#### Build-tools
- **Version:** 37.0.0 (stable)
- **Status:** ✓ Installed
- **Note:** Chosen as latest stable version; compatible with Expo SDK

#### Target API and System Image
- **Target API:** 36 (Android 16)
- **System Image:** google_apis x86_64
- **Status:** ✓ Installed
- **Rationale:** Expo SDK requires API 36 minimum; API 36 used per documentation at https://docs.expo.dev/get-started/set-up-your-environment/

#### Emulator
- **Version:** 37.2.12.0
- **Status:** ✓ Installed

### Environment Configuration

#### Android SDK Configuration
- **File:** `~/.config/fish/conf.d/android.fish`
- **Variables:**
  ```fish
  set -gx ANDROID_HOME $HOME/Android/Sdk
  set -gx PATH $ANDROID_HOME/platform-tools $ANDROID_HOME/emulator $ANDROID_HOME/cmdline-tools/latest/bin $PATH
  ```
- **Status:** ✓ Configured
- **Scope:** Isolated to fish shell via `conf.d/` for cleaner system configuration

### Android Virtual Devices (AVDs)

#### manga_phone (Pixel 7)
- **Device:** Pixel 7 phone profile
- **API Level:** 36
- **System Image:** google_apis x86_64
- **Status:** ✓ Created
- **Launch:** `export ANDROID_HOME=$HOME/Android/Sdk && export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH && emulator -avd manga_phone -no-window -no-audio -no-snapshot-save`
- **Verify boot:** `adb shell getprop sys.boot_completed` (should return `1`)

#### manga_tablet (Pixel Tablet)
- **Device:** Pixel Tablet profile
- **API Level:** 36
- **System Image:** google_apis x86_64
- **Status:** ✓ Created
- **Launch:** `export ANDROID_HOME=$HOME/Android/Sdk && export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH && emulator -avd manga_tablet -no-window -no-audio -no-snapshot-save`

### Maestro CLI

- **Version:** 2.11.0
- **Installation:** `curl -fsSL "https://get.maestro.mobile.dev" | bash`
- **Location:** `~/.maestro/bin/maestro`
- **Status:** ✓ Installed
- **Usage:** `export PATH=$PATH:$HOME/.maestro/bin && maestro --version`

### Hardware Virtualization

#### KVM Support
- **Device:** `/dev/kvm`
- **Status:** ✓ Available (crw-rw-rw- root:kvm)
- **User in kvm group:** Not required (device has world-readable permissions)
- **Performance:** Emulator will use KVM acceleration when available

## Testing

### Emulator Boot Test
- **Command:** Headless boot with `-no-window -no-audio -no-snapshot-save`
- **Status:** ✓ Completed
- **Result:** Emulator starts successfully and reaches boot completion (sys.boot_completed = 1)

## Usage Quick Reference

### Start Emulators

```bash
# Set environment (add to ~/.config/fish/conf.d/android.fish or shell startup)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH

# Phone emulator (background)
emulator -avd manga_phone &

# Tablet emulator (background)
emulator -avd manga_tablet &

# Headless (for CI/testing)
emulator -avd manga_phone -no-window -no-audio -no-snapshot-save &

# List connected devices
adb devices

# Check device boot status
adb shell getprop sys.boot_completed

# Kill specific emulator
adb -s emulator-5554 emu kill
```

### Maestro E2E Testing

```bash
# Check version
maestro --version

# Run test flow
maestro test flow.yaml

# Advanced: analyze with AI
maestro test flow.yaml --analyze | bash
```

## Verification Checklist

- [x] `java -version` outputs Java 17.0.20.1
- [x] `adb version` returns 37.0.1
- [x] `emulator -avd manga_phone` starts without errors
- [x] `adb shell getprop sys.boot_completed` returns `1`
- [x] `maestro --version` returns 2.11.0
- [x] AVD `manga_phone` created successfully
- [x] AVD `manga_tablet` created successfully
- [x] `/dev/kvm` device exists and is accessible

## Dependencies

- **JDK 17 (OpenJDK):** Required by Expo SDK, Android SDK tools, and Maestro
- **Android SDK cmdline-tools:** Required for managing SDK components
- **Android platform-tools (37.0.1):** Required for adb and device communication
- **Android build-tools (37.0.0):** Required for compilation
- **Android SDK Platform 36:** Required target platform
- **Android System Image (google_apis x86_64):** Required for emulation
- **Maestro CLI (2.11.0):** Required for E2E testing

## Next Steps

1. Clone the Manga Reader repository
2. Install Node.js dependencies: `npm install`
3. Configure Expo with development build tools
4. Create development build for Android: `eas build --platform android --local`
5. Deploy to emulator or physical device via adb/Expo CLI

## Notes

- All tool versions are production-stable as of 2026-10-04
- API 36 selected based on Expo SDK documentation (minimum requirement)
- build-tools 37.0.0 selected as latest stable version compatible with API 36
- The emulator can run with or without GPU acceleration (gracefully falls back to software rendering)
- Fish shell configuration isolated in `conf.d/android.fish` prevents system-wide environment pollution
- All paths configured as environment variables for portability and easy updates
