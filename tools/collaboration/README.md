# Local Collaboration Room

A loopback inbox, task backlog and animation review surface over an **existing AMP mailbox**. It does not create another message queue or alter AMP's schema. Python 3.9+ and the existing `amp_core.py` installation are required; the UI has no build or external dependencies.

```sh
python3 tools/collaboration/service.py start
python3 tools/collaboration/service.py status
# Open http://127.0.0.1:4488 on this computer.
python3 tools/collaboration/service.py stop
```

The service runs detached and survives the launching shell closing. It does not register a login service or survive reboot automatically; run `start` again after reboot. Stop waits for an in-flight worker rather than interrupting it. Configure a different `--data`, `--port` or `--amp-home` consistently across server and adapters. Runtime records live under ignored `data/collaboration/`; back up that folder **and the AMP mailbox** together. Never commit either folder, private art, chat history, tokens, conversation URLs or local participant details.

## What delivery means

AMP is the source of message truth. `COLLAB/1` envelopes add `sender_session`, `recipient_session`, `task`, `kind`, revision and attachment references. They use AMP wire type `note` to avoid the legacy daemon's generic task responder. This adapter never sends as AMP principal `joshua`. The visible human composer acts through the local coordinator identity and records `actor=human` in its envelope.

`queued` means AMP accepted the message. `delivered` means the bound recipient MCP adapter read it. `acknowledged` requires that exact configured recipient to explicitly ack, or a worker to finish its reply. Failure includes its error and attempt count. A desktop registration or CLI receipt never proves an existing desktop conversation received anything. A configured MCP session binding identifies the adapter process; it cannot cryptographically attest which browser conversation invoked it. Verify a new owning conversation with a nonce and its actual reply, independently from worker tests.

**Desktop wake is not implemented.** Desktop conversations need a model/user turn to call tools. There is no transcript injection, UI autopilot or promise that a mailbox message starts a desktop turn. Remote/mobile services cannot reach this loopback server directly. They require a separately authorized authenticated remote adapter; do not expose this service to the internet.

Local CLI workers are separate opt-in participants. Enable only a proven participant in local `participants.json`, with driver `claude` or `codex`, then start with workers enabled (the service command does this). Claude uses safe mode with no tools or persistent session; Codex uses ephemeral mode and a read-only sandbox. No model or reasoning preference is overridden. A task can specify `reviewer_session` for exactly one automatic review handoff. Results do not trigger further model turns. Model calls have 180-second timeouts, three bounded attempts with backoff, and hourly/task caps. Completed model outputs are cached before posting so an AMP transport retry reuses the same reply. A restart during dispatch is marked `waiting_user`; it is not silently rerun. A terminal failure needs a consciously revised/new request rather than an infinite retry loop. Worker tests validate transport only; workers are explicitly instructed not to claim visual review or execute attachments.

## Persistent tasks

The task form supports creation and updates with owner, domain, status, source provenance, dependency IDs, questions and artifacts. Every change appends an immutable, idempotent event and increments the task version. New items must be classified as `user_decision`, `tentative`, `recommendation` or `observation`; existing items, provenance and questions are preserved. Resolve a question by adding its exact text to `resolved_questions`, retaining its history. `done` is an explicit status update, not inferred from a model reply.

Authorized session-addressed assignments/questions/revisions become backlog evidence. Structured `task_update` events are ingested through AMP with a persisted cursor, or participants can call `collab_task`. Arbitrary attachment text is never interpreted as a task or executable command. Natural-language discussion requires its authorized participant to record actionable decisions in a structured update; the service does not claim to understand every unobserved chat.

Example participant event (all sample names are generic):

```json
{
  "task_id": "motion-proof",
  "event_key": "motion-proof-steering-2",
  "domain": "Animation",
  "owner": "claude-desktop",
  "status": "in_progress",
  "items": [{"classification": "user_decision", "text": "Validate one facing before expanding the set."}],
  "open_questions": ["What is the intended loop timing?"],
  "dependencies": ["original-import"],
  "provenance": [{"type": "conversation", "message_id": "replace-with-actual-evidence"}]
}
```

