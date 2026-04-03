param(
  [string]$SchemaPath = "schema/Dump20260319.sql",
  [string]$SchemaOnlyPath = (Join-Path ([System.IO.Path]::GetTempPath()) "ERP_AKKJ\Dump20260319.tables_only.sql"),
  [string]$DbName = "erp_akkj",
  [string]$DbUser = "erpuser",
  [string]$DbPassword = "erppass123",
  [string]$DbRootPassword = "root123",
  [int]$DbPort = 3306,
  [switch]$RunApp,
  [switch]$AutoInstallTools,
  [switch]$SkipDatabaseSetup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Command {
  param(
    [string]$Name,
    [string]$DisplayName,
    [string]$WingetPackageId,
    [switch]$AllowAutoInstall
  )

  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    return
  }

  if (-not $AllowAutoInstall) {
    throw "Missing required command: $Name. Install $DisplayName manually or use -AutoInstallTools flag."
  }

  Write-Host "Installing $DisplayName via winget..."
  winget install --exact --id $WingetPackageId --accept-package-agreements --accept-source-agreements --silent --disable-interactivity 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install $DisplayName. Install manually and run installer again."
  }

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$DisplayName was installed, but command '$Name' is still not available. Open a new terminal and run installer again."
  }

  Write-Host "Successfully installed $DisplayName"
}

function Ensure-MySQL {
  param(
    [switch]$AllowAutoInstall
  )

  if (Get-Command mysql -ErrorAction SilentlyContinue) {
    Write-Host "MySQL client found in PATH"
    return
  }

  $mysqlPaths = @(
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe",
    "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe"
  )

  foreach ($path in $mysqlPaths) {
    if (Test-Path $path) {
      Write-Host "MySQL client found at $path"
      $env:PATH += ";$(Split-Path $path)"
      return
    }
  }

  $mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($mysqlService) {
    Write-Host "MySQL Service '$($mysqlService.Name)' is installed but mysql.exe not in PATH"
    Write-Host "Try adding MySQL bin directory to your PATH manually, or reinstall MySQL with PATH option enabled"
    throw "MySQL client not found in PATH. Please add MySQL bin directory to your system PATH."
  }

  if (-not $AllowAutoInstall) {
    throw "MySQL Server not found. Install manually or use -AutoInstallTools flag."
  }

  Write-Host "Installing MySQL Server via winget..."
  winget install --exact --id MySQL.MySQL --accept-package-agreements --accept-source-agreements --silent --disable-interactivity 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install MySQL Server. Install manually and run installer again."
  }

  Write-Host "MySQL Server installed. Please restart PowerShell and run installer again."
  exit 0
}

function Require-Path {
  param(
    [string]$Path,
    [string]$Label
  )
  if (-not (Test-Path $Path)) {
    throw "Missing required ${Label}: $Path"
  }
}

function Get-NodeMajorVersion {
  $raw = (node -v).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $raw) {
    throw "Unable to read Node.js version."
  }
  $clean = $raw.TrimStart("v")
  $major = [int]($clean.Split(".")[0])
  return $major
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return ($conn -and $conn.Count -gt 0)
  } catch {
    return $false
  }
}

function Assert-PortAvailable {
  param(
    [int]$Port,
    [string]$Name
  )
  if (Test-PortInUse -Port $Port) {
    throw "$Name port $Port is already in use. Free the port before running installer."
  }
}

function Test-MySQLServiceRunning {
  $mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" } | Select-Object -First 1
  if ($mysqlService) {
    Write-Host "MySQL Service '$($mysqlService.Name)' is running"
    return $true
  }
  return $false
}

function Test-MySQLConnection {
  param(
    [string]$ServerHost,
    [int]$Port,
    [string]$User,
    [string]$Password
  )

  try {
    $env:MYSQL_PWD = $Password
    $output = & mysql -h $ServerHost -P $Port -u $User -e "SELECT 1;" 2>&1
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    return $true
  } catch {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    return $false
  }
}

function Convert-DumpToTablesOnly {
  param(
    [string]$InputPath,
    [string]$OutputPath
  )

  if (-not (Test-Path $InputPath)) {
    throw "Schema file not found: $InputPath"
  }

  $lines = Get-Content -Path $InputPath
  $result = New-Object System.Collections.Generic.List[string]
  $skipMultiLineInsert = $false

  foreach ($line in $lines) {
    $trim = $line.TrimStart()

    if ($skipMultiLineInsert) {
      if ($trim -match ";\s*$") {
        $skipMultiLineInsert = $false
      }
      continue
    }

    if ($trim -match "^(?i)INSERT\s+INTO\b") {
      if ($trim -notmatch ";\s*$") {
        $skipMultiLineInsert = $true
      }
      continue
    }

    if ($trim -match "^(?i)USE\s+`?.+`?;\s*$") { continue }
    if ($trim -match "^(?i)CREATE\s+DATABASE\b") { continue }

    if ($trim -match "^(?i)LOCK\s+TABLES\b") { continue }
    if ($trim -match "^(?i)UNLOCK\s+TABLES\b") { continue }
    if ($trim -match "^/\*!\d+\s+ALTER\s+TABLE\s+.*\s+DISABLE\s+KEYS\s*\*/;\s*$") { continue }
    if ($trim -match "^/\*!\d+\s+ALTER\s+TABLE\s+.*\s+ENABLE\s+KEYS\s*\*/;\s*$") { continue }

    $result.Add($line)
  }

  $outputDir = Split-Path -Parent $OutputPath
  if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  }

  $result | Set-Content -Path $OutputPath -Encoding utf8
}

