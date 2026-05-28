# Mini Notes App MVP Implementation Plan

> Goal: finish a minimal, runnable Anna-style Mini Notes App within 2 hours. Prioritize acceptance criteria over completeness.

## 1. Recommended Tech Stack

- Frontend: plain HTML + CSS + vanilla JavaScript
- Tool/backend: Node.js stdio Executa
- Storage: frontend memory + `localStorage`
- Package manager: npm or pnpm

Reasoning:

- Avoid React/Vite/build complexity unless needed.
- Static bundle is enough for the Anna local harness.
- Node.js makes JSON-RPC over stdio easy and portable.
- No database is required by the prompt.

## 2. Module Split And File Structure

```text
anna/
├─ question.md
├─ implementation-plan.md
├─ manifest.json
├─ package.json
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

Responsibilities:

- `manifest.json`: Anna App declaration, UI bundle, permissions, required executas.
- `bundle/index.html`: Mini Notes App markup.
- `bundle/app.js`: state, localStorage, rendering, Anna runtime connection, `tools.invoke`.
- `bundle/style.css`: minimal readable UI.
- `executas/notes-summary/executa.json`: local Executa metadata and launch command.
- `executas/notes-summary/index.js`: JSON-RPC over stdio tool with `describe` and `invoke`.
- `README.md`: install, run, manual JSON-RPC tests, and architecture explanation.

## 3. Minimal MVP

User flow:

1. Start Anna local harness.
2. Open Mini Notes App.
3. Enter a note.
4. Click Save.
5. See the note in the list with order.
6. Click Summarize.
7. Frontend calls local Executa through `anna.tools.invoke`.
8. Tool returns a rule-based summary.
9. UI displays the summary.
10. RPC log shows the tool invocation.

Minimal UI:

- Title: Mini Notes
- Text input or textarea
- Save button
- Notes list
- Summarize button
- Summary output area
- Basic error/loading state

## 4. Core Data And State Design

Frontend state:

```js
const state = {
  notes: [
    {
      id: "timestamp-or-random",
      order: 1,
      content: "修复登录 bug",
      createdAt: "2026-05-27T..."
    }
  ],
  summary: "",
  loading: false,
  error: ""
};
```

`localStorage` key:

```text
mini-notes-app.notes
```

Tool input:

```js
{
  notes: [
    {
      order: 1,
      content: "修复登录 bug",
      createdAt: "..."
    }
  ]
}
```

Tool output:

```js
{
  summary: "当前共有 3 条待处理事项，主要集中在开发、协作和内容准备。"
}
```

## 5. API And Interaction Design

### Frontend To Anna Runtime

Use Anna runtime only. Do not create a custom business HTTP API.

```js
const anna = await AnnaAppRuntime.connect();

const result = await anna.tools.invoke({
  tool_id: "notes-summary",
  method: "summarize",
  args: {
    notes: state.notes
  }
});
```

The same tool id must be used in:

- `manifest.json`
- `executas/notes-summary/executa.json`
- `bundle/app.js`

Preferred id:

```text
notes-summary
```

### Executa JSON-RPC

Support `describe`:

```json
{"jsonrpc":"2.0","id":1,"method":"describe","params":{}}
```

Return:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "name": "notes-summary",
    "description": "Summarize mini notes using simple rules.",
    "tools": [
      {
        "name": "summarize",
        "description": "Summarize a list of notes.",
        "input_schema": {
          "type": "object",
          "properties": {
            "notes": {
              "type": "array"
            }
          }
        }
      }
    ]
  }
}
```

Support `invoke`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "invoke",
  "params": {
    "tool": "summarize",
    "arguments": {
      "notes": [
        {"order": 1, "content": "修登录 bug"},
        {"order": 2, "content": "跟设计沟通需求"}
      ]
    }
  }
}
```

Return:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "summary": "当前共有 2 条待处理事项，主要集中在开发和协作。"
  }
}
```

Summary rules:

- 0 notes: `当前没有待处理笔记。`
- 1 note: `当前共有 1 条笔记：xxx。`
- Multiple notes: `当前共有 N 条待处理事项，主要集中在 A、B、C。`

Keyword categories:

- Development: `bug`, `修复`, `登录`, `代码`, `开发`, `接口`
- Collaboration: `客户`, `沟通`, `follow up`, `设计`, `会议`
- Content preparation: `workshop`, `提纲`, `内容`, `文档`, `准备`
- Other: fallback

## 6. Must-Have Vs Nice-To-Have

Must-have:

- `manifest.json`
- `bundle/index.html`
- `bundle/app.js`
- `bundle/style.css`
- `executas/notes-summary/executa.json`
- `executas/notes-summary/index.js`
- `README.md`
- Save and render notes
- Summarize through `anna.tools.invoke`
- JSON-RPC `describe`
- JSON-RPC `invoke`
- Manual JSON-RPC test instructions

Nice-to-have:

- `localStorage` persistence
- Delete button
- Timestamp
- Loading and error states
- Empty state
- Clear architecture explanation in README
- Record validation result in README after testing
- Simple but readable UI

Do not build:

