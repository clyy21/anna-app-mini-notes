import "./styles.css";
import { connectAnnaRuntime } from "./annaRuntime.js";
import { loadNotesFromStorage, saveNotesToStorage } from "./notesStorage.js";
import { invokeSummaryTool } from "./notesTool.js";
import {
  elements,
  renderNotes,
  setError,
  setInputHint,
  setRuntimeStatus,
  updateActions
} from "./ui.js";

const state = {
  anna: null,
  notes: [],
  summary: "",
  loading: false,
  error: "",
  runtimeReady: false,
  storageReady: false
};

function setLoading(isLoading) {
  state.loading = isLoading;
  updateActions(state);
}

function refreshNotes() {
  renderNotes(state.notes, deleteNote);
  updateActions(state);
}

async function summarizeWithAnnaTool() {
  if (state.notes.length === 0) {
    setError("Please save at least one note before summarizing.");
    return;
  }

  if (!state.runtimeReady || !state.anna || !state.anna.tools) {
    setError("Anna runtime is unavailable. Start the app with anna-app dev to summarize notes.");
    setRuntimeStatus("Runtime unavailable", "is-warning");
    updateActions(state);
    return;
  }

  state.error = "";
  setError("");
  setLoading(true);

  try {
    state.summary = await invokeSummaryTool(state.anna, state.notes);
    elements.summaryOutput.textContent = state.summary;
  } catch (error) {
    state.error = error.message || "Failed to summarize notes.";
    setError(state.error);
    console.warn("[Mini Notes] Failed to invoke summary tool:", error);
  } finally {
    setLoading(false);
  }
}

async function addNote(content) {
  const note = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    order: state.notes.length + 1,
    content,
    createdAt: new Date().toISOString()
  };

  const previousNotes = [...state.notes];
  state.notes = [...state.notes, note];
  state.summary = "";
  refreshNotes();

  try {
    await saveNotesToStorage(state.anna, state.notes);
    elements.summaryOutput.textContent = "Click Summarize to generate a short note summary.";
  } catch (error) {
    state.notes = previousNotes;
    state.error = "Could not save the note to Anna storage.";
    setError(state.error);
    refreshNotes();
    console.warn("[Mini Notes] Failed to save note:", error);
  }
}

async function deleteNote(noteId) {
  const previousNotes = [...state.notes];
  // Keep display order compact after a note is removed.
  state.notes = state.notes
    .filter((note) => note.id !== noteId)
    .map((note, index) => ({
      ...note,
      order: index + 1
    }));
  state.summary = "";
  refreshNotes();

  try {
    await saveNotesToStorage(state.anna, state.notes);
    elements.summaryOutput.textContent =
      state.notes.length > 0
        ? "Click Summarize to generate a short note summary."
        : "Save a note, then summarize it with the local Executa tool.";
  } catch (error) {
    state.notes = previousNotes;
    state.error = "Could not delete the note from Anna storage.";
    setError(state.error);
    refreshNotes();
    console.warn("[Mini Notes] Failed to delete note:", error);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const content = elements.noteInput.value.trim();
  if (!content) {
    setError("Please enter a note before saving.");
    elements.noteInput.focus();
    return;
  }

  if (!state.storageReady || !state.anna || !state.anna.storage) {
    setError("Anna storage is unavailable. Start the app with anna-app dev to save notes.");
    return;
  }

  state.error = "";
  setError("");
  await addNote(content);
  elements.noteInput.value = "";
  setInputHint();
  elements.noteInput.focus();
}

async function initRuntime() {
  setRuntimeStatus("Connecting...");
  const result = await connectAnnaRuntime();
  state.anna = result.anna;
  state.runtimeReady = result.runtimeReady;
  setRuntimeStatus(result.status, result.statusClass);

  if (result.error) {
    state.error = "Anna runtime could not be connected.";
    setError(state.error);
    console.warn("[Mini Notes] Failed to connect Anna runtime:", result.error);
  } else {
    await initStorage();
  }

  updateActions(state);
}

async function initStorage() {
  if (!state.anna || !state.anna.storage) {
    state.storageReady = false;
    state.error = "Anna storage is unavailable.";
    setError(state.error);
    return;
  }

  try {
    state.notes = await loadNotesFromStorage(state.anna);
    state.storageReady = true;
    refreshNotes();
  } catch (error) {
    state.notes = [];
    state.storageReady = false;
    state.error = "Could not load notes from Anna storage.";
    setError(state.error);
    console.warn("[Mini Notes] Failed to load notes:", error);
  }
}

function initApp() {
  setInputHint();
  elements.noteInput.addEventListener("input", setInputHint);
  elements.noteForm.addEventListener("submit", handleSubmit);
  elements.summarizeButton.addEventListener("click", summarizeWithAnnaTool);
  refreshNotes();

  if (state.error) {
    setError(state.error);
  }

  void initRuntime();
}

initApp();
