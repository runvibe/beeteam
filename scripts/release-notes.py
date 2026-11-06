import re
import sys
from pathlib import Path


def release_notes(changelog, tag):
    version = tag.removeprefix("v")
    sections = re.split(r"^## (.+?)\s*$", changelog, flags=re.MULTILINE)
    matches = [body.strip() for heading, body in zip(sections[1::2], sections[2::2]) if heading == version]
    if len(matches) != 1 or not matches[0]:
        raise ValueError(f"Expected exactly one nonempty CHANGELOG.md section for {tag}")
    return matches[0]


if __name__ == "__main__":
    print(release_notes(Path("CHANGELOG.md").read_text(encoding="utf-8"), sys.argv[1]))
