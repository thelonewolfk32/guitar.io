"""Package a verified Electron arm64 ZIP without losing Unix modes/symlinks on Windows.

The .app is a local development build: prepare/sign it on the destination Mac.
No source profile, dependencies or Windows executables enter the Mac archive.
"""
import argparse
import copy
import hashlib
import json
import os
import plistlib
import posixpath
import re
import stat
import struct
import zipfile
from pathlib import Path

project = Path(__file__).resolve().parent.parent
config = json.loads((project / "package.json").read_text(encoding="utf-8"))
version, electron = config["version"], config["devDependencies"]["electron"]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--runtime", type=Path, default=project / f"release/mac-runtime/electron-v{electron}-darwin-arm64.zip")
parser.add_argument("--checksums", type=Path, default=project / "release/mac-runtime/SHASUMS256.txt")
output_root = Path(os.environ.get('GUITARIO_OUTPUT_DIR', project / 'release/artifacts'))
parser.add_argument("--asar", type=Path, default=output_root / f"Guitar-io-{version}-Windows-x64/resources/app.asar")
args = parser.parse_args()
with args.runtime.open("rb") as runtime_file:
    runtime_hash = hashlib.file_digest(runtime_file, "sha256").hexdigest()
expected = [line.split()[0] for line in args.checksums.read_text().splitlines() if line.split()[-1].lstrip("*") == args.runtime.name]
if expected != [runtime_hash]:
    raise ValueError("Official runtime SHA256 did not match.")
asar = args.asar.read_bytes()
header_size = struct.unpack_from("<I", asar, 4)[0]
header_length = struct.unpack_from("<I", asar, 12)[0]
header = json.loads(asar[16:16 + header_length])
package = header["files"]["package.json"]
start = 8 + header_size + int(package["offset"])
if json.loads(asar[start:start + package["size"]])["version"] != version:
    raise ValueError("ASAR is not the current build.")
asar_hash = hashlib.sha256(asar).hexdigest()
folder = f"Guitar-io-{version}-macOS-arm64"
output = output_root / f"{folder}.zip"
app = f"{folder}/Guitar.io.app"

def renamed(name):
    name = name.replace("Electron.app/", "Guitar.io.app/", 1)
    name = re.sub(r"Electron Helper(?: \((?:Renderer|Plugin|GPU)\))?", lambda m: m[0].replace("Electron", "Guitar.io", 1), name)
    if name == "Guitar.io.app/Contents/MacOS/Electron":
        name = "Guitar.io.app/Contents/MacOS/Guitar.io"
    return name

def add(archive, name, data, mode=0o100644):
    info = zipfile.ZipInfo(f"{folder}/{name}")
    info.create_system = 3
    info.external_attr = mode << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, data)

