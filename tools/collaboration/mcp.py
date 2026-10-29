#!/usr/bin/env python3
"""Session-bound stdio MCP adapter for the same visible local collaboration service."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request


def schema(properties, required=()):
    return {'type': 'object', 'properties': properties, 'required': list(required), 'additionalProperties': False}


S = {'type': 'string'}
TOOLS = [
    {'name': 'collab_inbox', 'description': 'Read messages for this MCP process\'s bound session and mark exact-session delivery. Does not imply a human approved them.', 'inputSchema': schema({})},
    {'name': 'collab_send', 'description': 'Send a question, assignment, result or revision through the existing AMP mailbox. Use a stable idempotency key. Optional reviewer_session creates one bounded automatic review handoff.', 'inputSchema': schema({'recipient_session': S, 'reviewer_session': S, 'task': S, 'kind': S, 'body': S, 'idempotency_key': S, 'reply_to': S, 'revision': S, 'task_update': {'type': 'object'}, 'attachments': {'type': 'array', 'items': {'type': 'object'}}}, ('recipient_session', 'task', 'body', 'idempotency_key'))},
    {'name': 'collab_ack', 'description': 'Acknowledge a message addressed to this exact bound session after processing it.', 'inputSchema': schema({'message_id': S}, ('message_id',))},
    {'name': 'collab_attach', 'description': 'Store an original local file from an explicitly allowed root. Returns durable local artifact metadata and SHA-256. No attachment is executed or ZIP extracted.', 'inputSchema': schema({'path': S}, ('path',))},
    {'name': 'collab_artifact', 'description': 'Verify and inspect an attachment. Small raster images are returned as native MCP images; text as text. Other formats return download metadata.', 'inputSchema': schema({'sha256': S}, ('sha256',))},
    {'name': 'collab_review', 'description': 'Register an immutable animation revision using explicit raster frames or sprite sheet crop rectangles. Original files stay local.', 'inputSchema': schema({'manifest': {'type': 'object'}}, ('manifest',))},
    {'name': 'collab_feedback', 'description': 'Record a frame decision or annotation with task/revision provenance.', 'inputSchema': schema({'feedback': {'type': 'object'}}, ('feedback',))},
    {'name': 'collab_claim', 'description': 'Claim one task/file area for this session; overlapping ownership is refused.', 'inputSchema': schema({'task': S, 'area': S}, ('task', 'area'))},
    {'name': 'collab_task', 'description': 'Persist an actionable task or revision. Preserve prior decisions and classify new items as user_decision, tentative, recommendation or observation. Use a stable event_key; include conversation/message provenance.', 'inputSchema': schema({'event': {'type': 'object'}}, ('event',))},
]


class Adapter:
    def __init__(self, url, data, session, roots=()):
        self.url = url.rstrip('/')
        if not self.url.startswith(('http://127.0.0.1:', 'http://localhost:')):
            raise ValueError('MCP adapter requires a loopback service URL')
        self.key = (Path(data) / 'service.key').read_text().strip()
        self.session = session
        self.roots = [Path(p).resolve() for p in roots]

    def request(self, path, body=None, raw=None, headers=None):
        h = {'X-Collab-Key': self.key, **(headers or {})}
        if body is not None:
            raw = json.dumps(body).encode()
            h['Content-Type'] = 'application/json'
        req = urllib.request.Request(self.url + path, data=raw, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                content = response.read()
                return json.loads(content) if response.headers.get_content_type() == 'application/json' else content
        except urllib.error.HTTPError as e:
            raise ValueError(e.read().decode()) from e

    def call(self, name, args):
        if name == 'collab_inbox':
            state = self.request('/api/state')
            messages, cursor = [], 0
            while True:
                page = self.request('/api/inbox?session=' + urllib.parse.quote(self.session) + '&after=' + str(cursor))
                messages.extend(page['messages'])
                cursor = page['next_cursor']
                if len(page['messages']) < 1000:
                    break
            for m in messages:
                if m['delivery']['state'] == 'queued':
                    self.request('/api/receipt', {'session': self.session, 'message_id': m['message_id'], 'state': 'delivered'})
            result = {'session': self.session, 'messages': messages, 'reviews': state['reviews'], 'feedback': state['feedback'],
                      'tasks': state['tasks'], 'task_events': state['task_events'], 'capabilities': state['capabilities'], 'boundary': state['desktop_boundary']}
        elif name == 'collab_send':
            result = self.request('/api/send', dict(args, session=self.session))
        elif name == 'collab_ack':
            result = self.request('/api/receipt', {'session': self.session, 'message_id': args['message_id'], 'state': 'acknowledged'})
        elif name == 'collab_attach':
            p = Path(args['path']).resolve()
            if not any(p == root or root in p.parents for root in self.roots):
                raise ValueError('Attachment path is outside the configured read roots')
            if not p.is_file() or p.stat().st_size > 64 * 1024 * 1024:
                raise ValueError('Attachment must be a regular file of at most 64 MiB')
            raw = p.read_bytes()
            result = self.request('/api/artifacts', raw=raw, headers={'X-Filename': urllib.parse.quote(p.name), 'X-SHA256': hashlib.sha256(raw).hexdigest()})
        elif name == 'collab_artifact':
            digest = args['sha256']
            state = self.request('/api/state')
            attachments = [a for m in state['messages'] for a in (m.get('attachments') or [])]
            a = next((a for a in attachments if a['sha256'] == digest), None)
            if a is None:
                raise ValueError('Artifact must be attached to a visible mailbox message')
            raw = self.request('/artifacts/' + digest)
            if hashlib.sha256(raw).hexdigest() != digest:
                raise ValueError('Attachment digest mismatch')
            blocks = [{'type': 'text', 'text': json.dumps(dict(a, verified=True, url=self.url + '/artifacts/' + digest))}]
            if a['media_type'] in ('image/png', 'image/jpeg', 'image/webp') and len(raw) <= 8 * 1024 * 1024:
                blocks.append({'type': 'image', 'mimeType': a['media_type'], 'data': base64.b64encode(raw).decode()})
            elif (a['media_type'].startswith('text/') or a['media_type'] == 'application/json') and len(raw) <= 64000:
                blocks.append({'type': 'text', 'text': raw.decode('utf-8', errors='replace')})
            else:
                blocks.append({'type': 'text', 'text': 'Native preview unavailable for this format or size. Original retained; use the local download link.'})
            return {'content': blocks}
        elif name == 'collab_review':
            result = self.request('/api/reviews', args['manifest'])
        elif name == 'collab_feedback':
            result = self.request('/api/feedback', args['feedback'])
        elif name == 'collab_claim':
            result = self.request('/api/claim', dict(args, owner=self.session))
        elif name == 'collab_task':
            result = self.request('/api/task-event', dict(args['event'], session=self.session))
        else:
            raise ValueError('Unknown tool')
        return {'content': [{'type': 'text', 'text': json.dumps(result)}]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:4488')
    parser.add_argument('--data', required=True)
    parser.add_argument('--session', required=True)
    parser.add_argument('--root', action='append', default=[])
    args = parser.parse_args()
    adapter = Adapter(args.url, args.data, args.session, args.root)
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            rid = request.get('id')
            if rid is None:
                continue
            method = request['method']
            if method == 'initialize':
                result = {'protocolVersion': request.get('params', {}).get('protocolVersion', '2025-06-18'), 'capabilities': {'tools': {}},
                          'serverInfo': {'name': 'collaboration-room', 'version': '1.0.0'},
                          'instructions': 'Bound session: ' + args.session + '. Only the designated owning conversation should use this session binding. Read collab_inbox, reply with collab_send, then collab_ack. Never claim a worker is the owning desktop conversation.'}
            elif method == 'tools/list':
                result = {'tools': TOOLS}
            elif method == 'tools/call':
                try:
                    result = adapter.call(request['params']['name'], request['params'].get('arguments', {}))
                except Exception as e:
                    result = {'content': [{'type': 'text', 'text': str(e)}], 'isError': True}
            elif method == 'ping':
                result = {}
            else:
                raise ValueError('Unsupported MCP method')
            response = {'jsonrpc': '2.0', 'id': rid, 'result': result}
        except Exception as e:
            response = {'jsonrpc': '2.0', 'id': request.get('id'), 'error': {'code': -32602, 'message': str(e)}}
        print(json.dumps(response), flush=True)


if __name__ == '__main__':
    main()
