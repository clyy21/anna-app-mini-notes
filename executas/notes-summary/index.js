const readline = require("node:readline");

const TOOL_ID = "notes-summary";

const categories = [
  {
    label: "Development",
    keywords: ["bug", "修复", "登录", "代码", "开发", "接口", "issue", "fix", "login"]
  },
  {
    label: "Collaboration",
    keywords: ["客户", "沟通", "follow up", "设计", "会议", "同步", "讨论", "meet", "meeting", "customer"]
  },
  {
    label: "Content Prep",
    keywords: ["workshop", "提纲", "内容", "文档", "准备", "材料", "prep", "outline", "draft"]
  },
  {
    label: "Personal",
    keywords: ["water", "plant", "plants", "dinner", "lunch", "meal", "买", "吃饭", "浇水", "植物"]
  }
];

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function resultResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function errorResponse(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) {
    error.data = data;
  }

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error
  };
}

function describe() {
  return {
    id: TOOL_ID,
    name: "Mini Notes Summary",
    version: "1.0.0",
    description: "Summarize Mini Notes using simple local rules.",
    tools: [
      {
        name: "summarize",
        description: "Return a short rule-based summary for the current notes.",
        input_schema: {
          type: "object",
          properties: {
            notes: {
              type: "array",
              description: "Notes to summarize.",
              items: {
                type: "object",
                properties: {
                  order: { type: "number" },
                  content: { type: "string" },
                  createdAt: { type: "string" }
                },
                required: ["content"]
              }
            }
          },
          required: ["notes"]
        }
      }
    ]
  };
}

function normalizeNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) {
    return [];
  }

  return rawNotes
    .map((note, index) => {
      if (typeof note === "string") {
        return {
          order: index + 1,
          content: note.trim()
        };
      }

      if (!note || typeof note !== "object") {
        return null;
      }

      const content = typeof note.content === "string" ? note.content.trim() : "";
      if (!content) {
        return null;
      }

      return {
        order: Number.isFinite(note.order) ? note.order : index + 1,
        content,
        createdAt: typeof note.createdAt === "string" ? note.createdAt : undefined
      };
    })
    .filter(Boolean);
}

function categorizeNotes(notes) {
  const counts = new Map();

  notes.forEach((note) => {
    const text = note.content.toLowerCase();
    const matchedLabels = categories
      .filter((category) => category.keywords.some((keyword) => text.includes(keyword.toLowerCase())))
      .map((category) => category.label);

    const labels = matchedLabels.length > 0 ? matchedLabels : ["General"];
    labels.forEach((label) => {
      counts.set(label, (counts.get(label) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));
}

function formatCategoryBreakdown(categoryBreakdown) {
  const formatted = categoryBreakdown.map((category) => {
    const itemLabel = category.count === 1 ? "item" : "items";
    return `${category.count} ${category.label.toLowerCase()} ${itemLabel}`;
  });

  if (formatted.length === 1) {
    return formatted[0];
  }

  if (formatted.length === 2) {
    return `${formatted[0]} and ${formatted[1]}`;
  }

  return `${formatted.slice(0, -1).join(", ")}, and ${formatted[formatted.length - 1]}`;
}

function summarizeNotes(rawNotes) {
  const notes = normalizeNotes(rawNotes);

  if (notes.length === 0) {
    return "There are no notes to summarize yet.";
  }

  const categoryBreakdown = categorizeNotes(notes);
  const categoriesText = formatCategoryBreakdown(categoryBreakdown);

  if (notes.length === 1) {
    return `There is 1 note: "${notes[0].content}". The notes cover ${categoriesText}.`;
  }

  return `There are ${notes.length} notes. The notes mainly focus on ${categoriesText}.`;
}

function invoke(params = {}) {
  const toolName = params.tool || params.method || "summarize";
  const args = params.arguments || params.args || {};

  if (toolName !== "summarize") {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // The Anna dispatcher expects plugin results to use this success/data envelope.
  return {
    success: true,
    data: {
      tool: TOOL_ID,
      summary: summarizeNotes(args.notes)
    }
  };
}

function handleRequest(request) {
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return errorResponse(request && request.id, -32600, "Invalid Request");
  }

  try {
    if (request.method === "describe") {
      return resultResponse(request.id, describe());
    }

    if (request.method === "invoke") {
      return resultResponse(request.id, invoke(request.params));
    }

    if (request.method === "health") {
      return resultResponse(request.id, { ok: true });
    }

    return errorResponse(request.id, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    console.error(`[${TOOL_ID}] ${error.stack || error.message}`);
    return errorResponse(request.id, -32000, error.message);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  try {
    const request = JSON.parse(trimmed);
    writeResponse(handleRequest(request));
  } catch (error) {
    console.error(`[${TOOL_ID}] Invalid JSON: ${error.message}`);
    writeResponse(errorResponse(null, -32700, "Parse error"));
  }
});
