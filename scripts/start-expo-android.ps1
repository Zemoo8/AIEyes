$ErrorActionPreference = 'Stop'

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"

Write-Host "JAVA:"
java -version

Write-Host "ADB devices:"
adb devices

# Use a fixed free port to avoid interactive prompt on 8082 conflicts.
npx expo start --port 8083
