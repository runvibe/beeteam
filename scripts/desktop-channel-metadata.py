"""Prepare (never publish) a cask or WinGet manifest from a final release asset."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import quote

def render(asset, version, arch):
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError("Expected a stable version")
    if not re.fullmatch(r"[ A-Za-z0-9._-]+", asset.name):
        raise ValueError("Unexpected release filename")
    url = f"https://github.com/runvibe/beeteam/releases/download/v{version}/{quote(asset.name)}"
    with asset.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if asset.suffix == ".dmg":
        cpu = "arm64" if arch == "arm64" else "x86_64"
        return "bee-team-desktop.rb", f'''cask "bee-team-desktop" do
  version "{version}"
  sha256 "{digest}"
  url "{url}"
  name "Bee Team Desktop"
  desc "Local Bee Team panel and server"
  homepage "https://getbee.team/"
  depends_on arch: :{cpu}
  app "Bee Team Desktop.app"
end
'''
    if asset.suffix.lower() != ".exe":
        raise ValueError("Expected a DMG or NSIS installer")
    # JSON is a subset of YAML. Emit quoted scalars for exact version and checksum.
    manifest = dict(PackageIdentifier="RunVibe.BeeTeamDesktop", PackageVersion=version,
                    PackageLocale="en-US", Publisher="RunVibe", PackageName="Bee Team Desktop",
                    License="Apache-2.0", ShortDescription="Local Bee Team panel and server",
                    Installers=[dict(Architecture=arch, InstallerType="nullsoft", InstallerUrl=url,
                                     InstallerSha256=digest.upper())],
                    ManifestType="singleton", ManifestVersion="1.6.0")
    return "RunVibe.BeeTeamDesktop.yaml", json.dumps(manifest, indent=2) + "\n"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("asset", type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--arch", choices=["arm64", "x64"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    name, body = render(args.asset, args.version, args.arch)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / name).write_text(body, encoding="utf-8")
