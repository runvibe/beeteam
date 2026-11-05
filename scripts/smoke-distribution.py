"""Verify and exercise a native archive only against a temporary database."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import zipfile


def smoke(archive, metadata):
    archive = Path(archive)
    with archive.open('rb') as stream:
        assert hashlib.file_digest(stream, 'sha256').hexdigest() == metadata['sha256'], 'Checksum mismatch'
    assert archive.stat().st_size == metadata['size'], 'Size mismatch'
    executable = 'beeteam.exe' if metadata['os'] == 'windows' else 'beeteam'
    legal_names = {'LICENSE', 'NOTICE', 'TRADEMARKS.md', 'BRAND-ASSETS.md', 'third-party/Lucide-LICENSE', 'third-party/harness-icons-LICENSE.txt'}
    expected_names = {executable, *legal_names}
    with tempfile.TemporaryDirectory(prefix='beeteam-distribution-smoke-') as tmp:
        root = Path(tmp)
        binary = root / executable
        if metadata['format'] == 'zip':
            with zipfile.ZipFile(archive) as packed:
                assert set(packed.namelist()) == expected_names and len(packed.namelist()) == len(expected_names), 'Unexpected archive layout'
                binary.write_bytes(packed.read(executable))
        else:
            with tarfile.open(archive) as packed:
                assert set(packed.getnames()) == expected_names and len(packed.getnames()) == len(expected_names), 'Unexpected archive layout'
                assert packed.getmember(executable).isfile(), 'Executable must be a regular file'
                binary.write_bytes(packed.extractfile(executable).read())
        binary.chmod(0o755)
        saved_agent = None
        for mode in [None, 'embedded', 'disabled', 'invalid']:
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                port = listener.getsockname()[1]
            env = os.environ.copy()
            env.pop('BEE_FRONTEND_MODE', None)
            env.update(DATABASE_DRIVER='sqlite', DATABASE_URL='sqlite://' + str(root / 'data.db').replace('\\', '/'),
                       APP_HOST='127.0.0.1', APP_PORT=str(port), OTEL_ENABLED='false', MCP_ENABLED='true', MCP_PATH='/mcp')
            if mode:
                env['BEE_FRONTEND_MODE'] = mode
            with (root / 'process.log').open('w') as log:
                process = subprocess.Popen([str(binary)], cwd=root, env=env, stdout=log, stderr=log,
                                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                try:
                    if mode == 'invalid':
                        assert process.wait(timeout=15) != 0
                        continue
                    base = f'http://127.0.0.1:{port}'
                    for _ in range(200):
                        try:
                            with urllib.request.urlopen(base + '/api/v1/info', timeout=1) as response:
                                info = json.load(response)
                            break
                        except Exception:
                            if process.poll() is not None:
                                raise RuntimeError((root / 'process.log').read_text())
                            time.sleep(.1)
                    else:
                        raise RuntimeError('Startup timeout')
                    assert info['apiVersion'] == metadata['fileName'].removeprefix('beeteam-').removesuffix(f"-{metadata['os']}-{metadata['arch']}.{metadata['format']}"), 'Archive/API version mismatch'
                    try:
                        with urllib.request.urlopen(base + '/', timeout=2) as response:
                            status = response.status
                    except urllib.error.HTTPError as error:
                        status = error.code
                    assert status == (200 if mode in (None, 'embedded') else 404)
                    rpc = json.dumps(dict(jsonrpc='2.0', id=1, method='initialize', params=dict(protocolVersion='2025-11-25', capabilities={}, clientInfo=dict(name='distribution-smoke', version='1')))).encode()
                    request = urllib.request.Request(base + '/mcp', data=rpc, headers={'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'})
                    with urllib.request.urlopen(request, timeout=5) as response:
                        assert 'beeteam-mcp' in response.read().decode()
                    if saved_agent:
                        with urllib.request.urlopen(base + '/api/v2/agents/' + saved_agent, timeout=5) as response:
                            assert json.load(response)['name'] == 'Distribution persistence probe'
                    else:
                        request = urllib.request.Request(base + '/api/v2/agents', data=json.dumps({'name': 'Distribution persistence probe'}).encode(), headers={'Content-Type': 'application/json', 'X-Actor-Kind': 'human', 'Idempotency-Key': __import__('uuid').uuid4().hex})
                        with urllib.request.urlopen(request, timeout=5) as response:
                            saved_agent = json.load(response)['id']
                finally:
                    if process.poll() is None:
                        process.terminate()
                        process.wait(timeout=15)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--metadata', required=True)
    args = parser.parse_args()
    metadata_path = Path(args.metadata)
    smoke(metadata_path.parent / metadata_path.name.removesuffix('.json'), json.loads(metadata_path.read_text(encoding='utf-8')))
    print('Archive integrity, API/MCP, panel modes and data persistence passed.')
