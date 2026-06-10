export const SUMMARY_TOOL_ID = "notes-summary";

export function buildSummarizeArgs(notes) {
  // Keep the payload small and explicit for the local Executa tool.
  return {
    notes: notes.map((note) => ({
      order: note.order,
      content: note.content,
      createdAt: note.createdAt
    }))
  };
}

export function readSummaryFromResult(result) {
  if (result && typeof result.summary === "string") {
    return result.summary;
  }

  if (result && result.data && typeof result.data.summary === "string") {
    return result.data.summary;
  }

  if (result && result.result && typeof result.result.summary === "string") {
    return result.result.summary;
  }

  throw new Error("The summary tool returned an unexpected response.");
}

export async function invokeSummaryTool(anna, notes) {
  const result = await anna.tools.invoke({
    tool_id: SUMMARY_TOOL_ID,
    method: "summarize",
    args: buildSummarizeArgs(notes)
  });

  return readSummaryFromResult(result);
}
