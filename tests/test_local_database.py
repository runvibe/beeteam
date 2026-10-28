import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class LocalDatabaseConfigurationTests(unittest.TestCase):
    def resolve(self, driver=None, url=None):
        env = os.environ.copy()
        for key, value in (("DATABASE_DRIVER", driver), ("DATABASE_URL", url)):
            env.pop(key, None)
            if value is not None:
                env[key] = value
        command = ". ./scripts/local-database.ps1; Get-LocalDatabaseConfiguration | ConvertTo-Json -Compress"
        return subprocess.run(["pwsh", "-NoProfile", "-Command", command], cwd=ROOT, env=env, capture_output=True, text=True)

    def test_sqlite_preserves_explicit_url_and_never_selects_docker(self):
        import json
        result = self.resolve("sqlite", "sqlite://.local/example.sqlite")
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value["Url"], "sqlite://.local/example.sqlite")
        self.assertFalse(value["ManagedPostgres"])

    def test_default_keeps_managed_postgres(self):
        import json
        result = self.resolve()
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value["Driver"], "postgres")
        self.assertTrue(value["ManagedPostgres"])

    def test_invalid_or_mismatched_settings_fail_before_startup(self):
        for driver, url in [("mysql", "mysql://localhost/test"), ("sqlite", "postgres://localhost/test"), ("postgres", "sqlite://example.sqlite"), ("sqlite", None)]:
            with self.subTest(driver=driver, url=url):
                self.assertNotEqual(self.resolve(driver, url).returncode, 0)

if __name__ == "__main__":
    unittest.main()
