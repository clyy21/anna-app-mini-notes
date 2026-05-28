const elements = {
  errorMessage: document.querySelector("#errorMessage"),
  inputHint: document.querySelector("#inputHint"),
  noteCount: document.querySelector("#noteCount"),
  noteForm: document.querySelector("#noteForm"),
  noteInput: document.querySelector("#noteInput"),
  notesList: document.querySelector("#notesList"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  summarizeButton: document.querySelector("#summarizeButton"),
  summaryOutput: document.querySelector("#summaryOutput")
};

const STORAGE_KEY = "mini-notes-app.notes";
const SUMMARY_TOOL_ID = "notes-summary";

const state = {
  anna: null,
  notes: [],
  summary: "",
  loading: false,
  error: "",
  runtimeReady: false
};

function loadNotes() {
  try {
    const rawNotes = window.localStorage.getItem(STORAGE_KEY);
    const parsedNotes = rawNotes ? JSON.parse(rawNotes) : [];
    state.notes = Array.isArray(parsedNotes)
      ? parsedNotes
          .filter((note) => note && typeof note.content === "string" && note.content.trim())
          .map((note, index) => ({
            id: typeof note.id === "string" ? note.id : String(Date.now() + index),
            order: index + 1,
            content: note.content.trim(),
            createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString()
          }))
      : [];
  } catch (error) {
    state.notes = [];
    state.error = "Saved notes could not be loaded, so the app started fresh.";
    console.warn("[Mini Notes] Failed to load notes:", error);
  }
}

function saveNotes() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
  } catch (error) {
    setError("Notes were saved for this session, but localStorage is unavailable.");
    console.warn("[Mini Notes] Failed to save notes:", error);
  }
}

function setError(message) {
  state.error = message;
  elements.errorMessage.textContent = message;
}

function setRuntimeStatus(status, statusClass) {
  elements.runtimeStatus.textContent = status;
  elements.runtimeStatus.className = `runtime-status ${statusClass || ""}`.trim();
}

function setInputHint() {
  const length = elements.noteInput.value.length;
  elements.inputHint.textContent = `${length} / ${elements.noteInput.maxLength}`;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  updateActions();
}

function updateActions() {
  elements.summarizeButton.disabled = state.loading || state.notes.length === 0 || !state.runtimeReady;
  elements.noteForm.querySelector("button[type='submit']").disabled = state.loading;
  elements.summarizeButton.textContent = state.loading ? "Summarizing..." : "Summarize";
}

async function connectAnnaRuntime() {
  // The Anna harness injects AnnaAppRuntime into the UI bundle.
  if (!window.AnnaAppRuntime || typeof window.AnnaAppRuntime.connect !== "function") {
    state.runtimeReady = false;
    setRuntimeStatus("Runtime unavailable", "is-warning");
    updateActions();
    return;
  }

  try {
    setRuntimeStatus("Connecting...");
    state.anna = await window.AnnaAppRuntime.connect();
    state.runtimeReady = true;
    setRuntimeStatus("Runtime connected", "is-connected");
    updateActions();
  } catch (error) {
    state.anna = null;
    state.runtimeReady = false;
    setRuntimeStatus("Runtime failed", "is-danger");
    setError("Anna runtime could not be connected.");
    console.warn("[Mini Notes] Failed to connect Anna runtime:", error);
    updateActions();
  }
}

function buildSummarizeArgs() {
  // Keep the payload small and explicit for the local Executa tool.
  return {
    notes: state.notes.map((note) => ({
      order: note.order,
      content: note.content,
      createdAt: note.createdAt
    }))
  };
}

function readSummaryFromResult(result) {
  if (result && typeof result.summary === "string") {
    return result.summary;
  }

  if (result && result.result && typeof result.result.summary === "string") {
    return result.result.summary;
  }

  throw new Error("The summary tool returned an unexpected response.");
}

async function summarizeWithAnnaTool() {
  if (state.notes.length === 0) {
    setError("Please save at least one note before summarizing.");
    return;
  }

  if (!state.runtimeReady || !state.anna || !state.anna.tools) {
    setError("Anna runtime is unavailable. Start the app with anna-app dev to summarize notes.");
    setRuntimeStatus("Runtime unavailable", "is-warning");
    updateActions();
    return;
  }

  setError("");
  setLoading(true);

  try {
    // This shape follows the Anna app host API used by the local harness.
    const result = await state.anna.tools.invoke({
      tool_id: SUMMARY_TOOL_ID,
      method: "summarize",
      args: buildSummarizeArgs()
    });

    state.summary = readSummaryFromResult(result);
    elements.summaryOutput.textContent = state.summary;
  } catch (error) {
    setError(error.message || "Failed to summarize notes.");
    console.warn("[Mini Notes] Failed to invoke summary tool:", error);
  } finally {
    setLoading(false);
  }
}

function renderNotes() {
  elements.notesList.innerHTML = "";

  if (state.notes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No notes yet.";
    elements.notesList.append(emptyItem);
  } else {
    state.notes.forEach((note) => {
      const item = document.createElement("li");
      item.className = "note-item";

      const body = document.createElement("div");
      body.className = "note-body";

      const content = document.createElement("span");
      content.className = "note-content";
      content.textContent = note.content;

      const timestamp = document.createElement("time");
      timestamp.className = "note-time";
      timestamp.dateTime = note.createdAt || "";
      timestamp.textContent = formatTimestamp(note.createdAt);

      body.append(content, timestamp);

      const actions = document.createElement("div");
      actions.className = "note-actions";

      const meta = document.createElement("span");
      meta.className = "note-meta";
      meta.textContent = `#${note.order}`;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteNote(note.id));

      actions.append(meta, deleteButton);
      item.append(body, actions);
      elements.notesList.append(item);
    });
  }

  elements.noteCount.textContent = `${state.notes.length} ${state.notes.length === 1 ? "item" : "items"}`;
  updateActions();
}

function formatTimestamp(value) {
  if (!value) {
    return "No timestamp";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid timestamp";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function addNote(content) {
  const note = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    order: state.notes.length + 1,
    content,
    createdAt: new Date().toISOString()
  };

  state.notes.push(note);
  state.summary = "";
  saveNotes();
  renderNotes();
  elements.summaryOutput.textContent = "Click Summarize to generate a short note summary.";
}

function deleteNote(noteId) {
  // Keep display order compact after a note is removed.
  state.notes = state.notes
    .filter((note) => note.id !== noteId)
    .map((note, index) => ({
      ...note,
      order: index + 1
    }));
  state.summary = "";
  saveNotes();
  renderNotes();
  elements.summaryOutput.textContent =
    state.notes.length > 0
      ? "Click Summarize to generate a short note summary."
      : "Save a note, then summarize it with the local Executa tool.";
}

function handleSubmit(event) {
  event.preventDefault();

  const content = elements.noteInput.value.trim();
  if (!content) {
    setError("Please enter a note before saving.");
    elements.noteInput.focus();
    return;
  }

  setError("");
  addNote(content);
  elements.noteInput.value = "";
  setInputHint();
  elements.noteInput.focus();
}

function initStaticUi() {
  loadNotes();
  setInputHint();
  elements.noteInput.addEventListener("input", setInputHint);
  elements.noteForm.addEventListener("submit", handleSubmit);
  elements.summarizeButton.addEventListener("click", summarizeWithAnnaTool);
  renderNotes();
  if (state.error) {
    setError(state.error);
  }
  connectAnnaRuntime();
}

initStaticUi();
