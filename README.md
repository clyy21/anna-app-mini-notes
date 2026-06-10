# Mini Notes with LLM Summary

Mini Notes is a local Anna App that creates, stores, deletes, and summarizes notes through the Anna local development model.

The app uses:

- Vite + vanilla JavaScript for the frontend bundle.
- Anna App Runtime Host API for storage and tool invocation.
- A Go Executa Tool over JSON-RPC stdio.
- Reverse JSON-RPC `sampling/createMessage` for LLM summary generation.
- GitHub Actions to build three platform-specific Executa release assets.

## Project Structure

```text
.
|-- manifest.json
|-- package.json
|-- README-v2.md
|-- index.html
|-- src/
|   |-- main.js
|   |-- annaRuntime.js
|   |-- notesStorage.js
|   |-- notesTool.js
|   |-- ui.js
|   `-- styles.css
|-- bundle/
|   |-- index.html
|   `-- assets/
|-- executas/
|   `-- notes-summary/
|       |-- executa.json
|       |-- go.mod
|       |-- cmd/
|       |   `-- notes-summary/
|       |       `-- main.go
|       |-- fixtures/
|       |   `-- mock-sampling.jsonl
|       `-- scripts/
|           `-- build-local.ps1
|-- scripts/
|   `-- test-executa-jsonrpc.mjs
`-- .github/
    `-- workflows/
        `-- release-executa.yml
```

## Install Dependencies

Install Node.js, Go 1.22+, and the Anna CLI:

```cmd
npm install
npm i -g @anna-ai/cli
```

Check local Anna CLI setup if needed:

```cmd
anna-app doctor
```

Local testing does not require `anna-app login` or a real Anna account.

## Build Frontend Bundle

Build the Anna-loadable static bundle:

```cmd
npm run build
```

This writes:

```text
bundle/index.html
bundle/assets/*.js
bundle/assets/*.css
```

`manifest.json` points Anna to `bundle/index.html` through `ui.bundle.entry`.

## Validate Manifest

Run:

```cmd
anna-app validate --strict
```

Expected:

```text
validate passed
```

## Run UI Harness

Start the local Anna harness:

```cmd
anna-app dev --no-llm
```

Open:

```text
http://localhost:5180/
```

Expected UI behavior:

- Runtime badge shows `Runtime connected`.
- Creating a note updates the list.
- Deleting a note updates the list.
- Saving and deleting notes call Anna storage, not browser `localStorage`.
- Clicking `Summarize` calls `anna.tools.invoke`.

The local harness uses legacy in-memory runtime state. It is enough to verify `storage.get` and `storage.set` calls; notes are not required to survive dashboard refreshes or `anna-app dev` restarts.

## Expected `--no-llm` Summarize Error

The UI harness should be run with:

```cmd
anna-app dev --no-llm
```

In this mode, Anna disables LLM/sampling. Therefore, clicking `Summarize` is expected to eventually return an error like:

```text
[-32603] harness started with --no-llm
```

or an equivalent LLM/sampling disabled error.

Some local Anna CLI versions may surface the disabled sampling path as a harness-side error such as:

```text
sampling failed: handler crashed: HostRpcError.__init__() takes 3 positional arguments but 4 were given
```

Treat this as the same UI harness category if the RPC log shows `tools.invoke` was sent and the failure happens after the Executa attempts sampling.

That error is expected for the UI harness path. It means:

- The frontend can still call `anna.tools.invoke`.
- The Go Executa can still attempt `sampling/createMessage`.
- The local harness refuses sampling because `--no-llm` disables it.

Use the separate mock sampling test below to verify the successful summary path.

## Test Executa Sampling with Mock Fixture

The backend Executa sampling path can be tested independently with a mock sampling fixture:

```cmd
anna-app executa dev --dir executas\notes-summary --mock-sampling executas\notes-summary\fixtures\mock-sampling.jsonl --invoke summarize --args "{\"notes\":[{\"order\":1,\"content\":\"fix login bug\"},{\"order\":2,\"content\":\"follow up customer\"},{\"order\":3,\"content\":\"prepare workshop outline\"}]}" --json
```

Windows shell quoting for nested JSON can be fragile. The safer local check is:

```cmd
npm run package:executa
node scripts\test-executa-jsonrpc.mjs executas\notes-summary\dist\notes-summary-windows-x86_64\bin\notes-summary.exe
```

Expected evidence:

```text
Observed reverse RPC: sampling/createMessage
```

Expected invoke result includes:

```json
{
  "success": true,
  "data": {
    "tool": "notes-summary",
    "summary": "Manual mock summary from sampling/createMessage."
  }
}
```

## Manual Executa JSON-RPC Tests

The Executa speaks JSON-RPC 2.0 over stdio. The easiest manual test is:

```cmd
node scripts\test-executa-jsonrpc.mjs executas\notes-summary\dist\notes-summary-windows-x86_64\bin\notes-summary.exe
```

The script covers:

- `initialize`
- `describe`
- `invoke`
- reverse `sampling/createMessage`

The script prints the unwrapped JSON-RPC `result` values for readability. For example, the script prints:

```text
initialize: {"capabilities":{"sampling":{}},"client_capabilities":{"sampling":{}},"protocolVersion":"2.0","server_info":{"name":"notes-summary","version":"1.0.0"}}
```

