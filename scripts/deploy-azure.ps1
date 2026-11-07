#Requires -Version 5.1
<#
.SYNOPSIS
  Despliega planned-surveys-api en Azure App Service (nube pública).

.PARAMETER AppName
  Nombre único global (ej. planned-surveys-pvargas6). Solo a-z y 0-9.

.PARAMETER Subscription
  ID o nombre de suscripción Azure. Si no se indica, usa la suscripción por defecto de `az account`.

.PARAMETER ResourceGroup
  Grupo de recursos Azure.

.PARAMETER Location
  Región (default eastus).

.PARAMETER Sku
  F1 (gratis) o B1.
#>
param(
    [Parameter(Mandatory = $true)]
    [string] $AppName,

    [string] $Subscription = "",

    [string] $ResourceGroup = "rg-planned-surveys-api",
    [string] $Location = "eastus",
    [ValidateSet("F1", "B1")]
    [string] $Sku = "F1"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Get-AzCli {
    $cmd = Get-Command az -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $fallback = "${env:ProgramFiles}\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    if (Test-Path $fallback) { return $fallback }
    Write-Host "Azure CLI no encontrado. Instala con: winget install -e --id Microsoft.AzureCLI"
    exit 1
}

function Invoke-Az {
    param([string[]] $Args)
    $Az = Get-AzCli
    & $Az @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Comando az falló (código $LASTEXITCODE): az $($Args -join ' ')"
    }
}

$Az = Get-AzCli

$accountJson = & $Az account show 2>$null
if (-not $accountJson) {
    Write-Host "Inicia sesión en Azure..."
    Invoke-Az @("login")
}

if ($Subscription) {
    Write-Host "Usando suscripción: $Subscription"
    Invoke-Az @("account", "set", "--subscription", $Subscription)
}

$subName = (& $Az account show --query name -o tsv).Trim()
Write-Host "Suscripción activa: $subName"

Write-Host "Creando grupo de recursos $ResourceGroup en $Location..."
Invoke-Az @("group", "create", "--name", $ResourceGroup, "--location", $Location, "--output", "none")

Write-Host "Desplegando infraestructura (Bicep)..."
$outputsJson = & $Az @(
    "deployment", "group", "create",
    "--resource-group", $ResourceGroup,
    "--template-file", "$Root\infra\main.bicep",
    "--parameters", "appName=$AppName", "skuName=$Sku",
    "--query", "properties.outputs",
    "-o", "json"
)
if ($LASTEXITCODE -ne 0) {
    throw "Falló el despliegue Bicep. Revisa permisos en la suscripción '$subName' o cambia de suscripción con -Subscription."
}

$deployment = $outputsJson | ConvertFrom-Json

function Get-OutputValue($name) {
    if ($null -eq $deployment) { return $null }
    $node = $deployment.$name
    if ($null -eq $node) { return $null }
    if ($node.PSObject.Properties.Name -contains "value") { return $node.value }
    return [string]$node
}

$baseUrl = "https://${AppName}.azurewebsites.net"
$healthUrl = Get-OutputValue "healthUrl"
$docsUrl = Get-OutputValue "docsUrl"
$apiUrl = Get-OutputValue "apiUrl"
if (-not $healthUrl) { $healthUrl = "$baseUrl/health" }
if (-not $docsUrl) { $docsUrl = "$baseUrl/docs" }
if (-not $apiUrl) { $apiUrl = "$baseUrl/api/planned-surveys/xml" }

Write-Host "Empaquetando código (sin .venv)..."
$zipPath = Join-Path $Root "deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$items = @("app", "infra", "requirements.txt", "startup.sh", "README.md")
Compress-Archive -Path ($items | ForEach-Object { Join-Path $Root $_ }) -DestinationPath $zipPath

Write-Host "Publicando en Web App $AppName..."
Invoke-Az @(
    "webapp", "deploy",
    "--resource-group", $ResourceGroup,
    "--name", $AppName,
    "--src-path", $zipPath,
    "--type", "zip",
    "--async", "false",
    "--output", "none"
)

Write-Host ""
Write-Host "Listo."
Write-Host "  Web App: $AppName"
Write-Host "  Health:  $healthUrl"
Write-Host "  Docs:    $docsUrl"
Write-Host "  API:     POST $apiUrl"
Write-Host ""
Write-Host "Prueba en el navegador: $healthUrl"
