# Live voice in managed chat

The approved behavior is a fluid voice conversation that continues while Codex executes work. Clear execution requests are submitted immediately. Ambiguous requests are clarified before submission. Existing chat access modes and approval controls apply to every delegated request.

## Implementation

1. Add local-only voice session endpoints with DTO, service, repository contract and a Codex App Server adapter. Use the installed executable and its authentication. Negotiate WebRTC through the experimental thread realtime protocol.
2. Add WebRTC microphone/audio lifecycle and voice controls to managed chat. Bind delegation to the selected agent and conversation, use stable idempotency identities, and report queued work separately from completed results. Continue audio while requests run.
3. Verify microphone cleanup, duplicate tool events, context changes, failures, local execution boundaries and existing chat behavior. Run frontend checks and Cargo build/tests. Real audio validation requires a compatible authenticated Codex installation and microphone access.

## Configuration and storage

The user specified the installed Codex as the provider for voice as well as execution. Codex authentication uses its existing local installation configuration. Raw audio is streamed to the voice provider. Executed requests and their results use the existing managed chat persistence.

## Native transport

The browser creates a WebRTC audio offer. The local backend creates a Bee Team-owned coordinator thread through Codex App Server and negotiates its realtime connection. Voice delegation reaches a narrowly configured dynamic tool that forwards requests through the existing managed chat API. The coordinator uses a read-only sandbox, an isolated working directory and disabled native execution tools. Unexpected tool and approval requests fail closed.

The local voice API creates a session from an SDP offer, returns the session identifier and SDP answer, exposes cursor-based events, accepts tool acknowledgements and execution context updates, and supports explicit session closure. The backend owns the child process and expires abandoned sessions. Browser stop and unmount release media resources even if session creation is still pending.

The caller distinguishes queued work, approval requests, completed results, failure and unknown submission outcomes. Duplicate provider calls retain their identity and do not create new managed requests. Changing the selected chat ends the voice session. Creating the first managed conversation during a voice call keeps that call attached to the newly created conversation.

## Verification limits

The installed Codex CLI exposes experimental realtime start/stop and WebRTC negotiation. Its clientManagedHandoffs flag controls response forwarding and does not establish control over incoming execution delegation. Integration must verify delegation ownership and preserve managed request persistence and approval controls before claiming completion.

## Verified integration

A headless Edge browser connected to the actual local voice HTTP endpoint using Codex bundled with the desktop app and its ChatGPT authentication. Synthesized speech produced an `execute_codex` event. The test acknowledged that event as an isolated verification without submitting a managed task. Event polling, context acknowledgement and session closure returned HTTP 200. The test used a generated audio track and did not capture the user's microphone.

Frontend checks passed for 66 tests, production build and translations. Backend checks passed for the new voice protocol fixtures and library tests. Follow-up verification ran the full Cargo suite successfully against an isolated PostgreSQL 18.4 instance. The four generated-file failures were fixed by JSON-escaping Windows paths in the test provider fixture, with an additional cross-platform regression test.

Completed user and assistant voice transcripts are persisted in the managed conversation history without creating execution requests. Voice provenance remains stored internally without a visible badge. Reloading restores the saved transcript.

## Voice preferences and full-panel scrolling

General settings stores a device-local voice preference for the next call. The local backend discovers the installed Codex V3 catalog; the default option omits the voice field. Explicit choices are validated before conversation creation. An active call retains its original choice.

The scroll rail spans the full chat panel at the right edge, while its viewport contains only message history. Header and composer remain fixed. Voice activation scrolls the history to the bottom once; the transparent avatar remains overlaid with internal bottom padding.

Browser validation covered 736px and 320px widths, rail geometry, thumb dragging, wheel scrolling, fixed composer/header geometry and voice activation. General settings retained the selected voice after reload. An isolated real call with Juniper connected, saved both transcript roles without duplicate rows, and queued no execution. The default voice also connected. Marin was returned by the native catalog but timed out during WebRTC connection on three attempts; this remains a native-call validation limitation, not evidence that every listed voice works.
