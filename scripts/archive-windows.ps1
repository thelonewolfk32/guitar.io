$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$outputRoot=if($env:GUITARIO_OUTPUT_DIR){[System.IO.Path]::GetFullPath($env:GUITARIO_OUTPUT_DIR)}else{[System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release/artifacts'))}
$folder=Join-Path $outputRoot "Guitar-io-$version-Windows-x64"
$zip=Join-Path $outputRoot "Guitar-io-$version-Windows-x64.zip"
if(Test-Path -LiteralPath $zip){throw 'Release archive already exists. Increase the version instead of overwriting it.'}
$archive=[System.IO.Compression.ZipFile]::Open($zip,[System.IO.Compression.ZipArchiveMode]::Create)
try{foreach($file in Get-ChildItem -LiteralPath $folder -Recurse -File){$entry=$file.FullName.Substring($outputRoot.Length+1).Replace('\','/');[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$entry,[System.IO.Compression.CompressionLevel]::Optimal)|Out-Null}}finally{$archive.Dispose()}
Write-Output $zip
