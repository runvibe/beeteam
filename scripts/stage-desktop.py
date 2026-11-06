"""Stage the same native release executable for Tauri's externalBin bundler."""
import os
from pathlib import Path
import shutil
import subprocess
import tomllib

root = Path(__file__).resolve().parents[1]
desktop = root / "desktop"
def version(folder):
    with (folder / "Cargo.toml").open("rb") as manifest:
        return tomllib.load(manifest)["package"]["version"]

if version(root) != version(desktop):
    raise SystemExit("Standalone and Desktop versions must match")
host = next(line.split(": ", 1)[1] for line in subprocess.check_output(
    ["rustc", "-vV"], text=True).splitlines() if line.startswith("host: "))
suffix = ".exe" if os.name == "nt" else ""
target = Path(os.environ.get("CARGO_TARGET_DIR", root / "target"))
destination = desktop / "binaries" / f"beeteam-server-{host}{suffix}"
destination.parent.mkdir(exist_ok=True)
shutil.copy2(target / "release" / f"beeteam{suffix}", destination)
print(destination)
