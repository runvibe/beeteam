"""Install/copy and discover release Skills exclusively in temporary harness projects."""
import argparse
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

spec = importlib.util.spec_from_file_location('candidate', Path(__file__).with_name('release-candidate.py'))
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


def validate(directory, tag):
    directory = Path(directory).resolve()
    version = candidate.version_for_tag(tag)
    npx = shutil.which('npx.cmd' if os.name == 'nt' else 'npx')
    if not npx:
        raise RuntimeError('Node.js/npm is required for Skills discovery validation')
    with tempfile.TemporaryDirectory(prefix='beeteam-release-skills-') as temp:
        root = Path(temp)
        for name in candidate.SKILLS:
            archive = directory / f'beeteam-{version}-skill-{name}.zip'
            unpacked = root / name / 'packages'
            with zipfile.ZipFile(archive) as packed:
                expected_prefix = name + '/'
                for entry in packed.infolist():
                    if not entry.filename.startswith(expected_prefix) or not (unpacked / entry.filename).resolve().is_relative_to(unpacked.resolve()):
                        raise ValueError('Unsafe Skills archive layout')
                packed.extractall(unpacked)
            source = unpacked / name
            candidate.validate_skill_tree(source)
            for harness in ('codex', 'claude-code', 'github-copilot'):
                project = root / name / harness
                home = project / 'home'
                home.mkdir(parents=True)
                env = os.environ.copy()
                env.update(HOME=str(home), USERPROFILE=str(home), CODEX_HOME=str(home / '.codex'),
                           XDG_CONFIG_HOME=str(home / '.config'), npm_config_cache=str(root / '.npm-cache'),
                           DISABLE_TELEMETRY='1', CI='1')
                for arguments in (
                    ['add', str(source), '--list', '--agent', harness],
                    ['add', str(source), '--yes', '--copy', '--agent', harness, '--skill', name],
                    ['list', '--agent', harness],
                ):
                    result = subprocess.run([npx, '--yes', 'skills@1.7.6', *arguments],
                                            cwd=project, env=env, text=True, encoding='utf-8', errors='replace',
                                            capture_output=True, timeout=180)
                    if result.returncode or name not in result.stdout:
                        raise RuntimeError(f'Skills validation failed for {name}/{harness}:\n{result.stdout}\n{result.stderr}')
                installed = [path.parent for path in project.rglob('SKILL.md') if path.parent.name == name]
                if not installed:
                    raise RuntimeError(f'Skills CLI did not install {name} in the isolated project')
                for package in installed:
                    for original in source.rglob('*'):
                        if original.is_file():
                            actual = package / original.relative_to(source)
                            if actual.is_symlink() or not actual.is_file() or actual.read_bytes() != original.read_bytes():
                                raise RuntimeError(f'Incomplete copied skill package: {name}/{harness}/{actual}')
                print(f'Skills CLI 1.7.6 install, byte parity and discovery passed: {name} / {harness}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    validate(args.directory, args.tag)
