param(
  [Parameter(Mandatory = $true)]
  [string]$Key,

  [Parameter(Mandatory = $true)]
  [string]$Value,

  [string]$Path = ".env.local"
)

$line = "$Key=$Value"

if (!(Test-Path $Path)) {
  Set-Content -Path $Path -Value $line
  exit 0
}

$lines = Get-Content $Path
$found = $false
$next = foreach ($existing in $lines) {
  if ($existing -match "^\s*$([regex]::Escape($Key))=") {
    $found = $true
    $line
  } else {
    $existing
  }
}

if (!$found) {
  $next += $line
}

Set-Content -Path $Path -Value $next
