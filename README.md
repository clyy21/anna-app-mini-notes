# Mini Notes Anna App

Minimal Anna-style notes app. Users can save local notes and summarize them by calling a local Executa tool through `AnnaAppRuntime.connect()` and `anna.tools.invoke`.

## Install Dependencies

Install Node.js 18+ and the Anna CLI:

```powershell
npm i -g @anna-ai/cli
```

This project has no extra npm dependencies.

Optional environment check:

```powershell
anna-app doctor
```

`anna-app doctor` is useful for debugging local setup, but the core MVP checks are `validate`, `dev`, UI save/list behavior, and Executa JSON-RPC.

## Validate


```cmd
anna-app validate --strict
```

Expected:

```text
✓ validate passed
```

## Start Local Harness


```cmd
anna-app dev --no-llm
```

Then open:

```text
http://localhost:5180/
```

Expected:

- Runtime status shows `Runtime connected`
- Saving a note adds it to the list with an order number
- Clicking `Summarize` shows `tools.invoke` in the RPC log
- Summary appears in the UI

## Manual JSON-RPC Tests

Go to the Executa directory:


```cmd
cd executas\notes-summary
```

### describe

PowerShell:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"describe","params":{}}' | node index.js
```

cmd:

```cmd
echo {"jsonrpc":"2.0","id":1,"method":"describe","params":{}} | node index.js
```
Expected shape:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "notes-summary",
    "name": "Mini Notes Summary",
    "tools": [
      {
        "name": "summarize"
      }
    ]
  }
}
```

### invoke

PowerShell:

```powershell
'{"jsonrpc":"2.0","id":2,"method":"invoke","params":{"tool":"summarize","arguments":{"notes":[{"order":1,"content":"fix login bug"},{"order":2,"content":"follow up customer"},{"order":3,"content":"prepare workshop outline"}]}}}' | node index.js
```

cmd:

```cmd
echo {"jsonrpc":"2.0","id":2,"method":"invoke","params":{"tool":"summarize","arguments":{"notes":[{"order":1,"content":"fix login bug"},{"order":2,"content":"follow up customer"},{"order":3,"content":"prepare workshop outline"}]}}} | node index.js
```

Expected invoke response shape:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "success": true,
    "data": {
      "tool": "notes-summary",
      "summary": "..."
    }
  }
}
```

## Project Structure

```text
.
├─ manifest.json
├─ README.md
├─ bundle/
│  ├─ index.html
│  ├─ app.js
│  └─ style.css
└─ executas/
   └─ notes-summary/
      ├─ executa.json
      └─ index.js
```

## How It Works

`manifest.json`

Declares the Anna App. It points the harness to the UI bundle, requests `tools.invoke`, and declares the required local Executa tool `notes-summary`.

`bundle/`

Contains the frontend UI. `index.html` loads the Anna runtime SDK:

```html
<script src="/static/anna-apps/_sdk/0.1.0/index.js" defer></script>
```

Then `bundle/app.js` calls:

```js
const anna = await AnnaAppRuntime.connect();
```

On `Summarize`, the UI calls:

```js
anna.tools.invoke({
  tool_id: "notes-summary",
  method: "summarize",
  args: { notes }
});
```

`executas/`

Contains the local Executa tool. `executa.json` declares a Node stdio tool, and `index.js` implements JSON-RPC `describe`, `invoke`, and `health`. The tool generates a rule-based summary. It does not call a real LLM and does not use a database.

## Notes

- Notes are stored in browser `localStorage`.
- Logs from the Executa tool should go to stderr only.
- JSON-RPC responses are written to stdout, one JSON object per line.
- No cloud deployment, real Anna account, database, or external API is required.
