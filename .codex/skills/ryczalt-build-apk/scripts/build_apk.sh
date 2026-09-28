#!/usr/bin/env bash
set -Eeuo pipefail

project_root="${1:-$PWD}"
project_root="$(cd "$project_root" && pwd)"
expected_package="pl.ryczalt.rental"
artifact="$project_root/artifacts/app/ryczalt.apk"

if [[ ! -f "$project_root/app.json" || ! -f "$project_root/package.json" ]]; then
  echo "Run this from the Ryczałt Expo project root (or pass its path)." >&2
  exit 2
fi

configured_package="$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.expo?.android?.package ?? "")' "$project_root/app.json")"
if [[ "$configured_package" != "$expected_package" ]]; then
  echo "Unexpected Android package: '$configured_package' (expected '$expected_package'). Refusing to replace the artifact." >&2
  exit 2
fi

java_home="${JAVA_HOME:-}"
java_major="$(if [[ -n "$java_home" && -x "$java_home/bin/java" ]]; then "$java_home/bin/java" -version 2>&1; fi | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -1)"
if [[ "$java_major" != "17" ]]; then java_home=""; fi
if [[ -z "$java_home" && -x /usr/libexec/java_home ]]; then
  candidate="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  candidate_major="$(if [[ -n "$candidate" && -x "$candidate/bin/java" ]]; then "$candidate/bin/java" -version 2>&1; fi | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -1)"
  if [[ "$candidate_major" == "17" ]]; then java_home="$candidate"; fi
fi
if [[ -z "$java_home" ]]; then
  for candidate in /Users/alex/.sdkman/candidates/java/17*; do
    if [[ -x "$candidate/bin/java" ]]; then
      candidate_major="$("$candidate/bin/java" -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -1)"
      if [[ "$candidate_major" == "17" ]]; then java_home="$candidate"; break; fi
    fi
  done
fi
if [[ -z "$java_home" || ! -x "$java_home/bin/java" ]]; then
  echo "JDK 17 is required. Set JAVA_HOME to a local JDK 17 installation." >&2
  exit 2
fi
java_major="$("$java_home/bin/java" -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -1)"
if [[ "$java_major" != "17" ]]; then
  echo "Resolved JDK is not version 17: $java_home" >&2
  exit 2
fi
export JAVA_HOME="$java_home"
export PATH="$JAVA_HOME/bin:$PATH"

sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}}"
if [[ ! -d "$sdk_root" ]]; then
  echo "Android SDK not found at '$sdk_root'. Set ANDROID_SDK_ROOT or ANDROID_HOME." >&2
  exit 2
fi
export ANDROID_HOME="$sdk_root"
export ANDROID_SDK_ROOT="$sdk_root"

echo "Using Java: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
echo "Using Android SDK: $ANDROID_SDK_ROOT"
cd "$project_root"
npx expo prebuild --no-install --platform android
(cd android && ./gradlew --no-daemon clean assembleRelease)

candidate="$project_root/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -s "$candidate" ]]; then
  echo "Release APK was not produced at $candidate" >&2
  exit 1
fi
unzip -t "$candidate" >/dev/null
bundle_entry="$(unzip -Z1 "$candidate" | grep -Fx 'assets/index.android.bundle' || true)"
if [[ -z "$bundle_entry" ]]; then
  echo "APK does not contain the embedded Android JS bundle; refusing to publish a non-standalone artifact." >&2
  exit 1
fi

build_tools="$(node -e 'const fs=require("fs");const p=process.argv[1];const versions=fs.readdirSync(p).filter(v=>/^\d+(\.\d+)*$/.test(v)).sort((a,b)=>{const x=a.split(".").map(Number),y=b.split(".").map(Number);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}return 0;});if(versions.length)process.stdout.write(require("path").join(p,versions.at(-1)));' "$ANDROID_SDK_ROOT/build-tools")"
apksigner="$build_tools/apksigner"
aapt="$build_tools/aapt"
if [[ ! -x "$apksigner" || ! -x "$aapt" ]]; then
  echo "Android build-tools must include apksigner and aapt (searched '$build_tools')." >&2
  exit 2
fi
"$apksigner" verify --verbose "$candidate" >/dev/null
manifest_output="$("$aapt" dump badging "$candidate")"
manifest_package="$(printf '%s\n' "$manifest_output" | sed -n "s/^package: name='\\([^']*\\)'.*/\\1/p")"
if [[ "$manifest_package" != "$expected_package" ]]; then
  echo "Built APK package '$manifest_package' does not match '$expected_package'." >&2
  exit 1
fi

mkdir -p "$(dirname "$artifact")"
temporary_artifact="$(mktemp "${artifact}.tmp.XXXXXX")"
trap 'rm -f "$temporary_artifact"' EXIT
cp "$candidate" "$temporary_artifact"
chmod 644 "$temporary_artifact"
mv -f "$temporary_artifact" "$artifact"
trap - EXIT

echo "APK replaced: $artifact"
ls -lh "$artifact"
shasum -a 256 "$artifact"
echo "Package: $manifest_package"
echo "Signature: verified by apksigner"
