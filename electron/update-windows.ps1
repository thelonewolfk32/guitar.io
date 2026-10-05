param([Parameter(Mandatory=$true)][string]$Plan)
$ErrorActionPreference='Stop'
$config=Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$stage=[IO.Path]::GetFullPath($config.stage)
$target=[IO.Path]::GetFullPath($config.target)
$source=[IO.Path]::GetFullPath($config.source)
$backup=Join-Path $stage 'rollback'
$touched=[Collections.Generic.List[object]]::new()
$started=$null
function Log([string]$message) { Add-Content -LiteralPath (Join-Path $config.profile 'update-install.log') -Value "$(Get-Date -Format o) Windows installer: $message" -Encoding UTF8 }
function Result($value) {
  $file=Join-Path $config.profile 'update-result.json'
  $temp=$file+'.installer.tmp'
  $value | ConvertTo-Json -Compress | Set-Content -LiteralPath $temp -Encoding UTF8
  Move-Item -LiteralPath $temp -Destination $file -Force
}
function ChildPath([string]$root,[string]$relative) {
  $resolved=[IO.Path]::GetFullPath((Join-Path $root $relative))
  if (-not $resolved.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid update file path.' }
  return $resolved
}
function CheckParents([string]$root,[string]$file) {
  $parent=[IO.Path]::GetDirectoryName($file)
  while ($parent.Length -ge $root.Length) {
    if ((Test-Path -LiteralPath $parent) -and ((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'An update folder is a linked directory.' }
    if ($parent -eq $root) { break }; $parent=[IO.Path]::GetDirectoryName($parent)
  }
}
function Report([string]$status,[string]$message='') {
  @{status=$status;message=$message;version=$config.version;token=$config.token} | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $stage 'handshake.json') -Encoding UTF8
}
try {
  if ($stage -ne [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($Plan)) -or -not $source.StartsWith($stage+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid update staging directory.' }
  $cache=[IO.Path]::GetFullPath((Join-Path $config.profile 'app-updates'))
  if (-not $stage.StartsWith($cache+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid cleanup directory.' }
  if (-not (Test-Path -LiteralPath (Join-Path $target 'Guitar.io.exe')) -or -not (Test-Path -LiteralPath (Join-Path $source 'resources/app.asar'))) { throw 'The app or update is missing.' }
  foreach ($relative in $config.files) { $file=ChildPath $target $relative; CheckParents $target $file; $incoming=ChildPath $source $relative; if (-not (Test-Path -LiteralPath $incoming -PathType Leaf)) { throw 'Incomplete extracted update.' } }
  [IO.Directory]::CreateDirectory($backup) | Out-Null
  Log "Preparing $($config.version)."
  Report 'ready'
  $parentProcess=Get-Process -Id $config.parentPid -ErrorAction SilentlyContinue
  if ($parentProcess -and -not $parentProcess.WaitForExit(120000)) { throw 'Guitar.io did not close. Update cancelled.' }
  foreach ($relative in $config.files) {
    $destination=ChildPath $target $relative; $old=ChildPath $backup $relative; $incoming=ChildPath $source $relative
    CheckParents $target $destination
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    $existed=Test-Path -LiteralPath $destination
    $entry=@{destination=$destination;old=$old;existed=$existed;written=$false}; $touched.Add($entry)
    if ($existed) { [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($old)) | Out-Null; Move-Item -LiteralPath $destination -Destination $old }
    Move-Item -LiteralPath $incoming -Destination $destination; $entry.written=$true
  }
  # Write before launch: the renderer acknowledges a loaded library atomically.
  # Keep rollback until both that acknowledgement and a visible native window.
  Result @{status='installed';version=$config.version;token=$config.token;activated=$false}
  if ($config.restart) {
    Log 'Starting the updated app with a visible window.'
    $started=Start-Process -FilePath $config.executable -WorkingDirectory $target -WindowStyle Normal -PassThru
    $healthy=$false
    $deadline=[DateTime]::UtcNow.AddSeconds(90)
    while ([DateTime]::UtcNow -lt $deadline) {
      Start-Sleep -Milliseconds 250
      $started.Refresh()
      if ($started.HasExited) { throw 'The updated app exited before its library opened. The previous version has been restored.' }
      $ack=$null
      try { $ack=Get-Content -LiteralPath (Join-Path $config.profile 'update-result.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
      if ($ack.status -eq 'installed' -and $ack.version -eq $config.version -and $ack.token -eq $config.token -and $ack.activated -and $ack.pid -eq $started.Id -and $started.MainWindowHandle -ne 0) { $healthy=$true; break }
    }
    if (-not $healthy) { throw 'The updated app did not open its library window. The previous version has been restored.' }
    Log 'Library loaded and window visible. Removing this update rollback.'
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
} catch {
  $failure=$_.Exception.Message
  if ($started -and -not $started.HasExited) { Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue; $started.WaitForExit(10000) | Out-Null; Start-Sleep -Milliseconds 1000 }
  for ($i=$touched.Count-1;$i -ge 0;$i--) { $entry=$touched[$i]; if ($entry.written -and (Test-Path -LiteralPath $entry.destination)) { Remove-Item -LiteralPath $entry.destination -Force }; if ($entry.existed -and (Test-Path -LiteralPath $entry.old)) { Move-Item -LiteralPath $entry.old -Destination $entry.destination -Force } }
  Result @{status='failed';version=$config.version;token=$config.token;message=$failure}
  Log "Rolled back: $failure"
  Report 'failed' $failure
  if ($touched.Count -gt 0 -and $config.restart) { Start-Process -FilePath $config.executable -WorkingDirectory $target -WindowStyle Normal }
  exit 1
}