Participant capability records track independent read, write, artifact and wake tests. `enabled` or an installed MCP server is not a passed capability. Keep unsupported/unverified resources visible and record the actual evidence and time for a passed test.

## Artifacts and review

Files are copied unchanged into a SHA-256-addressed store; original files are never replaced. The upload includes optional expected SHA-256; downloads recheck bytes and length. A file is limited to 64 MiB, 32 attachments per message, and the local store to 1 GiB. There is no silent eviction. Retention is until the operator explicitly archives the store. Artifact links work only on this machine while this service and its original store are available. They are not public or phone-accessible links.

PNG, JPEG, WebP, GIF, sprite sheets, SVG, ZIP, CSV/JSON manifests, code/text, audio and video can be transported. SVG/HTML/code/ZIP always download as opaque attachments to avoid active content execution. Archives are never automatically extracted. Raster images and supported browser media can be inspected; other formats/sizes show explicit preview limits while preserving download access. Native MCP image preview is limited to 8 MiB and text preview to 64 KiB. Transporting a file is not authorization to execute it.

Animation reviews are immutable manifests (see `manifest.schema.json`). Supply explicit PNG/JPEG/WebP frames, each with `duration_ms`; sheet frames can use `crop: [x,y,width,height]`. GIF/video are attachments, not silently decoded into a supposedly verified frame sequence. The review supports play/pause, scrub/step, character/action/facing selection, real CSS-pixel display scale, first/previous/onion comparison and a ground baseline. Terrain grid is only a contrast aid. Mirrored tracks require explicit `mirror_safe: true`; lettering requires separate original art when mirroring would reverse it. Each annotation retains review, revision, track and frame. Its durable notification outbox posts to the review's optional `owner_session` through AMP.

`import_review.py` accepts a **local untracked** import spec with selected source directories/globs. It copies frames into the store without publishing art. Timing and approval/provenance are supplied by the caller; imports never manufacture art approval.

## MCP adapter

Register `mcp.py` in each supported client with a distinct configured session. The service must already run. Example config values must be replaced locally:

```json
{
  "command": "/usr/bin/python3",
  "args": [
    "/absolute/path/to/checkout/tools/collaboration/mcp.py",
    "--data", "/absolute/path/to/checkout/data/collaboration",
    "--session", "claude-desktop",
    "--root", "/absolute/path/to/authorized/art"
  ]
}
```

Tools: `collab_inbox`, `collab_send`, `collab_ack`, `collab_attach`, `collab_artifact`, `collab_review`, `collab_feedback`, `collab_claim`, `collab_task`. Only configured roots can be read for new attachments. The local service key stays in a mode-0600 file, outside Git. The browser uses a SameSite HttpOnly cookie, host checks and same-origin mutation checks. This is a trusted-user, single-machine service, not a multitenant authorization boundary. Anyone with its service key can act as configured participants. The owner must not share that key or assume session labels provide independent identity authentication.

## Checks

```sh
node --test tests/collaboration.test.mjs
python3 -m unittest discover -s tools/collaboration/tests -v
# Optional: real AMP code, but every test database is temporary, never the live mailbox.
COLLAB_TEST_REAL_AMP=/absolute/path/to/amp python3 -m unittest discover -s tools/collaboration/tests -v
```

The existing `npm test` path includes the collaboration contracts. Tests cover binary roundtrip/integrity, duplicate/conflicting sends, exact-session acks, desktop/worker separation, bounded retries/restart uncertainty, one-hop handoff, frame timing, immutable reviews/feedback, overlapping ownership, persistent task steering and attachment non-execution. A live endpoint proof is still required for each provider/client; a test double is not a connected participant.

Keep this local tool outside the game's shipped import graph. Bulk art/video is intentionally absent from Git. Before proposing large assets, agree on an approved private artifact store or Git LFS policy; this repository has no pre-existing LFS rule for these assets.
