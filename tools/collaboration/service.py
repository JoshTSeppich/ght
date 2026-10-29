#!/usr/bin/env python3
"""Start/status/stop the durable local service without changing other apps."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request


def main():
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=('start', 'status', 'stop'))
    p.add_argument('--data', default=str(Path(__file__).parents[2] / 'data' / 'collaboration'))
    p.add_argument('--port', type=int, default=4488)
    p.add_argument('--amp-home', default=str(Path.home() / '.amp-bridge'))
    args = p.parse_args()
    data = Path(args.data).resolve()
    data.mkdir(parents=True, exist_ok=True, mode=0o700)
    url = 'http://127.0.0.1:' + str(args.port)
    def request(path, body=None):
        key = (data / 'service.key').read_text().strip()
        req = urllib.request.Request(url + path, data=json.dumps(body).encode() if body is not None else None, headers={'X-Collab-Key': key})
        with urllib.request.urlopen(req, timeout=2) as r:
            return json.load(r)
    try:
        state = request('/api/state')
        running = True
    except (OSError, ValueError):
        running = False
    if args.action == 'status':
        print(json.dumps({'running': running, 'url': url, 'run_id': state['run_id'] if running else None}))
        return
    if args.action == 'stop':
        print(json.dumps(request('/api/shutdown', {}) if running else {'stopped': True, 'already_stopped': True}))
        return
    if running:
        print(json.dumps({'running': True, 'already_running': True, 'url': url}))
        return
    command = [sys.executable, str(Path(__file__).with_name('server.py')), '--data', str(data), '--port', str(args.port), '--amp-home', args.amp_home, '--workers']
    with (data / 'service.log').open('ab') as log:
        child = subprocess.Popen(command, cwd=str(Path(__file__).parents[2]), stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    (data / 'service.pid').write_text(str(child.pid))
    for _ in range(30):
        try:
            state = request('/api/state')
            print(json.dumps({'running': True, 'pid': child.pid, 'url': url, 'run_id': state['run_id']}))
            return
        except (OSError, ValueError):
            if child.poll() is not None:
                raise SystemExit('Service failed; inspect the local service.log')
            time.sleep(.1)
    raise SystemExit('Service did not become ready; inspect local service.log')


if __name__ == '__main__':
    main()
