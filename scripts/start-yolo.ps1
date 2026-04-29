$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root 'server')

if (Test-Path "$root\.venv\Scripts\python.exe") {
  & "$root\.venv\Scripts\python.exe" "main.py"
} else {
  python main.py
}