function Ensure-EnvFile {
  param(
    [string]$EnvPath,
    [int]$Port,
    [string]$Name,
    [string]$User,
    [string]$Password
  )

  $targetEnvPath = $EnvPath
  $canWriteTarget = $false

  try {
    $targetDir = Split-Path -Parent $targetEnvPath
    if ($targetDir -and -not (Test-Path $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    $probeStream = [System.IO.File]::Open($targetEnvPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    $probeStream.Close()
    $canWriteTarget = $true
  } catch {
    $canWriteTarget = $false
  }

  if (-not $canWriteTarget -and $env:ProgramData) {
    $fallbackDir = Join-Path $env:ProgramData "Pcaviator\ERP AKKJ"
    if (-not (Test-Path $fallbackDir)) {
      New-Item -ItemType Directory -Path $fallbackDir -Force | Out-Null
    }
    $targetEnvPath = Join-Path $fallbackDir ".env"
    Write-Host "Install folder is read-only. Using writable env file: $targetEnvPath"
  }

  if (-not (Test-Path $targetEnvPath)) {
    @(
      "PORT=4000"
      "JWT_SECRET=change_me_in_local"
      "JWT_REFRESH_SECRET=change_me_in_local_refresh"
      "MYSQL_HOST=localhost"
      "MYSQL_PORT=$Port"
      "MYSQL_USER=$User"
      "MYSQL_PASSWORD=$Password"
      "MYSQL_DATABASE=$Name"
    ) | Set-Content -Path $targetEnvPath -Encoding utf8
    Write-Host "Created .env with local defaults"
    return
  }

  $content = Get-Content -Raw -Path $targetEnvPath

  $replacements = @{
    "MYSQL_HOST" = "localhost"
    "MYSQL_PORT" = "$Port"
    "MYSQL_USER" = "$User"
    "MYSQL_PASSWORD" = "$Password"
    "MYSQL_DATABASE" = "$Name"
  }

  foreach ($key in $replacements.Keys) {
    $value = $replacements[$key]
    $pattern = "(?m)^" + [regex]::Escape($key) + "=.*$"
    if ($content -match $pattern) {
      $content = [regex]::Replace($content, $pattern, "$key=$value")
    } else {
      if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) {
        $content += [Environment]::NewLine
      }
      $content += "$key=$value" + [Environment]::NewLine
    }
  }

  if ($content -notmatch "(?m)^PORT=") {
    if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) {
      $content += [Environment]::NewLine
    }
    $content += "PORT=4000" + [Environment]::NewLine
  }

  if ($content -notmatch "(?m)^JWT_SECRET=") {
    if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) {
      $content += [Environment]::NewLine
    }
    $content += "JWT_SECRET=change_me_in_local" + [Environment]::NewLine
  }

  Set-Content -Path $targetEnvPath -Value $content -Encoding utf8
  if ($targetEnvPath -ne $EnvPath) {
    Write-Host "Updated writable env file at $targetEnvPath"
    Write-Host "Set ERP_AKKJ_ENV_PATH=$targetEnvPath for runtime if needed"
  } else {
    Write-Host "Updated .env MySQL connection settings"
  }
}

function Quote-MySQLIdentifier {
  param([string]$Value)
  return ('`' + ($Value -replace '`', '``') + '`')
}

function Escape-MySQLString {
  param([string]$Value)
  return ($Value -replace "'", "''")
}

function Test-DatabaseExists {
  param(
    [string]$ServerHost,
    [int]$Port,
    [string]$User,
    [string]$Password,
    [string]$DbName
  )

  try {
    $env:MYSQL_PWD = $Password
    $output = & mysql -h $ServerHost -P $Port -u $User -e "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DbName';" 2>&1
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    
    if ($output) {
      $lines = $output | Where-Object { $_ -match "\d+" }
      if ($lines) {
        $count = [int]($lines[0] -replace "[^0-9]", "")
        return $count -gt 0
      }
    }
    return $false
  } catch {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    return $false
  }
}

Write-Host "== ERP AKKJ local installer (Native MySQL, no Docker) =="

Write-Host "Running preflight checks..."

Ensure-Command -Name "node" -DisplayName "Node.js LTS" -WingetPackageId "OpenJS.NodeJS.LTS" -AllowAutoInstall:$AutoInstallTools
Ensure-Command -Name "npm" -DisplayName "npm (Node.js)" -WingetPackageId "OpenJS.NodeJS.LTS" -AllowAutoInstall:$AutoInstallTools
Ensure-MySQL -AllowAutoInstall:$AutoInstallTools

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor -lt 18) {
  throw "Node.js v18+ is required. Current major version: $nodeMajor"
}

