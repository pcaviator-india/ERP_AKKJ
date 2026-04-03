param(
  [string]$SchemaPath = "schema/Dump20260319.sql",
  [string]$SchemaOnlyPath = "schema/Dump20260319.tables_only.sql",
  [string]$DbName = "erp_akkj",
  [string]$DbUser = "erpuser",
  [string]$DbPassword = "erppass123",
  [string]$DbRootPassword = "root123",
  [int]$DbPort = 3306,
  [switch]$RunApp,
  [switch]$AutoInstallTools
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Install-WithWinget {
  param(
    [string]$PackageId,
    [string]$DisplayName
  )

  Require-Command "winget"

  Write-Host "Installing $DisplayName via winget..."
  winget install --exact --id $PackageId --accept-package-agreements --accept-source-agreements --silent --disable-interactivity
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install $DisplayName using winget (package id: $PackageId)."
  }
}

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
    throw "Missing required command: $Name"
  }

  Install-WithWinget -PackageId $WingetPackageId -DisplayName $DisplayName

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$DisplayName was installed, but command '$Name' is still not available in this terminal. Open a new terminal and run installer again."
  }
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

function Run-Preflight {
  param(
    [string]$SchemaFile,
    [int]$DatabasePort,
    [switch]$WillRunApp,
    [switch]$AllowAutoInstall
  )

  Write-Host "Running preflight checks..."

  Ensure-Command -Name "node" -DisplayName "Node.js LTS" -WingetPackageId "OpenJS.NodeJS.LTS" -AllowAutoInstall:$AllowAutoInstall
  Ensure-Command -Name "npm" -DisplayName "npm (Node.js)" -WingetPackageId "OpenJS.NodeJS.LTS" -AllowAutoInstall:$AllowAutoInstall
  Ensure-Command -Name "docker" -DisplayName "Docker Desktop" -WingetPackageId "Docker.DockerDesktop" -AllowAutoInstall:$AllowAutoInstall

  $nodeMajor = Get-NodeMajorVersion
  if ($nodeMajor -lt 18) {
    throw "Node.js v18+ is required. Current major version: $nodeMajor"
  }

  Require-Path "package.json" "root package.json"
  Require-Path "client/package.json" "frontend package.json"
  Require-Path "docker-compose.local.yml" "docker compose file"
  Require-Path $SchemaFile "schema dump file"

  try {
    docker info | Out-Null
  } catch {
    throw "Docker daemon is not available. Start Docker Desktop and run the installer again."
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Docker daemon is not available. Start Docker Desktop and run the installer again."
  }

  try {
    docker compose version | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Docker Compose check failed"
    }
  } catch {
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
      throw "Docker Compose is required. Install Docker Desktop and enable Docker Compose."
    }
  }

  Assert-PortAvailable -Port $DatabasePort -Name "MySQL"

  if ($WillRunApp) {
    Assert-PortAvailable -Port 4000 -Name "API"
    Assert-PortAvailable -Port 5173 -Name "Frontend"
  }

  Write-Host "Preflight checks passed."
}

function Get-ComposeCommand {
  try {
    docker compose version | Out-Null
    return @("docker", "compose")
  } catch {
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
      return @("docker-compose")
    }
    throw "Docker Compose is required. Install Docker Desktop and enable Docker Compose."
  }
}

function Invoke-Compose {
  param(
    [string[]]$ComposeCommand,
    [string[]]$ComposeArgs
  )

  if ($ComposeCommand.Length -eq 1) {
    & $ComposeCommand[0] @ComposeArgs
    return
  }

  & $ComposeCommand[0] $ComposeCommand[1] @ComposeArgs
}

function Ensure-EnvFile {
  param(
    [string]$EnvPath,
    [int]$Port,
    [string]$Name,
    [string]$User,
    [string]$Password
  )

  if (-not (Test-Path $EnvPath)) {
    @(
      "PORT=4000"
      "JWT_SECRET=change_me_in_local"
      "JWT_REFRESH_SECRET=change_me_in_local_refresh"
      "MYSQL_HOST=localhost"
      "MYSQL_PORT=$Port"
      "MYSQL_USER=$User"
      "MYSQL_PASSWORD=$Password"
      "MYSQL_DATABASE=$Name"
    ) | Set-Content -Path $EnvPath -Encoding utf8
    Write-Host "Created .env with local defaults"
    return
  }

  $current = Get-Content -Path $EnvPath
  $keys = @{}
  foreach ($line in $current) {
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)=") {
      $keys[$matches[1]] = $true
    }
  }

  $additions = @()
  if (-not $keys.ContainsKey("MYSQL_HOST")) { $additions += "MYSQL_HOST=localhost" }
  if (-not $keys.ContainsKey("MYSQL_PORT")) { $additions += "MYSQL_PORT=$Port" }
  if (-not $keys.ContainsKey("MYSQL_USER")) { $additions += "MYSQL_USER=$User" }
  if (-not $keys.ContainsKey("MYSQL_PASSWORD")) { $additions += "MYSQL_PASSWORD=$Password" }
  if (-not $keys.ContainsKey("MYSQL_DATABASE")) { $additions += "MYSQL_DATABASE=$Name" }
  if (-not $keys.ContainsKey("PORT")) { $additions += "PORT=4000" }
  if (-not $keys.ContainsKey("JWT_SECRET")) { $additions += "JWT_SECRET=change_me_in_local" }

  if ($additions.Count -gt 0) {
    Add-Content -Path $EnvPath -Value ""
    Add-Content -Path $EnvPath -Value $additions
    Write-Host "Updated existing .env with missing keys"
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

Write-Host "== ERP AKKJ local installer =="

Run-Preflight -SchemaFile $SchemaPath -DatabasePort $DbPort -WillRunApp:$RunApp -AllowAutoInstall:$AutoInstallTools

$compose = Get-ComposeCommand
$composeArgs = @("-f", "docker-compose.local.yml")

Ensure-EnvFile -EnvPath ".env" -Port $DbPort -Name $DbName -User $DbUser -Password $DbPassword

Write-Host "Starting MySQL container..."
Invoke-Compose -ComposeCommand $compose -ComposeArgs ($composeArgs + @("up", "-d", "mysql"))
if ($LASTEXITCODE -ne 0) {
  throw "Failed to start MySQL container with Docker Compose."
}

Write-Host "Waiting for MySQL health..."
$maxTries = 60
$isHealthy = $false
for ($i = 1; $i -le $maxTries; $i++) {
  $status = (docker inspect --format="{{.State.Health.Status}}" erp-akkj-mysql-local 2>$null)
  if ($status -eq "healthy") {
    $isHealthy = $true
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $isHealthy) {
  throw "MySQL container did not become healthy in time."
}

Write-Host "Creating table-only schema file..."
Convert-DumpToTablesOnly -InputPath $SchemaPath -OutputPath $SchemaOnlyPath

Write-Host "Initializing database schema (tables only)..."
docker exec erp-akkj-mysql-local mysql -uroot "-p$DbRootPassword" -e "CREATE DATABASE IF NOT EXISTS $DbName;"
Get-Content -Raw $SchemaOnlyPath | docker exec -i erp-akkj-mysql-local mysql -uroot "-p$DbRootPassword" $DbName

Write-Host "Installing backend dependencies..."
npm install

Write-Host "Installing frontend dependencies..."
npm --prefix client install

Write-Host "Local setup complete."
Write-Host "Start both services with: npm run dev:both"
Write-Host "Frontend URL: http://localhost:5173"
Write-Host "Backend URL: http://localhost:4000"

if ($RunApp) {
  npm run dev:both
}
