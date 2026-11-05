"""Produce native release candidates; publication is a separate operation."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import tarfile
import tomllib
import zipfile


LEGAL_FILES = {
    'LICENSE': 'LICENSE',
    'NOTICE': 'NOTICE',
    'TRADEMARKS.md': 'TRADEMARKS.md',
    'BRAND-ASSETS.md': 'BRAND-ASSETS.md',
    'third-party/Lucide-LICENSE': 'docs/team-role-icons-LICENSE',
    'third-party/harness-icons-LICENSE.txt': 'frontend/public/harness-icons/LICENSE.txt',
}
SOURCE_ROOT = Path(__file__).resolve().parent.parent


def package(binary, output, os_name, arch, repository, version, tag):
    binary, output = Path(binary), Path(output)
    if os_name not in ('windows', 'linux', 'macos') or arch not in ('x64', 'arm64'):
        raise ValueError('Unsupported platform')
    if tag != 'v' + version:
        raise ValueError('Release tag must match Cargo version')
    if not binary.is_file() or binary.stat().st_size == 0:
        raise ValueError('Missing executable')
    legal_files = [(name, SOURCE_ROOT / source) for name, source in LEGAL_FILES.items()]
    if any(not path.is_file() for _, path in legal_files):
        raise ValueError('Missing distribution legal notice')
    output.mkdir(parents=True, exist_ok=True)
    fmt = 'zip' if os_name == 'windows' else 'tar.gz'
    name = f'beeteam-{version}-{os_name}-{arch}.{fmt}'
    target = output / name
    executable = 'beeteam.exe' if os_name == 'windows' else 'beeteam'
    if target.exists():
        raise ValueError('Refusing to overwrite a release candidate')
    if fmt == 'zip':
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.write(binary, executable)
            for legal_name, path in legal_files:
                archive.write(path, legal_name)
    else:
        with tarfile.open(target, 'w:gz') as archive:
            info = archive.gettarinfo(str(binary), executable)
            info.mode, info.uid, info.gid = 0o755, 0, 0
            info.uname = info.gname = ''
            with binary.open('rb') as stream:
                archive.addfile(info, stream)
            for legal_name, path in legal_files:
                info = archive.gettarinfo(str(path), legal_name)
                info.mode, info.uid, info.gid = 0o644, 0, 0
                info.uname = info.gname = ''
                with path.open('rb') as stream:
                    archive.addfile(info, stream)
    with target.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    metadata = dict(os=os_name, arch=arch, format=fmt, fileName=name,
                    url=f'https://github.com/{repository}/releases/download/{tag}/{name}',
                    sha256=digest, size=target.stat().st_size)
    (output / (name + '.json')).write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    (output / (name + '.sha256')).write_text(f'{digest}  {name}\n', encoding='ascii')
    return metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--repository', default='runvibe/beeteam')
    args = parser.parse_args()
    version = tomllib.loads(Path('Cargo.toml').read_text(encoding='utf-8'))['package']['version']
    os_name = {'Windows': 'windows', 'Linux': 'linux', 'Darwin': 'macos'}[platform.system()]
    arch = {'AMD64': 'x64', 'x86_64': 'x64', 'aarch64': 'arm64', 'arm64': 'arm64'}[platform.machine()]
    print(json.dumps(package(args.binary, args.output, os_name, arch, args.repository, version, args.tag)))