- Database
- Login
- Real LLM integration
- Cloud deployment
- Complex frontend framework
- Complex state management
- Custom backend HTTP business API

## 7. Acceptance Focus And Risks

Acceptance focus:

1. `anna-app validate --strict` passes.
2. `anna-app dev` starts.
3. User can save a note.
4. Note list shows order and content.
5. Clicking Summarize calls `anna.tools.invoke`.
6. RPC log shows the invocation.
7. Executa `describe` and `invoke` work.
8. README lets reviewers run the project quickly.

Risks and mitigations:

- Manifest schema mismatch: reference `anna-app-focus-flow`; run validation early.
- Tool id mismatch: keep `notes-summary` consistent everywhere.
- JSON-RPC stdout pollution: output only JSON-RPC responses to stdout; logs go to stderr.
- Runtime unavailable in normal browser: show a clear message, but main path must use Anna runtime.
- Windows manual stdin testing friction: provide PowerShell-friendly test commands.
- Anna runtime invoke shape uncertainty: implement according to `anna-app-focus-flow`, then verify through RPC log immediately.
- Late validation risk: run `anna-app validate --strict` once right after minimal `manifest.json` and `executa.json`, then run it again near the end.

## 7.1 Plan Review Notes

Alignment with prompt:

- The plan satisfies the required Mini Notes App flow: input note, save, list notes, summarize, and show summary.
- The plan keeps the Anna local harness requirement: UI uses `AnnaAppRuntime.connect()` and calls `anna.tools.invoke`.
- The plan satisfies the local Executa requirement: local process, stdin/stdout, JSON-RPC, `describe`, and `invoke`.
- The plan includes required deliverables: source code, frontend UI, local tool, `manifest.json`, and `README.md`.
- The plan avoids explicitly disallowed work: cloud deployment, real Anna account, database, complex UI, and real LLM.

Adjustments after review:

- `package.json` is useful for scripts but is not required by the prompt; keep it minimal.
- `localStorage` is acceptable because it is not a database and helps local MVP testing, but the app should still work if storage is empty.
- `delete` and timestamp remain optional; implement only if core flow is already working.
- `anna-app validate --strict` should be run earlier than originally planned to catch schema issues quickly.
- The exact `manifest.json`, `executa.json`, and `anna.tools.invoke` field names must be verified against the Anna example and CLI validation rather than guessed.

## 8. Two-Hour Development Order

### 0-10 minutes: confirm structure and schema

- Read `question.md`.
- Reference Anna docs and `anna-app-focus-flow`.
- Create directory structure.
- Write minimal `manifest.json`.
- Write `executa.json`.

### 10-35 minutes: implement Executa tool

- Node script reads stdin line by line.
- Implement JSON-RPC response helper.
- Implement `describe`.
- Implement `invoke`.
- Implement `summarizeNotes(notes)`.
- Manually test `describe` and `invoke`.

### 35-65 minutes: implement frontend UI

- Write `index.html`.
- Write `style.css`.
- Write `app.js`.
- Implement notes state.
- Implement save, render, and localStorage.
- Implement Summarize button and loading state.

### 65-85 minutes: connect Anna runtime

- Call `AnnaAppRuntime.connect()`.
- Call `anna.tools.invoke`.
- Confirm argument shape.
- Display errors.
- Show runtime unavailable state in ordinary browsers.

### 85-105 minutes: validate harness

- Run `anna-app validate --strict`.
- Fix manifest/executa schema issues.
- Run `anna-app dev`.
- Add a note.
- Click Summarize.
- Check RPC log.

### 105-115 minutes: write README

README must include:

- Install dependencies.
- Start local harness.
- Run `anna-app validate --strict`.
- Run `anna-app dev`.
- Manual JSON-RPC `describe` test.
- Manual JSON-RPC `invoke` test.
- Explain `bundle` / `manifest` / `executas` relationship.

### 115-120 minutes: final check

- Remove unrelated files.
- Keep `question.md`.
- Confirm no custom business API bypasses Anna runtime.
- Confirm README commands are copyable.
- Run final validation if time allows.

## Working TODO

- [x] Create directory structure
- [x] Write `manifest.json`
- [x] Write `executas/notes-summary/executa.json`
- [x] Run early `anna-app validate --strict` after minimal manifest/executa files
  - Passed with `@anna-ai/cli` v0.1.17.
- [x] Implement Node JSON-RPC tool
- [x] Manually test `describe`
- [x] Manually test `invoke`
  - Verified edge cases: empty notes, missing notes, single note, unknown tool, unknown method, invalid JSON, and multiple JSON-RPC lines in one stdin stream.
- [x] Implement static UI
- [x] Implement notes save and list rendering
- [x] Implement `AnnaAppRuntime.connect`
- [x] Implement `anna.tools.invoke` summarize
  - Uses `{ tool_id: "notes-summary", method: "summarize", args: { notes } }`.
- [x] Write `README.md`
- [x] Run `anna-app validate --strict`
- [x] Run `anna-app dev`
  - Verified manually by user: page opens, runtime connects, notes save/list works, `tools.invoke` appears in RPC log, and summary succeeds after fixing the Executa success/data envelope.
- [x] Final acceptance check
