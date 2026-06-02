$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
  throw "Missing backend/.env"
}

# Load DB settings from backend/.env
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }

  $parts = $line -split "=", 2
  if ($parts.Count -ne 2) { return }

  $name = $parts[0].Trim()
  $value = $parts[1].Trim()

  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  Set-Item -Path ("Env:" + $name) -Value $value
}

if (-not $env:DB_HOST -or -not $env:DB_NAME -or -not $env:DB_USER) {
  throw "Missing DB_* values in backend/.env"
}

$port = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
if ($env:DB_PASSWORD) { $env:PGPASSWORD = $env:DB_PASSWORD }

$pgDump = $null
$pgDumpCommand = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDumpCommand) {
  $pgDump = $pgDumpCommand.Source
} else {
  $candidates = @(
    "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
  )

  foreach ($path in $candidates) {
    if (Test-Path $path) {
      $pgDump = $path
      break
    }
  }
}

if (-not $pgDump) {
  throw "pg_dump not found. Install PostgreSQL or add pg_dump to PATH."
}

$backupFile = Join-Path $root "db_backup.sql"

& $pgDump --host $env:DB_HOST --port $port --username $env:DB_USER --format=plain --no-owner --no-privileges --file $backupFile $env:DB_NAME
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE."
}

$info = Get-Item $backupFile
Write-Host ("Backup updated: {0} ({1} bytes) {2}" -f $info.FullName, $info.Length, $info.LastWriteTime)

# .\db_backup_script.ps1