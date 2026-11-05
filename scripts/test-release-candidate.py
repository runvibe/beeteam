import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('candidate', Path(__file__).with_name('release-candidate.py'))
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


class CandidateTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'Cargo.toml').write_text('[package]\nversion="0.1.0"\n', encoding='utf-8')
        for legal in ('LICENSE', 'NOTICE', 'TRADEMARKS.md', 'BRAND-ASSETS.md'):
            (root / legal).write_text(legal, encoding='utf-8')
        for name in candidate.SKILLS:
            skill = root / 'skills' / name
            (skill / 'references').mkdir(parents=True)
            (skill / 'references/example.md').write_text('Bundled reference.', encoding='utf-8')
            (skill / 'SKILL.md').write_text(f'---\nname: {name}\ndescription: Test fixture\n---\n[Read](references/example.md)', encoding='utf-8')

    def native(self, directory, os_name, arch='x64'):
        fmt = 'zip' if os_name == 'windows' else 'tar.gz'
        name = f'beeteam-0.1.0-{os_name}-{arch}.{fmt}'
        path = directory / name
        path.write_bytes(f'fixture {os_name} {arch}'.encode())
        value = dict(os=os_name, arch=arch, format=fmt, fileName=name,
                     url=f'https://github.com/runvibe/beeteam/releases/download/v0.1.0/{name}',
                     sha256=hashlib.sha256(path.read_bytes()).hexdigest(), size=path.stat().st_size)
        metadata = directory / (name + '.json')
        metadata.write_text(json.dumps(value), encoding='utf-8')
        return metadata

    def all_candidates(self, root):
        self.fixture(root)
        output = root / 'out'
        candidate.package_skills(output, '0.1.0', root)
        for os_name in ('windows', 'linux', 'macos'):
            self.native(output, os_name)
        return output

    def test_skill_packages_preserve_references_and_legal_notices(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            packages = candidate.package_skills(root / 'out', '0.1.0', root)
            self.assertEqual(len(packages), 3)
            for item in packages:
                archive = root / 'out' / item['fileName']
                candidate.verify_file(root / 'out', item)
                with zipfile.ZipFile(archive) as packed:
                    name = item['name']
                    self.assertEqual(packed.read(f'{name}/references/example.md'), b'Bundled reference.')
                    self.assertEqual(packed.read(f'{name}/LICENSE'), b'LICENSE')
            with self.assertRaisesRegex(ValueError, 'overwrite'):
                candidate.package_skills(root / 'out', '0.1.0', root)

    def test_missing_or_escaping_skill_references_fail(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            skill = root / 'skills' / candidate.SKILLS[0]
            for target in ('references/missing.md', '../../NOTICE'):
                (skill / 'SKILL.md').write_text(f'[Missing]({target})', encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'Unbundled'):
                    candidate.validate_skill_tree(skill)

    def test_manifest_has_only_actual_verified_platforms_and_matching_skills_tag(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output = self.all_candidates(root)
            manifest = candidate.compose(output, 'v0.1.0', root)
            self.assertEqual(manifest['appVersion'], '0.1.0')
            self.assertEqual(manifest['skills']['ref'], 'v0.1.0')
            self.assertEqual({item['os'] for item in manifest['artifacts']}, {'windows', 'linux', 'macos'})
            self.assertEqual(len(manifest['artifacts']), 3)
            self.assertEqual(len(json.loads((output / 'skills-packages.json').read_text())['packages']), 3)
            with self.assertRaisesRegex(ValueError, 'Cargo'):
                candidate.compose(output, 'v0.2.0', root)

    def test_missing_platform_corruption_and_foreign_urls_are_rejected(self):
        for mutation in ('missing', 'corrupt', 'foreign', 'skills'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                output = self.all_candidates(root)
                metadata = output / 'beeteam-0.1.0-linux-x64.tar.gz.json'
                if mutation == 'missing':
                    metadata.unlink()
                elif mutation == 'corrupt':
                    (output / 'beeteam-0.1.0-linux-x64.tar.gz').write_bytes(b'corrupt')
                elif mutation == 'skills':
                    next(output.glob('*skill-setup-bee-team.zip.json')).unlink()
                else:
                    item = json.loads(metadata.read_text())
                    item['url'] = item['url'].replace('runvibe/beeteam', 'other/repository')
                    metadata.write_text(json.dumps(item))
                with self.assertRaises(ValueError):
                    candidate.compose(output, 'v0.1.0', root)

    def test_draft_readback_must_match_every_candidate_byte(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output = self.all_candidates(root)
            candidate.compose(output, 'v0.1.0', root)
            downloaded = root / 'downloaded'
            shutil.copytree(output, downloaded)
            candidate.compare_candidates(output, downloaded)
            (downloaded / 'install.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'differs'):
                candidate.compare_candidates(output, downloaded)


if __name__ == '__main__':
    unittest.main()
