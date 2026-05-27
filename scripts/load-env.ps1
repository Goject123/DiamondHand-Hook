param(
  [string]$Path = ".env.local"
)

if (-not (Test-Path -LiteralPath $Path)) {
  throw "Environment file not found: $Path"
}

Get-Content -LiteralPath $Path | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0 -or $line.StartsWith("#")) {
    return
  }

  $idx = $line.IndexOf("=")
  if ($idx -le 0) {
    return
  }

  $name = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()
  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}