Raw manual JSON-RPC responses include the outer `jsonrpc`, `id`, and `result` envelope.

Manual request examples:

### initialize

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

Expected shape:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2.0",
    "server_info": {
      "name": "notes-summary"
    },
    "capabilities": {
      "sampling": {}
    },
    "client_capabilities": {
      "sampling": {}
    }
  }
}
```

### describe

```json
{"jsonrpc":"2.0","id":2,"method":"describe","params":{}}
```

Expected shape:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "name": "notes-summary",
    "display_name": "Mini Notes Summary",
    "host_capabilities": ["llm.sample"],
    "tools": [
      {
        "name": "summarize",
        "parameters": [
          {
            "name": "notes",
            "type": "array",
            "required": true
          }
        ]
      }
    ]
  }
}
```

### invoke

```json
{"jsonrpc":"2.0","id":3,"method":"invoke","params":{"tool":"summarize","arguments":{"notes":[{"order":1,"content":"fix login bug"}]}}}
```

Expected behavior:

1. Executa writes a reverse JSON-RPC request with `method: "sampling/createMessage"`.
2. Host or mock test replies with sampled text.
3. Executa returns a `success: true` result containing `data.summary`.

## Confirm Notes Use Anna Storage

Source code:

- `src/notesStorage.js` calls:

```js
anna.storage.get({ key: NOTES_STORAGE_KEY });
anna.storage.set({ key: NOTES_STORAGE_KEY, value: notes });
```

Runtime confirmation:

1. Start `anna-app dev --no-llm`.
2. Open `http://localhost:5180/`.
3. Create a note.
4. Check the Anna dev dashboard RPC log.

Expected log entries:

```text
storage.get
storage.set
```

There should be no frontend `localStorage` persistence path.

## Confirm Summary Path

Source code path:

```text
src/notesTool.js
-> anna.tools.invoke({ tool_id: "notes-summary", method: "summarize", args })
-> executas/notes-summary/cmd/notes-summary/main.go
-> sampling/createMessage
```

UI harness confirmation:

1. Start `anna-app dev --no-llm`.
2. Save at least one note.
3. Click `Summarize`.
4. Check RPC log for:

```text
tools.invoke
```

Backend sampling confirmation:

```cmd
node scripts\test-executa-jsonrpc.mjs executas\notes-summary\dist\notes-summary-windows-x86_64\bin\notes-summary.exe
```

Expected:

```text
Observed reverse RPC: sampling/createMessage
```

Together, these prove:

```text
anna.tools.invoke -> Executa -> sampling/createMessage
```

## Build Local Executa Binary Archive

Build the current platform archive:

```cmd
npm run package:executa
```

On Windows, this creates:

```text
executas/notes-summary/dist/notes-summary-1.0.0-windows-x86_64.zip
```

The archive root contains:

```text
manifest.json
bin/notes-summary.exe
```

The build script also supports explicit platform keys:

```powershell
powershell -ExecutionPolicy Bypass -File executas\notes-summary\scripts\build-local.ps1 -PlatformKey windows-x86_64
powershell -ExecutionPolicy Bypass -File executas\notes-summary\scripts\build-local.ps1 -PlatformKey darwin-arm64
powershell -ExecutionPolicy Bypass -File executas\notes-summary\scripts\build-local.ps1 -PlatformKey darwin-x86_64
```

Windows outputs `.zip`; macOS outputs `.tar.gz`.

## GitHub Actions Release Workflow

Workflow file:

```text
.github/workflows/release-executa.yml
```

Triggers:

- Manual `workflow_dispatch`
- Git tag push matching `v*`

Tag example:

```cmd
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds and smoke-tests:

```text
darwin-arm64
darwin-x86_64
windows-x86_64
```

Expected GitHub Release assets:

```text
notes-summary-1.0.0-darwin-arm64.tar.gz
notes-summary-1.0.0-darwin-x86_64.tar.gz
notes-summary-1.0.0-windows-x86_64.zip
```

Each platform job runs the JSON-RPC smoke test against the built binary before upload.

## Concepts

`manifest.json`

Declares the Anna App: required Executa, UI bundle entry, permissions, and allowed Host APIs. This app declares `tools.invoke`, `storage.read`, `storage.write`, and `llm.complete`. The `llm.complete` scope is needed by the Anna harness so the Executa sampling request can be served; the frontend source still does not call `anna.llm.*` directly. The app UI calls `anna.tools.invoke`, and the Go Executa sends `sampling/createMessage`.

`bundle/`

The built static frontend loaded by Anna. It is generated by `npm run build` from `src/` and `index.html`.

`executas/`

Contains local Executa Tools. This project has one Go Executa: `notes-summary`.

Anna storage / APS KV

Anna storage is the Host API key-value storage surface. Locally, `anna-app dev` uses an in-memory runtime state. In a real Anna platform environment, the same `anna.storage.get/set` API can map to Anna platform APS/KV storage.

Sampling

Sampling is how an Executa asks the Anna host for LLM output. The Executa sends reverse JSON-RPC `sampling/createMessage`; the host or mock fixture returns text.

Binary archive

A release package for an Executa binary. It contains a `manifest.json` and a platform executable under `bin/`. GitHub Actions publishes one archive per supported platform.
