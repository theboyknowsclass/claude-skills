# Installs or updates portable SolidCraft on Windows from the latest GitHub release.
# Verifies the zip against the release's SHA256SUMS.txt before touching the install.
# Safe to run while SolidCraft or its MCP server is running: exes in use are renamed
# to *.old (Windows allows renaming a running exe, not overwriting it).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File solidcraft-update.ps1 [-InstallDir DIR] [-CheckOnly] [-Shortcut]
#
# Exit codes: 0 = installed / updated / up to date, 1 = error. Log: solidcraft-update.log next to this script.
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\SolidCraft",
    [switch]$CheckOnly,
    [switch]$Shortcut
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is very slow with the progress bar
$log = Join-Path $PSScriptRoot 'solidcraft-update.log'
function Log($m) { $line = "$(Get-Date -Format s)  $m"; Write-Output $line; Add-Content $log $line }

try {
    $arch = switch ($env:PROCESSOR_ARCHITECTURE) { 'ARM64' { 'arm64' } 'x86' { 'x86' } default { 'x64' } }
    $cli = Join-Path $InstallDir 'solidcraft-cli.exe'
    $cur = if (Test-Path $cli) { ((& $cli --version) -split ' ')[-1].Trim() } else { '0.0.0' }

    $hdr = @{ 'User-Agent' = 'solidcraft-updater'; 'Accept' = 'application/vnd.github+json' }
    $rel = Invoke-RestMethod 'https://api.github.com/repos/tangency-labs/solidcraft/releases/latest' -Headers $hdr
    $new = $rel.tag_name.TrimStart('v')
    if ([version]$new -le [version]$cur) { Log "up to date ($cur)"; return }
    Log "update available: $cur -> $new"
    if ($CheckOnly) { return }

    $zipName = "solidcraft-$new-windows-$arch-portable.zip"
    $zipUrl = ($rel.assets | Where-Object name -eq $zipName).browser_download_url
    $sumUrl = ($rel.assets | Where-Object name -eq 'SHA256SUMS.txt').browser_download_url
    if (-not $zipUrl -or -not $sumUrl) { throw "release $new has no $zipName or SHA256SUMS.txt" }

    $tmp = Join-Path $env:TEMP "solidcraft-update-$new"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory $tmp | Out-Null
    Invoke-WebRequest $zipUrl -OutFile "$tmp\$zipName" -Headers $hdr -UseBasicParsing
    Invoke-WebRequest $sumUrl -OutFile "$tmp\SHA256SUMS.txt" -Headers $hdr -UseBasicParsing
    $line = Get-Content "$tmp\SHA256SUMS.txt" | Where-Object { $_ -match ([regex]::Escape($zipName) + '$') } | Select-Object -First 1
    if (-not $line) { throw "no checksum for $zipName" }
    $expected = ($line -split '\s+')[0].ToLower()
    $actual = (Get-FileHash "$tmp\$zipName" -Algorithm SHA256).Hash.ToLower()
    if ($expected -ne $actual) { throw "checksum mismatch for $zipName" }
    Log "checksum ok"

    Expand-Archive "$tmp\$zipName" "$tmp\x" -Force
    $srcDir = (Get-ChildItem "$tmp\x" -Recurse -Filter 'solidcraft-cli.exe' | Select-Object -First 1).DirectoryName
    if (-not $srcDir) { throw "solidcraft-cli.exe not found in $zipName" }

    New-Item -ItemType Directory $InstallDir -Force | Out-Null
    Get-ChildItem $InstallDir -Filter '*.old' -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
    Get-ChildItem $srcDir -File | ForEach-Object {
        $dst = Join-Path $InstallDir $_.Name
        if (Test-Path $dst) {
            try { Remove-Item $dst -Force } catch { Move-Item $dst "$dst.$cur.old" -Force }
        }
    }
    Copy-Item "$srcDir\*" $InstallDir -Recurse -Force
    Remove-Item $tmp -Recurse -Force

    if ($Shortcut) {
        $lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'SolidCraft.lnk'
        $ws = New-Object -ComObject WScript.Shell
        $s = $ws.CreateShortcut($lnk)
        $s.TargetPath = Join-Path $InstallDir 'solidcraft.exe'
        $s.WorkingDirectory = $InstallDir
        $s.Save()
        Log "start menu shortcut: $lnk"
    }
    Log "installed $new in $InstallDir (restart MCP clients to load the new server)"
} catch {
    Log "ERROR: $($_.Exception.Message)"
    exit 1
}
