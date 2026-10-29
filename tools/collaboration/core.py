"""Local collaboration metadata over the existing AMP mailbox. Standard library only."""
import hashlib
import importlib.util
import json
import mimetypes
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import uuid

PREFIX = 'COLLAB/1\n'
MAX_FILE = 64 * 1024 * 1024
MAX_STORE = 1024 * 1024 * 1024
KINDS = {'question', 'assignment', 'result', 'revision', 'note', 'feedback'}
ID = re.compile(r'^[a-zA-Z0-9_.:-]{1,128}$')
HASH = re.compile(r'^[a-f0-9]{64}$')


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def load_amp(home):
    spec = importlib.util.spec_from_file_location('collab_amp_core', Path(home) / 'amp_core.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Hub:
    def __init__(self, data, amp_home, amp_db=None):
        self.data = Path(data).resolve()
        self.data.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.blobs = self.data / 'artifacts'
        self.blobs.mkdir(exist_ok=True, mode=0o700)
        self.amp = load_amp(amp_home)
        self.amp_db = str(amp_db or Path(amp_home) / 'mailbox.db')
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(self.data / 'collaboration.sqlite3'), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
          PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS artifacts(hash TEXT PRIMARY KEY, bytes INTEGER, media_type TEXT, created REAL);
          CREATE TABLE IF NOT EXISTS receipts(message_id TEXT PRIMARY KEY, session TEXT, state TEXT, attempts INTEGER DEFAULT 0,
              updated REAL, error TEXT, next_attempt REAL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, body TEXT, created REAL);
          CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, request_key TEXT UNIQUE, body TEXT, created REAL);
          CREATE TABLE IF NOT EXISTS leases(area TEXT PRIMARY KEY, task TEXT, owner TEXT);
          CREATE TABLE IF NOT EXISTS worker_results(message_id TEXT PRIMARY KEY, body TEXT, attachments TEXT);
          CREATE TABLE IF NOT EXISTS feedback_delivery(id TEXT PRIMARY KEY, delivered INTEGER DEFAULT 0, error TEXT);
          CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, body TEXT, version INTEGER, updated REAL);
          CREATE TABLE IF NOT EXISTS task_events(event_key TEXT PRIMARY KEY, task_id TEXT, author TEXT, body TEXT, created REAL);
          CREATE TABLE IF NOT EXISTS capabilities(session TEXT, capability TEXT, state TEXT, evidence TEXT, updated REAL, PRIMARY KEY(session,capability));
          CREATE TABLE IF NOT EXISTS cursors(name TEXT PRIMARY KEY, seq INTEGER);
          CREATE TABLE IF NOT EXISTS worker_dispatches(id TEXT PRIMARY KEY, message_id TEXT, at REAL);
        ''')
        self.db.commit()
        self.config_path = self.data / 'participants.json'
        if not self.config_path.exists():
            self.config_path.write_text(json.dumps({'participants': [
                {'id': 'codex-desktop', 'principal': 'chatgpt', 'mode': 'desktop', 'label': 'Codex desktop'},
                {'id': 'claude-desktop', 'principal': 'claude', 'mode': 'desktop', 'label': 'Claude desktop'},
                {'id': 'claude-worker', 'principal': 'claude', 'mode': 'worker', 'driver': 'claude', 'label': 'Claude Code worker', 'enabled': False},
                {'id': 'codex-worker', 'principal': 'chatgpt', 'mode': 'worker', 'driver': 'codex', 'label': 'Codex CLI worker', 'enabled': False}
            ]}, indent=2))
        self.run_id = str(uuid.uuid4())

    def participants(self):
        people = json.loads(self.config_path.read_text())['participants']
        for p in people:
            if not ID.fullmatch(p['id']) or p['principal'] not in ('claude', 'chatgpt'):
                raise ValueError('Invalid participant configuration')
        return people

    def participant(self, session):
        p = next((p for p in self.participants() if p['id'] == session), None)
        if p is None:
            raise ValueError('Unknown participant session')
        return p

    def amp_call(self, principal, op, arguments):
        db = self.amp.connect(self.amp_db)
        try:
            result = self.amp.call(db, principal, op, arguments)
            if not result['ok']:
                raise ValueError(canonical(result['error']))
            return result['result']
        finally:
            db.close()

    def put_artifact(self, name, content, expected=None):
        name = Path(name.replace('\\', '/')).name
        if not name or len(name) > 180 or any(ord(c) < 32 for c in name):
            raise ValueError('Invalid filename')
        if not content or len(content) > MAX_FILE:
            raise ValueError('File must contain 1 byte to 64 MiB')
        digest = hashlib.sha256(content).hexdigest()
        if expected and expected != digest:
            raise ValueError('SHA-256 mismatch')
        with self.lock:
            used = self.db.execute('SELECT coalesce(sum(bytes),0) FROM artifacts').fetchone()[0]
            exists = self.db.execute('SELECT 1 FROM artifacts WHERE hash=?', (digest,)).fetchone()
            if not exists and used + len(content) > MAX_STORE:
                raise ValueError('Local artifact store is full (1 GiB); export or archive before uploading')
            dest = self.blobs / digest
            if not dest.exists():
                temp = self.blobs / (digest + '.' + uuid.uuid4().hex + '.tmp')
                temp.write_bytes(content)
                os.chmod(temp, 0o600)
                os.replace(temp, dest)
            elif hashlib.sha256(dest.read_bytes()).hexdigest() != digest:
                raise ValueError('Stored artifact is corrupt; original not overwritten')
            media = mimetypes.guess_type(name)[0] or 'application/octet-stream'
            self.db.execute('INSERT OR IGNORE INTO artifacts VALUES(?,?,?,?)', (digest, len(content), media, time.time()))
            self.db.commit()
        return {'sha256': digest, 'name': name, 'bytes': len(content), 'media_type': media,
                'url': '/artifacts/' + digest, 'scope': 'local-machine', 'retention': 'until explicitly archived'}

    def artifact(self, digest):
        if not HASH.fullmatch(digest):
            raise ValueError('Invalid artifact digest')
        with self.lock:
            row = self.db.execute('SELECT * FROM artifacts WHERE hash=?', (digest,)).fetchone()
        if row is None:
            raise ValueError('Unknown artifact')
        content = (self.blobs / digest).read_bytes()
        if hashlib.sha256(content).hexdigest() != digest or len(content) != row['bytes']:
            raise ValueError('Artifact integrity check failed')
        return dict(row), content

    def send(self, sender, request):
        source = self.participant(sender)
        target = self.participant(request['recipient_session'])
        key = request['idempotency_key']
        task = request['task']
        if not isinstance(key, str) or not ID.fullmatch(key) or not ID.fullmatch(task):
            raise ValueError('Task and idempotency key must be stable identifiers, up to 128 characters')
        kind = request.get('kind', 'note')
        if kind not in KINDS:
            raise ValueError('Unsupported message kind')
        body = request.get('body', '')
        if not isinstance(body, str) or not body.strip() or len(body) > 12000:
            raise ValueError('Message body must contain 1 to 12000 characters')
        attachments = request.get('attachments', [])
        reviewer = request.get('reviewer_session')
        if reviewer:
            self.participant(reviewer)
            if reviewer == target['id']:
                raise ValueError('Reviewer must be a different session')
        if not isinstance(attachments, list) or len(attachments) > 32:
            raise ValueError('At most 32 attachments per message')
        for a in attachments:
            row, _ = self.artifact(a['sha256'])
            if a.get('bytes') != row['bytes']:
                raise ValueError('Attachment size mismatch')
        envelope = {'version': 1, 'sender_session': sender, 'recipient_session': target['id'],
                    'kind': kind, 'task': task, 'body': body, 'attachments': attachments,
                    'actor': request.get('actor', sender), 'revision': request.get('revision'),
                    'reply_to': request.get('reply_to'), 'reviewer_session': reviewer}
        if request.get('task_update'):
            self.validate_task_event(request['task_update'])
            if request['task_update']['task_id'] != task:
                raise ValueError('Structured task update must match the message task')
            envelope['task_update'] = request['task_update']
        # Wire notes prevent the legacy generic daemon from stealing session-addressed assignments.
        args = {'recipient': target['principal'], 'thread_id': task, 'type': 'note',
                'text': PREFIX + canonical(envelope), 'idempotency_key': key}
        if request.get('reply_to'):
            parent = next(iter(self.messages(message_id=request['reply_to'])), None)
            if not parent or parent.get('recipient_session') != sender or parent['thread_id'] != task:
                raise ValueError('Reply must address a message received by this session in the same task')
            args['reply_to'] = request['reply_to']
        result = self.amp_call(source['principal'], 'post_message', args)
        if request.get('task_update'):
            event = dict(request['task_update'], event_key='amp-' + result['message_id'])
            event['provenance'] = list(event.get('provenance', [])) + [{'type': 'amp', 'message_id': result['message_id'], 'summary': 'Authorized participant task event'}]
            self.task_event(sender, event)
        return result

    def messages(self, limit=300, after=None, pending=False, message_id=None, inbox_session=None):
        # Read-only projection of AMP. All writes use AMP's own operations, never its schema.
        db = sqlite3.connect('file:' + self.amp_db + '?mode=ro', uri=True)
        db.row_factory = sqlite3.Row
        try:
            query = 'SELECT m.*, a.status AS amp_ack, a.note AS amp_ack_note FROM messages m LEFT JOIN acks a USING(message_id) '
            if message_id:
                rows = db.execute(query + 'WHERE m.message_id=?', (message_id,)).fetchall()
            elif inbox_session:
                self.participant(inbox_session)
                rows = db.execute(query + 'WHERE m.seq>? AND a.message_id IS NULL AND m.text LIKE ? AND m.text LIKE ? ORDER BY m.seq LIMIT ?',
                    (after or 0, PREFIX + '%', '%"recipient_session":' + canonical(inbox_session) + '%', min(limit, 1000))).fetchall()
            elif pending:
                query += 'WHERE m.seq>? AND a.message_id IS NULL AND m.text LIKE ? AND (m.text LIKE ? OR m.text LIKE ? OR m.text LIKE ?) '
                rows = db.execute(query + 'ORDER BY m.seq LIMIT ?', (after or 0, PREFIX + '%', '%"kind":"assignment"%', '%"kind":"question"%', '%"kind":"revision"%', min(limit, 1000))).fetchall()
            elif after is None:
                rows = list(reversed(db.execute(query + 'ORDER BY m.seq DESC LIMIT ?', (min(limit, 1000),)).fetchall()))
            else:
                rows = db.execute(query + 'WHERE m.seq>? ORDER BY m.seq LIMIT ?', (after, min(limit, 1000))).fetchall()
        finally:
            db.close()
        out = []
        for row in rows:
            m = dict(row)
            if m['text'].startswith(PREFIX):
                try:
                    e = json.loads(m['text'][len(PREFIX):])
                    if e.get('version') != 1:
                        raise ValueError('version')
                    m.update({k: e.get(k) for k in ('sender_session', 'recipient_session', 'kind', 'task', 'body', 'attachments', 'revision', 'actor', 'reviewer_session', 'task_update')})
                except (ValueError, TypeError):
                    m['body'] = m['text']
            else:
                m['body'] = m['text']
            with self.lock:
                receipt = self.db.execute('SELECT * FROM receipts WHERE message_id=?', (m['message_id'],)).fetchone()
            m['delivery'] = dict(receipt) if receipt else {'state': 'acknowledged' if m['amp_ack'] == 'processed' else 'rejected' if m['amp_ack'] else 'queued', 'attempts': 0}
            out.append(m)
        return out

    def pending_assignments(self):
        cursor = 0
        while True:
            batch = self.messages(1000, after=cursor, pending=True)
            if not batch:
                return
            for m in batch:
                cursor = m['seq']
                yield m

    def result_count(self, task, session):
        db = sqlite3.connect('file:' + self.amp_db + '?mode=ro', uri=True)
        try:
            return db.execute('SELECT count(*) FROM messages WHERE thread_id=? AND text LIKE ? AND text LIKE ?',
                              (task, '%"sender_session":' + canonical(session) + '%', '%"kind":"result"%')).fetchone()[0]
        finally:
            db.close()

    def receipt(self, session, message_id, state, error=None):
        if state not in ('delivered', 'acknowledged', 'failed', 'waiting_user'):
            raise ValueError('Invalid receipt state')
        message = next(iter(self.messages(message_id=message_id)), None)
        if not message or message.get('recipient_session') != session:
            raise ValueError('Receipt requires the exact recipient session')
        with self.lock:
            old = self.db.execute('SELECT * FROM receipts WHERE message_id=?', (message_id,)).fetchone()
            if old and old['state'] == 'acknowledged' and state != 'acknowledged':
                raise ValueError('Acknowledged delivery cannot be downgraded')
            self.db.execute('INSERT INTO receipts(message_id,session,state,updated,error) VALUES(?,?,?,?,?) '
                            'ON CONFLICT(message_id) DO UPDATE SET state=excluded.state,updated=excluded.updated,error=excluded.error',
                            (message_id, session, state, time.time(), error))
            self.db.commit()
        if state == 'acknowledged':
            self.amp_call(self.participant(session)['principal'], 'ack_message', {'message_id': message_id, 'note': 'collaboration session ' + session})
        return {'message_id': message_id, 'session': session, 'state': state}

    def review(self, body):
        if not ID.fullmatch(body['task']) or not ID.fullmatch(body['revision']):
            raise ValueError('Review requires stable task and revision identifiers')
        tracks = body.get('tracks', [])
        if not tracks or len(tracks) > 128:
            raise ValueError('Review requires 1 to 128 tracks')
        for t in tracks:
            if not all(isinstance(t.get(k), str) and 0 < len(t[k]) < 100 for k in ('character', 'action', 'direction')):
                raise ValueError('Track requires character, action and direction')
            frames = t.get('frames', [])
            if not frames or len(frames) > 240:
                raise ValueError('Track requires 1 to 240 explicit frames')
            for f in frames:
                row, _ = self.artifact(f['sha256'])
                if row['media_type'] not in ('image/png', 'image/jpeg', 'image/webp'):
                    raise ValueError('Review frames must be PNG, JPEG or WebP; GIF/video are downloadable attachments')
                if not isinstance(f.get('duration_ms', 100), int) or not 10 <= f.get('duration_ms', 100) <= 10000:
                    raise ValueError('Frame duration must be 10 to 10000 ms')
                crop = f.get('crop')
                if crop and (len(crop) != 4 or any(not isinstance(v, int) or v < 0 for v in crop) or min(crop[2:]) < 1):
                    raise ValueError('Crop must be [x,y,width,height] in source pixels')
            if t.get('mirrored') and not t.get('mirror_safe', False):
                raise ValueError('Mirroring requires an explicit mirror_safe flag; lettering needs distinct art')
        rid = body.get('id', 'review-' + uuid.uuid4().hex)
        if not ID.fullmatch(rid):
            raise ValueError('Invalid review id')
        value = dict(body, id=rid)
        with self.lock:
            old = self.db.execute('SELECT body FROM reviews WHERE id=?', (rid,)).fetchone()
            if old and old['body'] != canonical(value):
                raise ValueError('Review revisions are immutable; create a new revision id')
            self.db.execute('INSERT OR IGNORE INTO reviews VALUES(?,?,?)', (rid, canonical(value), time.time()))
            self.db.commit()
        return value

    def feedback(self, body):
        with self.lock:
            row = self.db.execute('SELECT body FROM reviews WHERE id=?', (body['review_id'],)).fetchone()
        if row is None:
            raise ValueError('Unknown review')
        review = json.loads(row['body'])
        track = body.get('track', 0)
        frame = body.get('frame', 0)
        if not isinstance(track, int) or not 0 <= track < len(review['tracks']):
            raise ValueError('Unknown track')
        if not isinstance(frame, int) or not 0 <= frame < len(review['tracks'][track]['frames']):
            raise ValueError('Frame out of range')
        if body.get('decision') not in ('approve', 'reject', 'comment'):
            raise ValueError('Unsupported feedback decision')
        if not isinstance(body.get('note', ''), str) or len(body.get('note', '')) > 4000:
            raise ValueError('Feedback note too long')
        key = body['idempotency_key']
        if not ID.fullmatch(key):
            raise ValueError('Invalid feedback key')
        value = dict(body, task=review['task'], revision=review['revision'])
        with self.lock:
            old = self.db.execute('SELECT * FROM feedback WHERE request_key=?', (key,)).fetchone()
            if old:
                if old['body'] != canonical(value):
                    raise ValueError('Feedback idempotency conflict')
                return dict(value, id=old['id'])
            fid = 'feedback-' + uuid.uuid4().hex
            self.db.execute('INSERT INTO feedback VALUES(?,?,?,?)', (fid, key, canonical(value), time.time()))
            self.db.commit()
        return dict(value, id=fid)

    def flush_feedback(self):
        """A durable outbox for frame annotations; retry the same AMP key after errors."""
        with self.lock:
            rows = self.db.execute('SELECT f.* FROM feedback f LEFT JOIN feedback_delivery d USING(id) WHERE coalesce(d.delivered,0)=0').fetchall()
        for row in rows:
            f = json.loads(row['body'])
            with self.lock:
                review = json.loads(self.db.execute('SELECT body FROM reviews WHERE id=?', (f['review_id'],)).fetchone()[0])
            owner = review.get('owner_session')
            if not owner:
                continue
            try:
                self.send('codex-desktop', {'recipient_session': owner, 'task': f['task'], 'kind': 'feedback',
                    'body': f['decision'].upper() + ' track ' + str(f['track'] + 1) + ', frame ' + str(f['frame'] + 1) + ': ' + f.get('note', ''),
                    'revision': f['revision'], 'idempotency_key': 'frame-' + row['id'], 'actor': 'human'})
                error, delivered = None, 1
            except Exception as e:
                error, delivered = str(e)[:500], 0
            with self.lock:
                self.db.execute('INSERT OR REPLACE INTO feedback_delivery VALUES(?,?,?)', (row['id'], delivered, error))
                self.db.commit()

    def claim(self, task, area, owner):
        self.participant(owner)
        if not ID.fullmatch(task) or not isinstance(area, str) or not area or len(area) > 180:
            raise ValueError('Task and file area required')
        # Directory overlap is checked, so two owners cannot claim parent/child areas.
        area = area.strip('/')
        if not area or '..' in area.split('/'):
            raise ValueError('Invalid file area')
        with self.lock:
            for r in self.db.execute('SELECT * FROM leases'):
                overlap = area == r['area'] or area.startswith(r['area'] + '/') or r['area'].startswith(area + '/')
                if overlap and (r['owner'] != owner or r['task'] != task):
                    raise ValueError('File area already owned by ' + r['owner'] + ' for ' + r['task'])
            self.db.execute('INSERT OR IGNORE INTO leases VALUES(?,?,?)', (area, task, owner))
            self.db.commit()
        return {'task': task, 'area': area, 'owner': owner}

    def snapshot(self):
        with self.lock:
            reviews = [json.loads(r[0]) for r in self.db.execute('SELECT body FROM reviews ORDER BY created')]
            feedback = [dict(json.loads(r['body']), id=r['id'], created=r['created']) for r in self.db.execute('SELECT * FROM feedback ORDER BY created')]
            for f in feedback:
                delivery = self.db.execute('SELECT * FROM feedback_delivery WHERE id=?', (f['id'],)).fetchone()
                f['notification'] = dict(delivery) if delivery else {'delivered': 0, 'error': None}
            leases = [dict(r) for r in self.db.execute('SELECT * FROM leases')]
            tasks = [dict(json.loads(r['body']), version=r['version'], updated=r['updated']) for r in self.db.execute('SELECT * FROM tasks ORDER BY updated DESC')]
            task_events = [dict(json.loads(r['body']), author=r['author'], created=r['created']) for r in self.db.execute('SELECT * FROM task_events ORDER BY created')]
            capabilities = [dict(r) for r in self.db.execute('SELECT * FROM capabilities')]
        return {'run_id': self.run_id, 'participants': self.participants(), 'messages': self.messages(),
                'reviews': reviews, 'feedback': feedback, 'ownership': leases,
                'tasks': tasks, 'task_events': task_events, 'capabilities': capabilities,
                'limits': {'file_bytes': MAX_FILE, 'store_bytes': MAX_STORE},
                'desktop_boundary': 'Desktop chats require an active user/model turn to call MCP. No desktop wake adapter is configured. CLI worker receipts do not prove delivery to a desktop conversation.'}

    def validate_task_event(self, event):
        if not isinstance(event, dict) or not ID.fullmatch(event.get('task_id', '')):
            raise ValueError('Task event requires task_id')
        if event.get('status', 'open') not in ('open', 'in_progress', 'review_needed', 'blocked', 'awaiting_input', 'done'):
            raise ValueError('Invalid task status')
        for key in ('title', 'domain', 'owner', 'summary'):
            if key in event and (not isinstance(event[key], str) or len(event[key]) > 4000):
                raise ValueError('Invalid task ' + key)
        for item in event.get('items', []):
            if item.get('classification') not in ('user_decision', 'tentative', 'recommendation', 'observation') or not isinstance(item.get('text'), str) or len(item['text']) > 4000:
                raise ValueError('Task items require explicit decision/tentative/recommendation/observation classification')
        for name in ('dependencies', 'open_questions', 'resolved_questions', 'provenance', 'artifacts'):
            if not isinstance(event.get(name, []), list) or len(event.get(name, [])) > 128:
                raise ValueError('Invalid task ' + name)
        for dep in event.get('dependencies', []):
            if not isinstance(dep, str) or not ID.fullmatch(dep):
                raise ValueError('Dependencies must be task identifiers')
        for name in ('open_questions', 'resolved_questions'):
            if any(not isinstance(q, str) or len(q) > 4000 for q in event.get(name, [])):
                raise ValueError('Questions must be text')
        for a in event.get('artifacts', []):
            if not isinstance(a, dict) or not HASH.fullmatch(a.get('sha256', '')):
                raise ValueError('Task artifacts require content hashes')
        if event['task_id'] in event.get('dependencies', []):
            raise ValueError('A task cannot depend on itself')
        if len(canonical(event)) > 64000:
            raise ValueError('Task event too large')

    def task_event(self, author, event):
        self.participant(author)
        self.validate_task_event(event)
        key = event.get('event_key', '')
        if not ID.fullmatch(key):
            raise ValueError('Task event needs a stable event_key')
        value = canonical(event)
        with self.lock:
            old_event = self.db.execute('SELECT * FROM task_events WHERE event_key=?', (key,)).fetchone()
            if old_event:
                if old_event['body'] != value or old_event['author'] != author:
                    raise ValueError('Task event idempotency conflict')
                return {'task_id': event['task_id'], 'duplicate': True}
            row = self.db.execute('SELECT * FROM tasks WHERE id=?', (event['task_id'],)).fetchone()
            task = json.loads(row['body']) if row else {'id': event['task_id'], 'title': event['task_id'], 'domain': 'Unsorted', 'owner': 'unassigned', 'status': 'open'}
            for name in ('title', 'domain', 'owner', 'status', 'summary'):
                if name in event:
                    task[name] = event[name]
            # Append/merge, never replace prior requirements, questions, links or dependencies.
            for name in ('items', 'dependencies', 'open_questions', 'resolved_questions', 'provenance', 'artifacts'):
                merged = task.get(name, [])
                for item in event.get(name, []):
                    if item not in merged:
                        merged.append(item)
                task[name] = merged
            version = row['version'] + 1 if row else 1
            now = time.time()
            self.db.execute('INSERT INTO task_events VALUES(?,?,?,?,?)', (key, task['id'], author, value, now))
            self.db.execute('INSERT OR REPLACE INTO tasks VALUES(?,?,?,?)', (task['id'], canonical(task), version, now))
            self.db.commit()
        return {'task_id': task['id'], 'version': version, 'duplicate': False}

    def ingest_tasks(self):
        people = {p['id']: p for p in self.participants()}
        with self.lock:
            cursor = self.db.execute("SELECT seq FROM cursors WHERE name='tasks'").fetchone()
        for m in self.messages(1000, after=cursor[0] if cursor else 0):
            source = people.get(m.get('sender_session'))
            with self.lock:
                exists_event = self.db.execute('SELECT 1 FROM task_events WHERE event_key=?', ('amp-' + m['message_id'],)).fetchone()
            event = None
            if exists_event or not source or source['principal'] != m['sender']:
                pass
            elif m.get('task_update'):
                event = dict(m['task_update'], event_key='amp-' + m['message_id'])
                event['provenance'] = list(event.get('provenance', [])) + [{'type': 'amp', 'message_id': m['message_id'], 'summary': 'Authorized participant task event'}]
            elif m.get('kind') in ('assignment', 'question', 'revision'):
                with self.lock:
                    exists = self.db.execute('SELECT 1 FROM tasks WHERE id=?', (m['thread_id'],)).fetchone()
                event = {'task_id': m['thread_id'], 'event_key': 'amp-' + m['message_id'],
                    'items': [{'classification': 'observation', 'text': m['body']}],
                    'provenance': [{'type': 'amp', 'message_id': m['message_id'], 'summary': 'Session-addressed ' + m['kind']}],
                    'artifacts': m.get('attachments') or []}
                if not exists:
                    event.update(title=m['body'][:100], domain='Unsorted', owner=m['recipient_session'], status='open')
            if event:
                self.task_event(source['id'], event)
            with self.lock:
                self.db.execute("INSERT OR REPLACE INTO cursors VALUES('tasks',?)", (m['seq'],))
                self.db.commit()

    def capability(self, session, capability, state, evidence):
        self.participant(session)
        if capability not in ('read', 'write', 'artifact', 'automatic_wake') or state not in ('passed', 'failed', 'unverified', 'unsupported'):
            raise ValueError('Invalid capability test')
        with self.lock:
            self.db.execute('INSERT OR REPLACE INTO capabilities VALUES(?,?,?,?,?)', (session, capability, state, evidence[:4000], time.time()))
            self.db.commit()
        return {'session': session, 'capability': capability, 'state': state}
