"""Export the native project with prebuilt web assets; this is NOT an IPA."""
from pathlib import Path
import zipfile
import json
import plistlib
import hashlib
import stat
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
folder = f'Guitar-io-{version}-iOS-Project'
output = root.parent.parent / f'{folder}.zip'
files = list((root / 'ios').rglob('*'))
with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        if not file.is_file() or any(name in file.parts for name in ['build','DerivedData','xcuserdata','.DS_Store']):
            continue
        archive.write(file, folder + '/' + file.relative_to(root).as_posix())
    for name in ['IOS_HANDOFF.md','SYNC.md','VALIDATION-v1.4.md','CHANGELOG-v1.4.md','CHANGELOG-v1.4.1.md','VALIDATION-v1.4.1.md','THIRD_PARTY_NOTICES.md']:
        archive.write(root / name, folder + '/' + name)
    readme = 'Guitar.io ' + version + ' iOS native project. Open ios/App/App.xcodeproj on your Mac. See IOS_HANDOFF.md. This is an Xcode project, not a signed/installable IPA.\n'
    archive.writestr(folder + '/READ_ME_FIRST.txt', readme)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert archive.read(folder + '/ios/App/App/public/index.html') == (root / 'dist/index.html').read_bytes()
    for item in (root / 'dist').rglob('*'):
        if item.is_file():
            assert archive.read(folder + '/ios/App/App/public/' + item.relative_to(root / 'dist').as_posix()) == item.read_bytes()
    info = plistlib.loads(archive.read(folder + '/ios/App/App/Info.plist'))
    assert '_guitario._tcp' in info['NSBonjourServices']
    assert info['NSAppTransportSecurity'].get('NSAllowsLocalNetworking') is True
    assert not info['NSAppTransportSecurity'].get('NSAllowsArbitraryLoads')
    pbx = archive.read(folder + '/ios/App/App.xcodeproj/project.pbxproj').decode('utf-8-sig')
    assert 'GuitarLocalPlugin.swift in Sources' in pbx and f'MARKETING_VERSION = {version};' in pbx
    assert 'GuitarViewController()' in archive.read(folder + '/ios/App/App/SceneDelegate.swift').decode()
    print(json.dumps({'archive':str(output),'files':len(archive.namelist()),'kind':'Xcode project with current web assets; NOT an IPA','nativeCompile':'pending on Mac'}))
