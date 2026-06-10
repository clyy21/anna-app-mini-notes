param(
  [string]$Version = "1.0.0",
  [ValidateSet("auto", "darwin-arm64", "darwin-x86_64", "windows-x86_64")]
  [string]$PlatformKey = "auto"
)

$ErrorActionPreference = "Stop"

$ToolId = "notes-summary"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dist = Join-Path $Root "dist"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
  throw "Go is required to build the Executa binary. Install Go 1.22+ and rerun this script."
}

function Get-PlatformKey {
  if ($IsWindows -or $env:OS -eq "Windows_NT") {
    return "windows-x86_64"
  }

  $uname = (uname -s).ToLowerInvariant()
  $arch = (uname -m).ToLowerInvariant()

  if ($uname -eq "darwin" -and ($arch -eq "arm64" -or $arch -eq "aarch64")) {
    return "darwin-arm64"
  }

  if ($uname -eq "darwin" -and ($arch -eq "x86_64" -or $arch -eq "amd64")) {
    return "darwin-x86_64"
  }

  throw "Unsupported local platform: $uname $arch"
}

function Get-GoTarget {
  param([string]$PlatformKey)

  switch ($PlatformKey) {
    "windows-x86_64" { return @{ GOOS = "windows"; GOARCH = "amd64"; Ext = ".exe"; ArchiveExt = ".zip" } }
    "darwin-arm64" { return @{ GOOS = "darwin"; GOARCH = "arm64"; Ext = ""; ArchiveExt = ".tar.gz" } }
    "darwin-x86_64" { return @{ GOOS = "darwin"; GOARCH = "amd64"; Ext = ""; ArchiveExt = ".tar.gz" } }
    default { throw "Unsupported platform key: $PlatformKey" }
  }
}

$PlatformKey = if ($PlatformKey -eq "auto") { Get-PlatformKey } else { $PlatformKey }
$Target = Get-GoTarget -PlatformKey $PlatformKey
$BuildRoot = Join-Path $Dist "$ToolId-$PlatformKey"
$BinDir = Join-Path $BuildRoot "bin"
$BinaryName = "$ToolId$($Target.Ext)"
$BinaryPath = Join-Path $BinDir $BinaryName
$ArchiveBase = Join-Path $Dist "$ToolId-$Version-$PlatformKey"
$ArchivePath = "$ArchiveBase$($Target.ArchiveExt)"

Remove-Item -Recurse -Force $BuildRoot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $BinDir | Out-Null

Push-Location $Root
try {
  $env:GOOS = $Target.GOOS
  $env:GOARCH = $Target.GOARCH
  $env:CGO_ENABLED = "0"
  go build -buildvcs=false -trimpath -ldflags "-s -w" -o $BinaryPath ./cmd/notes-summary
}
finally {
  Pop-Location
}

$Manifest = [ordered]@{
  name = $ToolId
  display_name = "Mini Notes Summary"
  version = $Version
  description = "Summarize Mini Notes through Anna host sampling."
  type = "binary"
  entrypoint = "bin/$BinaryName"
  platforms = @($PlatformKey)
  host_capabilities = @("llm.sample")
  tools = @(
    [ordered]@{
      name = "summarize"
      description = "Summarize the current notes via host sampling."
      parameters = @(
        [ordered]@{
          name = "notes"
          type = "array"
          description = "Notes to summarize. Each note should include content and order."
          required = $true
        }
      )
    }
  )
}

$Manifest | ConvertTo-Json -Depth 12 | Set-Content -Path (Join-Path $BuildRoot "manifest.json") -Encoding UTF8

Remove-Item -Force $ArchivePath -ErrorAction SilentlyContinue
if ($Target.ArchiveExt -eq ".zip") {
  $ArchiveItems = Get-ChildItem -LiteralPath $BuildRoot
  Compress-Archive -Path $ArchiveItems.FullName -DestinationPath $ArchivePath -Force
} else {
  Push-Location $BuildRoot
  try {
    tar -czf $ArchivePath *
  }
  finally {
    Pop-Location
  }
}

Write-Host "Built $ArchivePath"
