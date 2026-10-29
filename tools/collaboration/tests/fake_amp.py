"""Small test double for AMP's public call contract, never points at a live mailbox."""
import hashlib
import json
import sqlite3
import time
import uuid


def connect(path):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript('''
      CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,message_id TEXT UNIQUE,thread_id TEXT,sender TEXT,recipient TEXT,type TEXT,reply_to TEXT,text TEXT,created_at TEXT);
      CREATE TABLE IF NOT EXISTS acks(message_id TEXT PRIMARY KEY,status TEXT,note TEXT);
      CREATE TABLE IF NOT EXISTS idem(principal TEXT,key TEXT,body TEXT,result TEXT,PRIMARY KEY(principal,key));
    ''')
    return db


def call(db, principal, op, args):
    if op == 'post_message':
        body = json.dumps(args, sort_keys=True)
        old = db.execute('SELECT * FROM idem WHERE principal=? AND key=?', (principal, args['idempotency_key'])).fetchone()
        if old:
            if old['body'] != body:
                return {'ok': False, 'error': {'code': 'IDEMPOTENCY_CONFLICT'}}
            return {'ok': True, 'result': dict(json.loads(old['result']), duplicate=True)}
        mid = 'msg_' + uuid.uuid4().hex
        cursor = db.execute('INSERT INTO messages(message_id,thread_id,sender,recipient,type,reply_to,text,created_at) VALUES(?,?,?,?,?,?,?,?)',
            (mid, args['thread_id'], principal, args['recipient'], args['type'], args.get('reply_to'), args['text'], '2026-01-01T00:00:00Z'))
        result = {'message_id': mid, 'seq': cursor.lastrowid, 'duplicate': False}
        db.execute('INSERT INTO idem VALUES(?,?,?,?)', (principal, args['idempotency_key'], body, json.dumps(result)))
        db.commit()
        return {'ok': True, 'result': result}
    if op == 'ack_message':
        m = db.execute('SELECT * FROM messages WHERE message_id=?', (args['message_id'],)).fetchone()
        if m is None or m['recipient'] != principal:
            return {'ok': False, 'error': {'code': 'FORBIDDEN'}}
        db.execute('INSERT OR REPLACE INTO acks VALUES(?,?,?)', (args['message_id'], args.get('status', 'processed'), args.get('note')))
        db.commit()
        return {'ok': True, 'result': {'message_id': args['message_id']}}
    return {'ok': False, 'error': {'code': 'UNKNOWN_OPERATION'}}
