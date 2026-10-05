$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$config = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$outputRoot = if ($env:GUITARIO_OUTPUT_DIR) { [System.IO.Path]::GetFullPath($env:GUITARIO_OUTPUT_DIR) } else { [System.IO.Path]::GetFullPath((Join-Path $projectRoot '../..')) }
$archivePath = Join-Path $outputRoot "Guitar-io-$($config.version)-Source.zip"
$directories = @('.github', 'dist', 'electron', 'public', 'scripts', 'src', 'tests', 'shared', 'ios')
$rootFiles = @('.gitignore', 'Build-Windows.cmd', 'CHANGELOG-v1.2.4.md', 'CHANGELOG-v1.3.md', 'CHANGELOG-v1.4.md','CHANGELOG-v1.4.1.md','VALIDATION-v1.4.1.md','CHANGELOG-v1.4.2.md','VALIDATION-v1.4.2.md', 'VALIDATION-v1.4.md', 'VALIDATION-v1.3.md', 'CLEANUP-v1.3.txt', 'PERFORMANCE.md', 'PERFORMANCE.json', 'SYNC.md', 'IOS_HANDOFF.md', 'MACOS_BUILD.md', 'CODEX_CURRENT_HANDOFF.md', 'capacitor.config.ts', 'index.html', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'README.md', 'START_HERE.txt', 'THIRD_PARTY_NOTICES.md', 'tsconfig.json', 'vite.config.ts')
$rootFiles += @('GITHUB_RELEASES.md','CHANGELOG-v1.4.3.md','VALIDATION-v1.4.3.md')
$rootFiles += @('.gitattributes','CHANGELOG-v1.4.4.md','VALIDATION-v1.4.4.md')
$files = @($rootFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) -Force })
foreach ($directory in $directories) { $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -Recurse -File -Force }
# Create mode intentionally refuses to replace an earlier source archive.
$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "guitar-io/$relative", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if (!$check.GetEntry('guitar-io/CODEX_CURRENT_HANDOFF.md') -or !$check.GetEntry('guitar-io/src/MediaPanel.tsx')) { throw 'Source archive is missing required files.' }
    if ($check.Entries.FullName -match '/(node_modules|test-results|release)/') { throw 'Source archive unexpectedly includes generated or private test data.' }
    Write-Output "$archivePath ($($check.Entries.Count) files)"
} finally { $check.Dispose() }
