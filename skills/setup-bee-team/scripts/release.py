"""Get Bee Team release contract and verified package staging (Python 3.12+)."""
import hashlib
import json
import platform
import re
import shutil
import stat
import tarfile
import tempfile
import zipfile
from pathlib import Path
from urllib import request
from urllib.parse import urlsplit, unquote


MANIFEST = "https://getbee.team/install.json"
REPO = "https://github.com/runvibe/beeteam"
NAMES = {"setup-bee-team", "get-a-team-lead", "get-a-worker"}
MAX_FILE = 512 * 1024 * 1024
SEMVER = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?", re.ASCII)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def precedence(version):
    m = SEMVER.fullmatch(version) if isinstance(version, str) else None
    require(m, "Invalid SemVer")
    pre = m[4].split(".") if m[4] else []
    require(all(not (x.isdecimal() and len(x) > 1 and x[0] == "0") for x in pre), "Invalid prerelease")
    return tuple(map(int, m.groups()[:3])), not pre, tuple((0, int(x)) if x.isdecimal() else (1, x) for x in pre)


def machine():
    osname = {"Darwin": "macos", "Windows": "windows", "Linux": "linux"}.get(platform.system())
    arch = {"amd64": "x64", "x86_64": "x64", "arm64": "arm64", "aarch64": "arm64"}.get(platform.machine().lower())
    require(osname and arch, "Unsupported OS/architecture; do not substitute a different package")
    return osname, arch


def contract(data, target):
    require(isinstance(data, dict) and type(data.get("schemaVersion")) is int and data["schemaVersion"] == 1, "Unsupported manifest schema")
    version = data.get("appVersion")
    precedence(version)
    require(data.get("channel") == "stable" and "-" not in version.split("+")[0], "Only stable releases are supported")
    skills = data.get("skills")
    require(isinstance(skills, dict) and skills.get("repository") == REPO and skills.get("ref") == "v" + version and skills.get("path") == "skills", "Unexpected skill origin, path or tag")
    names = skills.get("names")
    require(isinstance(names, list) and len(names) == len(NAMES) and set(names) == NAMES, "Unexpected skill names")
    items = data.get("artifacts")
    require(isinstance(items, list), "artifacts must be an array")
    seen = {}
    for item in items:
        require(isinstance(item, dict), "Invalid artifact")
        osname, arch = item.get("os"), item.get("arch")
        require(osname in ("windows", "macos", "linux") and arch in ("x64", "arm64") and (osname, arch) not in seen, "Invalid or duplicate target")
        fmt, name = item.get("format"), item.get("fileName")
        require(fmt in ("zip", "tar.gz") and isinstance(name, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.+_-]*", name) and name.endswith("." + fmt), "Invalid artifact name/format")
        url = urlsplit(item.get("url", ""))
        require(url.scheme == "https" and url.netloc == "github.com" and not url.query and not url.fragment and
                unquote(url.path) == "/runvibe/beeteam/releases/download/v" + version + "/" + name, "Expected a matching versioned GitHub Release asset")
        require(type(item.get("size")) is int and 0 < item["size"] <= MAX_FILE and isinstance(item.get("sha256"), str) and
                re.fullmatch("[A-Fa-f0-9]{64}", item["sha256"]), "Missing or invalid size/SHA-256")
        seen[(osname, arch)] = item
    require(target in seen, "No verified release package for this OS/architecture")
    return seen[target]


class Redirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urlsplit(newurl)
        require(u.scheme == "https" and u.netloc in ("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"), "Unexpected download redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def remote(url):
    return request.build_opener(Redirect).open(request.Request(url, headers={"User-Agent": "GetBeeTeam-Setup/1"}), timeout=20)


def manifest(url):
    # A local preview is explicit, never inferred from an unreachable production site.
    u = urlsplit(url)
    require(url == MANIFEST or (u.scheme == "http" and u.hostname in ("127.0.0.1", "::1") and u.path == "/install.json" and
            u.username is None and not u.query and not u.fragment), "Expected the official manifest or an explicit loopback preview")
    with remote(url) as response:
        raw = response.read(1024 * 1024 + 1)
    require(len(raw) <= 1024 * 1024, "Manifest too large")
    return json.loads(raw)


def copy_verified(source, dest, item):
    h, size = hashlib.sha256(), 0
    with dest.open("xb") as f:
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            require(size <= item["size"], "Package exceeds advertised size")
            f.write(chunk)
            h.update(chunk)
    require(size == item["size"] and h.hexdigest() == item["sha256"].lower(), "Package size/SHA-256 mismatch")


def unpack(archive, dest, fmt, exe):
    # Never extract archives into a directory. Only stream the single approved
    # root executable; notes/licenses (and their paths) are never installed.
    if fmt == "zip":
        with zipfile.ZipFile(archive) as z:
            members = [i for i in z.infolist() if i.filename == exe]
            require(len(members) == 1, "Expected exactly one root executable")
            info = members[0]
            require(stat.S_IFMT(info.external_attr >> 16) in (0, stat.S_IFREG) and 0 < info.file_size <= MAX_FILE, "Invalid executable member")
            with z.open(info) as src, dest.open("xb") as out:
                shutil.copyfileobj(src, out)
    else:
        # Bound the decompressed stream, including ignored members and padding.
        import gzip
        with tempfile.TemporaryFile() as raw, gzip.open(archive, "rb") as gz:
            while chunk := gz.read(1024 * 1024):
                require(raw.tell() + len(chunk) <= MAX_FILE, "Expanded tar too large")
                raw.write(chunk)
            raw.seek(0)
            with tarfile.open(fileobj=raw, mode="r:") as t:
                members = [i for i in t if i.name in (exe, "./" + exe)]
                require(len(members) == 1 and members[0].isreg() and 0 < members[0].size <= MAX_FILE, "Invalid or missing root executable")
                with t.extractfile(members[0]) as src, dest.open("xb") as out:
                    shutil.copyfileobj(src, out)
    dest.chmod(0o755)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def stage(data, version, root, source, target):
    item = contract(data, target)
    require(version == data["appVersion"], "Manifest changed or requested version unavailable")
    root = Path(root).expanduser().absolute()
    require(not any(p.is_symlink() or p.is_junction() for p in (root, *root.parents)), "Install root must not traverse links")
    root.mkdir(parents=True, exist_ok=True)
    final = root / version
    exe = "beeteam.exe" if target[0] == "windows" else "beeteam"
    with tempfile.TemporaryDirectory(dir=root) as tmp:
        work = Path(tmp)
        archive = work / "download"
        copy_verified(source, archive, item)
        package = work / "package"
        package.mkdir()
        unpack(archive, package / exe, item["format"], exe)
        receipt = {"version": version, "artifactSha256": item["sha256"].lower(), "binarySha256": digest(package / exe)}
        (package / "receipt.json").write_text(json.dumps(receipt), encoding="utf-8")
        if final.exists() or final.is_symlink():
            require(not final.is_symlink() and not final.is_junction() and not (final / exe).is_symlink() and
                    json.loads((final / "receipt.json").read_bytes()) == receipt and digest(final / exe) == receipt["binarySha256"],
                    "Existing installation differs; preserve and reconcile it")
        else:
            package.rename(final)
    return final / exe