with zipfile.ZipFile(args.runtime) as original, zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as out:
    for item in original.infolist():
        if not item.filename.startswith("Electron.app/"):
            continue
        if "/_CodeSignature/" in item.filename or item.filename.endswith("/default_app.asar"):
            continue
        data = original.read(item)
        if item.filename.endswith("/Info.plist") and ("Helper" in item.filename or item.filename == "Electron.app/Contents/Info.plist"):
            info = plistlib.loads(data)
            helper = "Helper" in item.filename
            suffix = re.search(r"Electron( Helper(?: \((?:Renderer|Plugin|GPU)\))?)\.app/", item.filename)
            name = "Guitar.io" + (suffix[1] if suffix else "")
            info.update(CFBundleName=name, CFBundleDisplayName=name, CFBundleExecutable=name, CFBundleVersion=version, CFBundleShortVersionString=version)
            info["CFBundleIdentifier"] = "io.guitario.desktop" + (".helper" + ("." + suffix[1].split("(")[1].rstrip(")").lower() if "(" in suffix[1] else "") if helper else "")
            info.pop("ElectronAsarIntegrity", None)
            if not helper:
                info["NSLocalNetworkUsageDescription"] = "Guitar.io syncs your library changes with your paired devices on the same Wi-Fi or Ethernet network."
                info["NSBonjourServices"] = ["_guitario._tcp"]
            data = plistlib.dumps(info)
        if stat.S_ISLNK(item.external_attr >> 16):
            # Relative framework links are preserved as links, never extracted on Windows.
            data = re.sub(r"Electron Helper", "Guitar.io Helper", data.decode()).encode()
        entry = copy.copy(item)
        entry.filename = f"{folder}/{renamed(item.filename)}"
        out.writestr(entry, data)
    add(out, "Guitar.io.app/Contents/Resources/app.asar", asar)
    add(out, "Prepare and open Guitar.io.command", (project / "scripts/prepare-mac.command").read_bytes().replace(b"__ASAR_SHA256__", asar_hash.encode()), 0o100755)
    add(out, "local-signing-entitlements.plist", (project / "scripts/mac-entitlements.plist").read_bytes())
    add(out, "READ_ME_FIRST.md", (project / "MACOS_BUILD.md").read_bytes())
    add(out, "LICENSE.electron.txt", original.read("LICENSE"))
    add(out, "LICENSES.chromium.html", original.read("LICENSES.chromium.html"))
    for name in ["THIRD_PARTY_NOTICES.md", f"CHANGELOG-v{version}.md", f"VALIDATION-v{version}.md", "GITHUB_RELEASES.md", "SYNC.md"]:
        add(out, name, (project / name).read_bytes())

with zipfile.ZipFile(output) as check:
    if check.testzip():
        raise ValueError("Mac ZIP CRC validation failed.")
    names = set(check.namelist())
    assert hashlib.sha256(check.read(f"{app}/Contents/Resources/app.asar")).hexdigest() == asar_hash
    main = plistlib.loads(check.read(f"{app}/Contents/Info.plist"))
    assert main["CFBundleName"] == "Guitar.io" and main["CFBundleVersion"] == version
    binaries = [f"{app}/Contents/MacOS/Guitar.io"]
    binaries += [name for name in names if ".app/Contents/MacOS/" in name and " Helper" in name and not name.endswith("/")]
    for binary in binaries:
        data = check.read(binary)
        assert struct.unpack_from("<II", data) == (0xFEEDFACF, 0x0100000C), binary  # Mach-O arm64
        assert stat.S_IMODE(check.getinfo(binary).external_attr >> 16) & 0o111, binary
    links = {item.filename: check.read(item).decode() for item in check.infolist() if stat.S_ISLNK(item.external_attr >> 16)}
    def resolve_links(name):
        for _ in range(32):
            parts = name.split("/")
            for n in range(1, len(parts) + 1):
                prefix = "/".join(parts[:n])
                if prefix in links:
                    name = posixpath.normpath(posixpath.join(posixpath.dirname(prefix), links[prefix], *parts[n:]))
                    assert name.startswith(app + "/"), name
                    break
            else:
                return name
        raise ValueError("Cyclic framework symbolic link.")
    for item in check.infolist():
        if stat.S_ISLNK(item.external_attr >> 16):
            target = check.read(item).decode()
            resolved = resolve_links(posixpath.normpath(posixpath.join(posixpath.dirname(item.filename), target)))
            assert resolved.startswith(app + "/")
            assert resolved in names or resolved + "/" in names, (item.filename, resolved)
    for name in names:
        if name.endswith("/Info.plist") and "Guitar.io Helper" in name:
            helper = plistlib.loads(check.read(name))
            assert name.replace("Info.plist", "MacOS/" + helper["CFBundleExecutable"]) in names
    assert not any("default_app.asar" in name or "_CodeSignature" in name or name.endswith(".exe") or "test-results" in name for name in names)
    assert check.getinfo(f"{folder}/Prepare and open Guitar.io.command").external_attr >> 16 == 0o100755
    print(json.dumps({"archive": str(output), "entries": len(names), "arm64Executables": len(binaries), "minimumMacOS": main["LSMinimumSystemVersion"], "asarSHA256": asar_hash, "runtimeSHA256": runtime_hash, "nativeMacTest": "pending on MacBook", "signing": "local prepare command required"}))
