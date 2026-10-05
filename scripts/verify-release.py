"""Verify the current release archives without extracting user profiles."""
from pathlib import Path
import hashlib
import json
import struct
import zipfile
root = Path(__file__).resolve().parent.parent
workspace = root.parent.parent
version = json.loads((root / 'package.json').read_text())['version']
for line in (workspace / f'Guitar-io-{version}-SHA256SUMS.txt').read_text().splitlines():
    expected, name = line.split(maxsplit=1)
    file = workspace / name.strip()
    assert file.parent == workspace and file.is_file()
    with file.open('rb') as stream:
        assert hashlib.file_digest(stream, 'sha256').hexdigest() == expected
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None, file
        assert not any('/test-results/' in n or '/node_modules/' in n or '/release/' in n or '/xcuserdata/' in n for n in archive.namelist())
    print('SHA256 and CRC verified:', file.name)
with zipfile.ZipFile(workspace / f'Guitar-io-{version}-macOS-arm64.zip') as mac, zipfile.ZipFile(workspace / f'Guitar-io-{version}-Windows-x64.zip') as win:
    asar = win.read(f'Guitar-io-{version}-Windows-x64/resources/app.asar')
    assert asar == mac.read(f'Guitar-io-{version}-macOS-arm64/Guitar.io.app/Contents/Resources/app.asar')
    header_size, header_length = struct.unpack_from('<I', asar, 4)[0], struct.unpack_from('<I', asar, 12)[0]
    header = json.loads(asar[16:16+header_length])
    item = header['files']['package.json']; start = 8+header_size+int(item['offset'])
    assert json.loads(asar[start:start+item['size']])['version'] == version
with zipfile.ZipFile(workspace / f'Guitar-io-{version}-Source.zip') as source:
    for name in ['package.json','src/sync-model.ts','src/sync-storage.ts','src/lan-sync.ts','IOS_HANDOFF.md','ios/App/App/GuitarLocalPlugin.swift','ios/App/App.xcodeproj/project.pbxproj']:
        assert source.read('guitar-io/'+name) == (root / name).read_bytes(), name
baseline = workspace / 'Guitar-io-1.2.4-Windows-x64/resources/app.asar'
assert hashlib.sha256(baseline.read_bytes()).hexdigest().upper() == 'EBD29705964041FFB34C9C7534F2438A404AC324088F29ED35BC08553E69F874'
print('Desktop ASAR match, current source, and unchanged V1.2.4 baseline verified.')
