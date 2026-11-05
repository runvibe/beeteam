"""Compose release metadata only from verified, already-built native candidates."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile

SKILLS = ('setup-bee-team', 'get-a-team-lead', 'get-a-worker')
REPOSITORY = 'runvibe/beeteam'
STABLE = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', re.ASCII)
ROOT = Path(__file__).resolve().parent.parent


def require(condition, message):
    if not condition:
        raise ValueError(message)


def version_for_tag(tag, root=ROOT):
    version = tomllib.loads((Path(root) / 'Cargo.toml').read_text(encoding='utf-8'))['package']['version']
    require(STABLE.fullmatch(version) and tag == 'v' + version, 'Tag must match the stable Cargo version')
    return version


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_skill_tree(root):
    root = Path(root).resolve()
    require((root / 'SKILL.md').is_file(), f'Missing SKILL.md: {root.name}')
    for path in root.rglob('*'):
        require(not path.is_symlink(), f'Symlink in skill: {path}')
        if path.is_file() and path.suffix == '.md':
            for href in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
                href = href.split('#')[0]
                if not href or re.match(r'[a-zA-Z][\w+.-]*:', href):
                    continue
                target = (path.parent / href).resolve()
                require(target.is_relative_to(root) and target.is_file(), f'Unbundled skill reference: {path}: {href}')


def package_skills(output, version, root=ROOT):
    require(STABLE.fullmatch(version), 'Invalid stable version')
    root, output = Path(root), Path(output)
    output.mkdir(parents=True, exist_ok=True)
    result = []
    for name in SKILLS:
        source = root / 'skills' / name
        validate_skill_tree(source)
        filename = f'beeteam-{version}-skill-{name}.zip'
        target = output / filename
        require(not target.exists(), f'Refusing to overwrite {filename}')
        entries = {f'{name}/{path.relative_to(source).as_posix()}': path
                   for path in source.rglob('*') if path.is_file() and '__pycache__' not in path.parts}
        for legal in ('LICENSE', 'NOTICE', 'TRADEMARKS.md', 'BRAND-ASSETS.md'):
            entries[f'{name}/{legal}'] = root / legal
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            for archive_name, path in sorted(entries.items()):
                entry = zipfile.ZipInfo(archive_name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, path.read_bytes())
        metadata = {'kind': 'skill', 'name': name, 'fileName': filename,
                    'url': f'https://github.com/{REPOSITORY}/releases/download/v{version}/{filename}',
                    'sha256': digest(target), 'size': target.stat().st_size}
        (output / (filename + '.json')).write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
        (output / (filename + '.sha256')).write_text(f"{metadata['sha256']}  {filename}\n", encoding='ascii')
        result.append(metadata)
    return result


def verify_file(directory, item):
    name = item.get('fileName', '')
    require(isinstance(name, str) and name and '/' not in name and '\\' not in name and name not in ('.', '..'), 'Unsafe candidate filename')
    path = Path(directory) / name
    require(path.is_file() and not path.is_symlink(), f'Missing candidate {name}')
    require(type(item.get('size')) is int and item['size'] > 0 and path.stat().st_size == item['size'], f'Size mismatch: {name}')
    require(re.fullmatch(r'[0-9a-f]{64}', item.get('sha256', '')) and digest(path) == item['sha256'], f'Checksum mismatch: {name}')


def compose(directory, tag, root=ROOT):
    directory = Path(directory)
    version = version_for_tag(tag, root)
    native, skills, filenames, pairs = [], [], set(), set()
    for metadata_path in sorted(directory.glob('*.json')):
        if metadata_path.name in ('install.json', 'skills-packages.json'):
            continue
        item = json.loads(metadata_path.read_text(encoding='utf-8'))
        verify_file(directory, item)
        name = item['fileName']
        require(name not in filenames, f'Duplicate file metadata: {name}')
        filenames.add(name)
        if item.get('kind') == 'skill':
            require(item.get('name') in SKILLS, 'Unknown skill package')
            expected = f"beeteam-{version}-skill-{item['name']}.zip"
            skills.append(item)
        else:
            require(item.get('os') in ('windows', 'linux', 'macos') and item.get('arch') in ('x64', 'arm64'), 'Unsupported native platform')
            fmt = 'zip' if item['os'] == 'windows' else 'tar.gz'
            require(item.get('format') == fmt, 'Wrong archive format')
            expected = f"beeteam-{version}-{item['os']}-{item['arch']}.{fmt}"
            pair = (item['os'], item['arch'])
            require(pair not in pairs, 'Duplicate native platform')
            pairs.add(pair)
            native.append(item)
        require(name == expected and item.get('url') == f'https://github.com/{REPOSITORY}/releases/download/{tag}/{name}', 'Version or artifact origin mismatch')
    require({item['os'] for item in native} == {'windows', 'linux', 'macos'}, 'All three native operating systems must pass')
    require(len(skills) == 3 and {item['name'] for item in skills} == set(SKILLS), 'All three skill packages must pass')
    manifest = {'schemaVersion': 1, 'appVersion': version, 'channel': 'stable', 'artifacts': native,
                'skills': {'repository': f'https://github.com/{REPOSITORY}', 'ref': tag, 'path': 'skills', 'names': list(SKILLS)}}
    (directory / 'install.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (directory / 'skills-packages.json').write_text(json.dumps({'appVersion': version, 'packages': skills}, indent=2) + '\n', encoding='utf-8')
    return manifest


def compare_candidates(expected, downloaded):
    expected, downloaded = Path(expected), Path(downloaded)
    files = {path.name: path for path in expected.iterdir() if path.is_file()}
    require(files and set(files) == {path.name for path in downloaded.iterdir() if path.is_file()}, 'Draft release assets differ from validated candidates')
    for name, path in files.items():
        require(digest(path) == digest(downloaded / name), f'Draft release asset differs: {name}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['source', 'skills', 'compose', 'compare'])
    parser.add_argument('--tag')
    parser.add_argument('--directory')
    parser.add_argument('--downloaded')
    args = parser.parse_args()
    if args.command == 'compare':
        compare_candidates(args.directory, args.downloaded)
    elif args.command == 'source':
        print(version_for_tag(args.tag))
    elif args.command == 'skills':
        print(json.dumps(package_skills(args.directory, version_for_tag(args.tag))))
    else:
        print(json.dumps(compose(args.directory, args.tag)))
