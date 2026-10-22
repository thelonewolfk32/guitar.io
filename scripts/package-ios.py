"""Package the current React Native source and handoff. Never creates an IPA."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
root = Path(__file__).resolve().parent.parent
git = ['git', '-c', 'safe.directory=' + root.as_posix()]
commit = subprocess.check_output(git + ['rev-parse', 'HEAD'], cwd=root, text=True).strip()
tracked = subprocess.check_output(git + ['ls-files', '-z'], cwd=root).decode('utf-8').split('\0')
version = json.loads((root / 'package.json').read_text())['version']
folder = f'Guitar-io-{version}-iOS-Source-{commit[:7]}'
output_dir = root / 'release' / 'ios-first'
output_dir.mkdir(parents=True, exist_ok=True)
output = output_dir / f'{folder}.zip'
with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in tracked:
        if not name:
            continue
        file = root / name
        if not file.is_file():
            continue
        if any(part in {'node_modules', 'Pods', '.git', 'test-results', 'release', 'ScoreWeb', 'DerivedData', 'xcuserdata'} for part in Path(name).parts):
            raise RuntimeError('Generated/private path was tracked: ' + name)
        if file.suffix.lower() in {'.key', '.pem', '.p12', '.guitariobak', '.dump'} or file.name.startswith('.env') and not file.name.endswith('.example'):
            raise RuntimeError('Private settings must never be packaged: ' + name)
        archive.write(file, folder + '/' + name)
    archive.writestr(folder + '/READ_ME_FIRST.txt', f'Guitar.io {version} React Native iOS source. Commit {commit}. Start with IOS_REACT_NATIVE_HANDOFF.md and IOS_FIRST_RELEASE.md. Use mobile/ios/GuitarIO.xcworkspace after preparation, local Personal Team profile first. The retained ios/App tree is migration/reference only. This is source, not a signed IPA or a completed device test.\n')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for required in ['mobile/App.tsx', 'mobile/scripts/configure-ios.rb', 'IOS_REACT_NATIVE_HANDOFF.md', 'IOS_FIRST_RELEASE.md', 'CLOUD_OPERATIONS.md']:
        assert archive.read(folder + '/' + required) == (root / required).read_bytes()
print(json.dumps({'archive': str(output), 'commit': commit, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'kind': 'React Native source, not IPA'}))
