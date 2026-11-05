"""Exercise the real skills CLI in disposable projects against a local tagged Git fixture.

Usage: python tests/setup_skills_cli.py /path/to/node /path/to/skills/dist/cli.mjs
No live release, GitHub publication, user-scope install or catalog telemetry.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def run(node, cli):
    source = Path(__file__).resolve().parents[1] / "skills"
    names = ["setup-bee-team", "get-a-team-lead", "get-a-worker"]
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        repo = root / "fixture"
        for name in names:
            shutil.copytree(source / name, repo / "skills" / name, ignore=shutil.ignore_patterns("__pycache__"))
        def git(*args):
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "user.name=Fixture", "-c",
                            "user.email=fixture@example.invalid", *args], cwd=repo, check=True, capture_output=True)
        git("init", "-b", "main")
        git("add", "skills")
        git("commit", "-m", "Tagged fixture")
        git("tag", "v1.2.3")
        (repo / "skills/setup-bee-team/SKILL.md").write_text("unreleased main", encoding="utf-8")
        git("commit", "-am", "Do not install this content")
        for agent in ("codex", "claude-code", "github-copilot"):
            project = root / agent
            profile = root / ("profile-" + agent)
            project.mkdir()
            profile.mkdir()
            env = {**os.environ, "DISABLE_TELEMETRY": "1", "DO_NOT_TRACK": "1", "CI": "1",
                   "HOME": str(profile), "USERPROFILE": str(profile), "XDG_CONFIG_HOME": str(profile / "config"),
                   "CODEX_HOME": str(profile / "codex"), "CLAUDE_CONFIG_DIR": str(profile / "claude"),
                   "COPILOT_HOME": str(profile / "copilot"), "GIT_CONFIG_NOSYSTEM": "1",
                   "GIT_CONFIG_GLOBAL": os.devnull, "GIT_TERMINAL_PROMPT": "0", "GIT_CONFIG_COUNT": "1",
                   "GIT_CONFIG_KEY_0": "url." + repo.as_uri() + ".insteadOf",
                   "GIT_CONFIG_VALUE_0": "https://github.com/runvibe/beeteam.git"}
            result = subprocess.run([node, cli, "add", "https://github.com/runvibe/beeteam/tree/v1.2.3/skills",
                                     "--skill", *names, "-a", agent, "--copy", "-y"], cwd=project, env=env,
                                    capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
            assert result.returncode == 0, result.stdout[-1500:] + result.stderr[-1000:]
            for name in names:
                pkg = list(project.glob("*/skills/" + name + "/SKILL.md"))
                assert pkg, (agent, name, result.stdout[-1800:])
                for expected in (source / name).rglob("*"):
                    if expected.is_file() and "__pycache__" not in expected.parts:
                        target = pkg[0].parent / expected.relative_to(source / name)
                        assert target.read_bytes() == expected.read_bytes(), (agent, name, target)
            print(agent, "installed three exact packages from tag (not main)")


if __name__ == "__main__":
    run(*sys.argv[1:])
