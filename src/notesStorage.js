export const NOTES_STORAGE_KEY = "mini-notes-app.notes";

export function normalizeNotes(rawNotes) {
  const notes = Array.isArray(rawNotes) ? rawNotes : [];

  return notes
    .filter((note) => note && typeof note.content === "string" && note.content.trim())
    .map((note, index) => ({
      id: typeof note.id === "string" ? note.id : String(Date.now() + index),
      order: index + 1,
      content: note.content.trim(),
      createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString()
    }));
}

export async function loadNotesFromStorage(anna) {
  const response = await anna.storage.get({ key: NOTES_STORAGE_KEY });
  return normalizeNotes(readStorageValue(response));
}

export async function saveNotesToStorage(anna, notes) {
  await anna.storage.set({
    key: NOTES_STORAGE_KEY,
    value: normalizeNotes(notes)
  });
}

function readStorageValue(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && Array.isArray(response.value)) {
    return response.value;
  }

  if (response && response.value == null) {
    return [];
  }

  return [];
}
