param([switch]$Apply, [switch]$Check, [switch]$Code)
# Krok 1:  .\setup.ps1          – otwiera .env w Notatniku (wklejasz klucze i zapisujesz)
# Krok 2:  .\setup.ps1 -Apply   – sprawdza klucze i stawia całego bota w chmurze
# Inne:    .\setup.ps1 -Check   – tylko sprawdzenie kluczy;  .\setup.ps1 -Code – wgranie nowszej wersji kodu
Set-Location $PSScriptRoot
if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund }
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if ($Apply) { node scripts/setup.js; exit $LASTEXITCODE }
if ($Check) { node scripts/setup.js --check; exit $LASTEXITCODE }
if ($Code) { node scripts/setup.js --code; exit $LASTEXITCODE }
notepad .env
Write-Host "Po zapisaniu .env uruchom: .\setup.ps1 -Apply"
