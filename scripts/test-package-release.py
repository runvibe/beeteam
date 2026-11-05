import hashlib
import importlib.util
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('packaging', Path(__file__).with_name('package-release.py'))
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class PackageTests(unittest.TestCase):
    def test_platforms_contain_only_executable_and_real_integrity_metadata(self):
        for os_name in ['windows', 'linux', 'macos']:
            with self.subTest(os=os_name), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                binary = root / 'source'
                binary.write_bytes(b'release candidate fixture')
                result = packaging.package(binary, root / 'out', os_name, 'x64', 'runvibe/beeteam', '0.1.0', 'v0.1.0')
                archive = root / 'out' / result['fileName']
                self.assertEqual(result['sha256'], hashlib.sha256(archive.read_bytes()).hexdigest())
                self.assertEqual(result['size'], archive.stat().st_size)
                if os_name == 'windows':
                    with zipfile.ZipFile(archive) as stream:
                        self.assertEqual(stream.namelist(), ['beeteam.exe'])
                        self.assertEqual(stream.read('beeteam.exe'), binary.read_bytes())
                else:
                    with tarfile.open(archive) as stream:
                        self.assertEqual(stream.getnames(), ['beeteam'])
                        self.assertEqual(stream.getmember('beeteam').mode, 0o755)
                        self.assertEqual(stream.extractfile('beeteam').read(), binary.read_bytes())
                with self.assertRaises(ValueError):
                    packaging.package(binary, root / 'out', os_name, 'x64', 'runvibe/beeteam', '0.1.0', 'v0.1.0')

    def test_rejects_version_mismatch_missing_binary_and_unknown_platform(self):
        for os_name, arch, tag in [('linux', 'mips', 'v0.1.0'), ('linux', 'x64', 'v2.0.0'), ('other', 'x64', 'v0.1.0')]:
            with self.assertRaises(ValueError):
                packaging.package('missing', 'unused', os_name, arch, 'runvibe/beeteam', '0.1.0', tag)


if __name__ == '__main__':
    unittest.main()
