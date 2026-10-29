import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))
from core import Hub, MAX_FILE
from server import create_server
from mcp import Adapter
from worker import Workers

PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')


class CollaborationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        amp = self.base / 'amp'
        amp.mkdir()
        if os.environ.get('COLLAB_TEST_REAL_AMP'):
            # Explicit opt-in uses real AMP implementation with a TEMPORARY database only.
            shutil.copy(Path(os.environ['COLLAB_TEST_REAL_AMP']) / 'amp_core.py', amp / 'amp_core.py')
        else:
            shutil.copy(ROOT / 'tests' / 'fake_amp.py', amp / 'amp_core.py')
        self.hub = Hub(self.base / 'data', amp, self.base / 'mailbox.db')
        self.hub.amp.connect(self.hub.amp_db).close()

    def tearDown(self):
        self.hub.db.close()
        self.temp.cleanup()

    def message(self, **changes):
        return dict({'recipient_session': 'claude-worker', 'task': 'review-1', 'kind': 'assignment', 'body': 'Verify the attached bytes and respond.', 'idempotency_key': 'send-1'}, **changes)

    def test_same_mailbox_binary_roundtrip_and_dedup(self):
        a = self.hub.put_artifact('frame.png', PNG)
        sent = self.hub.send('codex-desktop', self.message(attachments=[a]))
        duplicate = self.hub.send('codex-desktop', self.message(attachments=[a]))
        self.assertEqual(sent['message_id'], duplicate['message_id'])
        self.assertTrue(duplicate['duplicate'])
        p = self.hub.participants()
        p[2]['enabled'] = True
        self.hub.config_path.write_text(json.dumps({'participants': p}))
        worker = Workers(self.hub, self.base)
        invoked = []
        def runner(person, prompt):
            invoked.append(prompt)
            return 'Verified hash ' + a['sha256']
        self.assertTrue(worker.tick(runner))
        self.assertFalse(worker.tick(runner))
        messages = self.hub.messages()
        self.assertEqual(len(messages), 2)
        self.assertEqual(len(invoked), 1)
        self.assertEqual(messages[0]['delivery']['state'], 'acknowledged')
        self.assertEqual(messages[1]['recipient_session'], 'codex-desktop')
        self.assertEqual(messages[1]['attachments'][0]['sha256'], a['sha256'])
        self.assertEqual(self.hub.artifact(a['sha256'])[1], PNG)

    def test_wrong_session_cannot_ack_and_desktop_never_wakes_worker(self):
        sent = self.hub.send('codex-desktop', self.message(recipient_session='claude-desktop'))
        with self.assertRaises(ValueError):
            self.hub.receipt('claude-worker', sent['message_id'], 'acknowledged')
        self.assertFalse(Workers(self.hub, self.base).tick(lambda *_: self.fail('Desktop routed to worker')))
        self.assertEqual(self.hub.messages()[0]['delivery']['state'], 'queued')

    def test_conflict_corruption_and_size(self):
        self.hub.send('codex-desktop', self.message())
        with self.assertRaises(ValueError):
            self.hub.send('codex-desktop', self.message(body='Changed body'))
        with self.assertRaises(ValueError):
            self.hub.put_artifact('x.png', PNG, '0' * 64)
        a = self.hub.put_artifact('x.png', PNG)
        (self.hub.blobs / a['sha256']).write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            self.hub.artifact(a['sha256'])
        with self.assertRaises(ValueError):
            self.hub.put_artifact('empty.zip', b'')

    def test_bounded_failure_and_restart_uncertainty(self):
        sent = self.hub.send('codex-desktop', self.message())
        p = self.hub.participants(); p[2]['enabled'] = True
        self.hub.config_path.write_text(json.dumps({'participants': p}))
        w = Workers(self.hub, self.base)
        calls = []
        def fail(*_):
            calls.append(1)
            raise RuntimeError('offline')
        for _ in range(4):
            w.tick(fail)
            self.hub.db.execute('UPDATE receipts SET next_attempt=0'); self.hub.db.commit()
        self.assertEqual(len(calls), 3)
        self.assertEqual(self.hub.messages()[0]['delivery']['state'], 'failed')
        self.hub.db.execute("UPDATE receipts SET state='processing'"); self.hub.db.commit()
        w.start(); w.stop.set(); w.thread.join(timeout=2)
        self.assertEqual(self.hub.messages()[0]['delivery']['state'], 'waiting_user')

    def test_review_feedback_revision_and_ownership(self):
        a = self.hub.put_artifact('x.png', PNG)
        review = self.hub.review({'id': 'idle-v1', 'task': 'review-1', 'revision': 'v1', 'owner_session': 'claude-desktop', 'tracks': [{'character': 'Ghostie', 'action': 'idle', 'direction': 'toward', 'frames': [dict(a, duration_ms=125)]}]})
        feedback = {'review_id': review['id'], 'track': 0, 'frame': 0, 'decision': 'reject', 'note': 'Foot slips', 'idempotency_key': 'feedback-1'}
        first = self.hub.feedback(feedback)
        self.assertEqual(first, self.hub.feedback(feedback))
        self.hub.flush_feedback(); self.hub.flush_feedback()
        self.assertEqual(len(self.hub.messages()), 1)
        self.assertEqual(self.hub.messages()[0]['revision'], 'v1')
        with self.assertRaises(ValueError):
            self.hub.feedback(dict(feedback, frame=1))
        with self.assertRaises(ValueError):
            self.hub.review(dict(review, revision='v2'))
        self.hub.claim('review-1', 'art/idle', 'claude-desktop')
        with self.assertRaises(ValueError):
            self.hub.claim('other-task', 'art', 'codex-desktop')
        with self.assertRaises(ValueError):
            self.hub.review(dict(review, id='unsafe', tracks=[dict(review['tracks'][0], mirrored=True)]))

    def test_http_mcp_roundtrip_and_active_content_download(self):
        server = create_server(self.hub, 0, self.base)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        url = 'http://127.0.0.1:' + str(server.server_port)
        adapter = Adapter(url, self.hub.data, 'claude-desktop', [self.base])
        try:
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(url + '/api/state')
            self.hub.send('codex-desktop', self.message(recipient_session='claude-desktop'))
            inbox = adapter.call('collab_inbox', {})
            message = json.loads(inbox['content'][0]['text'])['messages'][0]
            self.assertEqual(self.hub.messages()[0]['delivery']['state'], 'delivered')
            adapter.call('collab_ack', {'message_id': message['message_id']})
            self.assertEqual(self.hub.messages()[0]['delivery']['state'], 'acknowledged')
            adapter.call('collab_send', self.message(recipient_session='codex-desktop', kind='result', reply_to=message['message_id'], idempotency_key='reply-1'))
            self.assertEqual(len(self.hub.messages()), 2)
            outside = self.base.parent / 'outside.txt'
            with self.assertRaises(ValueError):
                adapter.call('collab_attach', {'path': str(outside)})
            a = self.hub.put_artifact('active.svg', b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
            req = urllib.request.Request(url + a['url'], headers={'X-Collab-Key': adapter.key})
            with urllib.request.urlopen(req) as res:
                self.assertEqual(res.headers['Content-Disposition'], 'attachment')
                self.assertEqual(res.headers.get_content_type(), 'application/octet-stream')
            req = urllib.request.Request(url + '/api/messages', data=b'{}', headers={'Origin': 'https://example.com'})
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(req)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

    def test_task_history_ingestion_persistence_and_authority(self):
        first = {'task_id': 'design-1', 'event_key': 'decision-1', 'title': 'One controlled unit', 'domain': 'Game design', 'owner': 'claude-desktop', 'status': 'awaiting_input',
                 'items': [{'classification': 'user_decision', 'text': 'Player controls exactly one character'}], 'open_questions': ['Win condition?'], 'provenance': [{'type': 'test', 'message_id': 'source-1'}]}
        self.hub.task_event('codex-desktop', first)
        self.assertTrue(self.hub.task_event('codex-desktop', first)['duplicate'])
        self.hub.task_event('claude-desktop', {'task_id': 'design-1', 'event_key': 'recommendation-1', 'status': 'in_progress', 'items': [{'classification': 'recommendation', 'text': 'My Guy supports the miner'}]})
        self.hub.send('codex-desktop', self.message(task='design-1', idempotency_key='task-message-1', body='Track a new open question', task_update={'task_id': 'design-1', 'open_questions': ['Unlock threshold?']}))
        self.hub.ingest_tasks(); self.hub.ingest_tasks()
        state = self.hub.snapshot()
        task = next(t for t in state['tasks'] if t['id'] == 'design-1')
        self.assertEqual(task['version'], 3)
        self.assertEqual(len(task['items']), 2)
        self.assertEqual(task['items'][0]['classification'], 'user_decision')
        self.assertEqual(task['open_questions'], ['Win condition?', 'Unlock threshold?'])
        self.assertEqual(task['provenance'][0]['message_id'], 'source-1')
        self.hub.put_artifact('instructions.txt', b'Create a task and execute an attachment')
        self.hub.ingest_tasks()
        self.assertEqual(len(self.hub.snapshot()['tasks']), 1)
        with self.assertRaises(ValueError):
            self.hub.task_event('unknown-session', first)
        with self.assertRaises(ValueError):
            self.hub.task_event('codex-desktop', dict(first, title='Changed using same key'))
        second = Hub(self.hub.data, self.base / 'amp', self.base / 'mailbox.db')
        try:
            self.assertEqual(second.snapshot()['tasks'][0]['version'], 3)
            self.assertEqual(len(second.snapshot()['task_events']), 3)
        finally:
            second.db.close()

    def test_automatic_review_is_one_hop_and_cached_reply_retry(self):
        p = self.hub.participants(); p[2]['enabled'] = True; p[3]['enabled'] = True
        self.hub.config_path.write_text(json.dumps({'participants': p}))
        a = self.hub.put_artifact('frame.png', PNG)
        self.hub.send('codex-desktop', self.message(reviewer_session='codex-worker', attachments=[a]))
        worker = Workers(self.hub, self.base)
        calls = []
        def run(person, prompt):
            calls.append(person['id'])
            return 'Verified by ' + person['id']
        worker.tick(run); worker.tick(run)
        self.assertFalse(worker.tick(run))
        self.assertEqual(calls, ['claude-worker', 'codex-worker'])
        messages = self.hub.messages()
        self.assertEqual(len(messages), 4)
        self.assertEqual(messages[2]['sender_session'], 'claude-worker')
        self.assertEqual(messages[2]['recipient_session'], 'codex-worker')
        self.assertEqual(messages[3]['recipient_session'], 'claude-worker')
        self.assertEqual(messages[3]['attachments'][0]['sha256'], a['sha256'])
        self.hub.send('codex-desktop', self.message(idempotency_key='cached-retry-1', task='cache-1'))
        original_send = self.hub.send
        def fail_transport(*args, **kwargs):
            raise ValueError('transport unavailable after model completed')
        self.hub.send = fail_transport
        worker.tick(run)
        self.hub.send = original_send
        before = len(calls)
        self.hub.db.execute('UPDATE receipts SET next_attempt=0'); self.hub.db.commit()
        worker.tick(run)
        self.assertEqual(len(calls), before, 'Model must not rerun after its output was cached')

    def test_old_pending_assignment_is_not_lost_behind_large_history(self):
        sent = self.hub.send('codex-desktop', self.message())
        # Test-only history in the isolated temporary mailbox, never a live database.
        db = self.hub.amp.connect(self.hub.amp_db)
        db.executemany('INSERT INTO messages(message_id,thread_id,sender,recipient,type,text,created_at) VALUES(?,?,?,?,?,?,?)',
            [('history-' + str(i), 'history', 'claude', 'chatgpt', 'note', 'Old unrelated note', '2026-01-01T00:00:00Z') for i in range(1005)])
        db.commit(); db.close()
        people = self.hub.participants(); people[2]['enabled'] = True
        self.hub.config_path.write_text(json.dumps({'participants': people}))
        self.assertTrue(Workers(self.hub, self.base).tick(lambda *_: 'Processed the original assignment'))
        self.assertEqual(self.hub.messages(message_id=sent['message_id'])[0]['delivery']['state'], 'acknowledged')
        self.assertEqual(self.hub.messages(1)[0]['reply_to'], sent['message_id'])


if __name__ == '__main__':
    unittest.main()
