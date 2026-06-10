export const elements = {
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

export function setError(message) {
  elements.errorMessage.textContent = message;
}

export function setRuntimeStatus(status, statusClass) {
  elements.runtimeStatus.textContent = status;
  elements.runtimeStatus.className = `runtime-status ${statusClass || ""}`.trim();
}

export function setInputHint() {
  const length = elements.noteInput.value.length;
  elements.inputHint.textContent = `${length} / ${elements.noteInput.maxLength}`;
}

export function updateActions(state) {
  elements.summarizeButton.disabled = state.loading || state.notes.length === 0 || !state.runtimeReady;
  elements.noteForm.querySelector("button[type='submit']").disabled = state.loading || !state.storageReady;
  elements.summarizeButton.textContent = state.loading ? "Summarizing..." : "Summarize";
}

export function renderNotes(notes, onDelete) {
  elements.notesList.innerHTML = "";

  if (notes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No notes yet.";
    elements.notesList.append(emptyItem);
  } else {
    notes.forEach((note) => {
      elements.notesList.append(createNoteItem(note, onDelete));
    });
  }

  elements.noteCount.textContent = `${notes.length} ${notes.length === 1 ? "item" : "items"}`;
}

function createNoteItem(note, onDelete) {
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
  deleteButton.addEventListener("click", () => onDelete(note.id));

  actions.append(meta, deleteButton);
  item.append(body, actions);

  return item;
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
