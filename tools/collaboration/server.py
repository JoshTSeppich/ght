#!/usr/bin/env python3
"""Private loopback inbox/review server. Runtime data never belongs in Git."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import threading
import urllib.parse

from core import Hub, MAX_FILE
from worker import Workers

WEB = Path(__file__).parent / 'web'


def create_server(hub, port=4488, worker_cwd=None):
    keyfile = hub.data / 'service.key'
    if not keyfile.exists():
        keyfile.write_text(secrets.token_urlsafe(32))
        os.chmod(keyfile, 0o600)
    token = keyfile.read_text().strip()
    workers = Workers(hub, worker_cwd or Path.cwd())

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass  # no private URLs, task bodies or tokens in access logs

        def valid_host(self):
            return self.headers.get('Host') in ('127.0.0.1:' + str(self.server.server_port), 'localhost:' + str(self.server.server_port))

        def auth(self, mutate=False):
            if not self.valid_host():
                return False
            if secrets.compare_digest(self.headers.get('X-Collab-Key', ''), token):
                return True
            cookies = dict(x.strip().split('=', 1) for x in self.headers.get('Cookie', '').split(';') if '=' in x)
            if not secrets.compare_digest(cookies.get('collab', ''), token):
                return False
            if mutate:
                origin = self.headers.get('Origin', '')
                return origin in ('http://127.0.0.1:' + str(self.server.server_port), 'http://localhost:' + str(self.server.server_port)) and self.headers.get('X-Collab-Request') == '1'
            return True

        def respond(self, code, value, media='application/json', cookie=False, download=False):
            raw = json.dumps(value).encode() if media == 'application/json' else value
            self.send_response(code)
            self.send_header('Content-Type', media)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'")
            if download:
                self.send_header('Content-Disposition', 'attachment')
            if cookie:
                self.send_header('Set-Cookie', 'collab=' + token + '; HttpOnly; SameSite=Strict; Path=/')
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            try:
                path = urllib.parse.urlsplit(self.path).path
                if not self.valid_host():
                    return self.respond(403, {'error': 'Loopback Host required'})
                if path in ('/', '/index.html'):
                    return self.respond(200, (WEB / 'index.html').read_bytes(), 'text/html; charset=utf-8', cookie=True)
                if path in ('/app.mjs', '/styles.css', '/timeline.mjs'):
                    return self.respond(200, (WEB / path[1:]).read_bytes(), 'text/css' if path.endswith('.css') else 'text/javascript')
                if not self.auth():
                    return self.respond(403, {'error': 'Open the local page first or use the service key'})
                if path == '/api/state':
                    return self.respond(200, hub.snapshot())
                if path == '/api/inbox':
                    query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                    after = int(query.get('after', ['0'])[0])
                    messages = hub.messages(1000, after=after, inbox_session=query['session'][0])
                    return self.respond(200, {'messages': messages, 'next_cursor': messages[-1]['seq'] if messages else after})
                if path == '/api/export':
                    return self.respond(200, hub.snapshot(), download=True)
                if path.startswith('/artifacts/'):
                    meta, content = hub.artifact(path.split('/')[-1])
                    # SVG/HTML/code/ZIP stay downloads. No active attachment gets same-origin execution.
                    inline = meta['media_type'] in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/ogg', 'audio/wav')
                    return self.respond(200, content, meta['media_type'] if inline else 'application/octet-stream', download=not inline)
                return self.respond(404, {'error': 'Not found'})
            except (ValueError, KeyError, TypeError, FileNotFoundError) as e:
                return self.respond(400, {'error': str(e)})

        def do_POST(self):
            if not self.auth(mutate=True):
                return self.respond(403, {'error': 'Same-origin session or service key required'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                path = urllib.parse.urlsplit(self.path).path
                maximum = MAX_FILE if path == '/api/artifacts' else 256 * 1024
                if length <= 0 or length > maximum:
                    return self.respond(413, {'error': 'Request too large or empty'})
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError('Incomplete upload')
                if path == '/api/artifacts':
                    result = hub.put_artifact(urllib.parse.unquote(self.headers.get('X-Filename', 'attachment.bin')), raw, self.headers.get('X-SHA256'))
                    return self.respond(200, result)
                body = json.loads(raw)
                if path == '/api/shutdown':
                    if not secrets.compare_digest(self.headers.get('X-Collab-Key', ''), token):
                        return self.respond(403, {'error': 'Service key required'})
                    self.respond(200, {'stopping': True, 'note': 'Current worker dispatch finishes before process exit'})
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                    return
                if path == '/api/messages':
                    # Browser is a human steering the fixed local coordinator identity.
                    result = hub.send('codex-desktop', dict(body, actor='human'))
                elif path == '/api/send':
                    # Agent-only endpoint; source is bound to the MCP process, not a browser selector.
                    if not secrets.compare_digest(self.headers.get('X-Collab-Key', ''), token):
                        return self.respond(403, {'error': 'Agent service key required'})
                    result = hub.send(body.pop('session'), body)
                elif path == '/api/receipt':
                    if not secrets.compare_digest(self.headers.get('X-Collab-Key', ''), token):
                        return self.respond(403, {'error': 'Agent service key required'})
                    result = hub.receipt(**body)
                elif path == '/api/reviews':
                    result = hub.review(body)
                elif path == '/api/feedback':
                    result = hub.feedback(body)
                elif path == '/api/claim':
                    result = hub.claim(**body)
                elif path == '/api/tasks':
                    result = hub.task_event('codex-desktop', body)
                elif path == '/api/task-event':
                    if not secrets.compare_digest(self.headers.get('X-Collab-Key', ''), token):
                        return self.respond(403, {'error': 'Agent service key required'})
                    result = hub.task_event(body.pop('session'), body)
                elif path == '/api/capability':
                    if not secrets.compare_digest(self.headers.get('X-Collab-Key', ''), token):
                        return self.respond(403, {'error': 'Agent service key required'})
                    result = hub.capability(**body)
                else:
                    return self.respond(404, {'error': 'Unknown operation'})
                return self.respond(200, result)
            except (ValueError, KeyError, TypeError) as e:
                return self.respond(400, {'error': str(e)})

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    server.workers = workers
    return server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default=str(Path(__file__).parents[2] / 'data' / 'collaboration'))
    parser.add_argument('--amp-home', default=str(Path.home() / '.amp-bridge'))
    parser.add_argument('--port', type=int, default=4488)
    parser.add_argument('--worker-cwd', default=str(Path(__file__).parents[2]))
    parser.add_argument('--workers', action='store_true', help='Enable configured opt-in CLI participants')
    args = parser.parse_args()
    hub = Hub(args.data, args.amp_home)
    # Initialize through AMP before opening its read-only projection.
    db = hub.amp.connect(hub.amp_db)
    db.close()
    server = create_server(hub, args.port, args.worker_cwd)
    if args.workers:
        server.workers.start()
    print('Collaboration room: http://127.0.0.1:' + str(server.server_port), flush=True)
    print('Desktop wake: requires user/model turn. CLI workers: ' + ('enabled per participant' if args.workers else 'off'), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.workers.stop.set()
        if server.workers.thread:
            server.workers.thread.join(timeout=185)
        server.server_close()


if __name__ == '__main__':
    main()
