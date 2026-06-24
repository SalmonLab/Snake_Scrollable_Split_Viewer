$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$chromeCandidates = @(
  Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe',
  Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe',
  Join-Path $env:LocalAppData 'Microsoft\Edge\Application\msedge.exe'
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $chromeCandidates) {
  throw 'Chrome/Edge not found.'
}
$chrome = $chromeCandidates[0]
$profile = Join-Path $env:LOCALAPPDATA 'SplitStream\TmpProfile'
if (-not (Test-Path $profile)) {
  New-Item -ItemType Directory -Path $profile | Out-Null
}

$arguments = @(
  '--user-data-dir=' + $profile,
  '--load-extension=' + $root,
  '--no-first-run',
  '--no-default-browser-check'
)

$target = if ($args.Count -gt 0) { $args[0] } else { 'https://example.com' }
$arguments += $target

Start-Process -FilePath $chrome -ArgumentList $arguments