Require-Path "package.json" "root package.json"
Require-Path "client/package.json" "frontend package.json"
Require-Path $SchemaPath "schema dump file"

Assert-PortAvailable -Port $DbPort -Name "MySQL"

if ($RunApp) {
  Assert-PortAvailable -Port 4000 -Name "API"
  Assert-PortAvailable -Port 5173 -Name "Frontend"
}

Write-Host "Preflight checks passed."

Write-Host "Checking MySQL service..."
if (-not (Test-MySQLServiceRunning)) {
  throw "MySQL Service is not running. Start MySQL Server and run installer again."
}

Write-Host "Testing MySQL connection..."
$rootPassword = ""
if (-not (Test-MySQLConnection -ServerHost "localhost" -Port $DbPort -User "root" -Password "")) {
  Write-Host "MySQL root user requires a password."
  $securePassword = Read-Host -Prompt "Enter MySQL root password" -AsSecureString
  $rootPassword = [System.Net.NetworkCredential]::new("", $securePassword).Password
  
  if (-not (Test-MySQLConnection -ServerHost "localhost" -Port $DbPort -User "root" -Password $rootPassword)) {
    throw "Cannot connect to MySQL with provided root password. Check credentials and try again."
  }
}

Write-Host "MySQL connection successful."

# Check if database already exists and has tables
Write-Host "Checking if database '$DbName' already exists..."
$databaseExists = Test-DatabaseExists -ServerHost "localhost" -Port $DbPort -User "root" -Password $rootPassword -DbName $DbName

if ($databaseExists) {
  Write-Host "Database '$DbName' already exists with tables."
  Write-Host ""
  Write-Host "Options:"
  Write-Host "  1 - Use existing database (skip schema import)"
  Write-Host "  2 - Overwrite database (delete and reimport schema)"
  Write-Host ""
  $choice = Read-Host "Enter your choice (1 or 2) [1]"
  if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }
  
  if ($choice -eq "2") {
    Write-Host "Proceeding with database overwrite..."
    $SkipDatabaseSetup = $false
  } else {
    Write-Host "Using existing database. Skipping schema import."
    $SkipDatabaseSetup = $true
  }
} else {
  Write-Host "Database '$DbName' does not exist or is empty. Will create new database."
  $SkipDatabaseSetup = $false
}

# Database setup (create/overwrite database and schema)
if (-not $SkipDatabaseSetup) {
  Write-Host "Creating table-only schema file..."
  Convert-DumpToTablesOnly -InputPath $SchemaPath -OutputPath $SchemaOnlyPath

  Write-Host "Initializing database schema (tables only)..."
  $quotedDbName = Quote-MySQLIdentifier -Value $DbName
  $escapedDbUser = Escape-MySQLString -Value $DbUser
  $escapedDbPassword = Escape-MySQLString -Value $DbPassword
  $env:MYSQL_PWD = $rootPassword
  mysql -u root -e "CREATE DATABASE IF NOT EXISTS $quotedDbName;" 2>&1 | Out-Null
  Get-Content -Raw $SchemaOnlyPath | mysql -u root --database="$DbName" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    throw "Failed to import schema into MySQL."
  }

  Write-Host "Creating MySQL user $DbUser..."
  mysql -u root -e "CREATE USER IF NOT EXISTS '$escapedDbUser'@'localhost' IDENTIFIED BY '$escapedDbPassword';" 2>&1 | Out-Null
  mysql -u root -e "GRANT ALL PRIVILEGES ON $quotedDbName.* TO '$escapedDbUser'@'localhost';" 2>&1 | Out-Null
  mysql -u root -e "FLUSH PRIVILEGES;" 2>&1 | Out-Null
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
} else {
  Write-Host "Skipping database setup (using existing database)."
  Write-Host "Verifying MySQL user '$DbUser' has permissions..."
}

Ensure-EnvFile -EnvPath ".env" -Port $DbPort -Name $DbName -User $DbUser -Password $DbPassword

# Skip npm install if node_modules already exists and is not empty
$backendNodeModulesExists = (Test-Path "node_modules") -and @(Get-ChildItem -Path "node_modules" -ErrorAction SilentlyContinue).Count -gt 0
$frontendNodeModulesExists = (Test-Path "client/node_modules") -and @(Get-ChildItem -Path "client/node_modules" -ErrorAction SilentlyContinue).Count -gt 0

if (-not $backendNodeModulesExists) {
  Write-Host "Installing backend dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install backend dependencies."
  }
} else {
  Write-Host "Backend dependencies already installed. Skipping npm install."
}

if (-not $frontendNodeModulesExists) {
  Write-Host "Installing frontend dependencies..."
  npm --prefix client install
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install frontend dependencies."
  }
} else {
  Write-Host "Frontend dependencies already installed. Skipping npm install."
}

Write-Host "Local setup complete."
Write-Host "Start both services with: npm run dev:both"
Write-Host "Frontend URL: http://localhost:5173"
Write-Host "Backend URL: http://localhost:4000"

if ($RunApp) {
  npm run dev:both
}
