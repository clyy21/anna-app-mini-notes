import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCommand = process.platform === "win32"
  ? resolve(rootDir, "executas", "notes-summary", "dist", "notes-summary-windows-x86_64", "notes-summary.exe")
  : resolve(rootDir, "executas", "notes-summary", "dist", "notes-summary-local", "notes-summary");

const command = process.argv[2] ? resolve(rootDir, process.argv[2]) : defaultCommand;
const child = spawn(command, [], {
  cwd: resolve(rootDir, "executas", "notes-summary"),
  stdio: ["pipe", "pipe", "pipe"]
});

let buffer = "";
const pending = new Map();

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      handleLine(line);
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params = {}) {
  const id = `${method}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
  });
  send({ jsonrpc: "2.0", id, method, params });
  return promise;
}

function handleLine(line) {
  const message = JSON.parse(line);

  if (message.method === "sampling/createMessage") {
    console.log("Observed reverse RPC:", message.method);
    const promptText = message.params?.messages?.[0]?.content?.text || "";
    const metadata = message.params?.metadata || {};
    if (!promptText.includes("fix login bug") || !promptText.includes("follow up customer")) {
      throw new Error("sampling prompt did not include the current notes");
    }
    if (metadata.invoke_id !== "manual-smoke-invoke") {
      throw new Error("sampling metadata did not include the expected invoke_id");
    }
    if (metadata.tool_id !== "notes-summary") {
      throw new Error("sampling metadata did not include notes-summary tool_id");
    }
    console.log("sampling metadata:", JSON.stringify(metadata));
    console.log("sampling prompt excerpt:", JSON.stringify(promptText.slice(0, 180)));
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        role: "assistant",
        content: {
          type: "text",
          text: "Manual mock summary from sampling/createMessage."
        },
        model: "manual-mock",
        stopReason: "endTurn"
      }
    });
    return;
  }

  if (pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      waiter.reject(new Error(message.error.message));
    } else {
      waiter.resolve(message.result);
    }
  }
}

async function main() {
  const initializeResult = await request("initialize");
  if (initializeResult?.server_info?.name !== "notes-summary") {
    throw new Error("initialize did not return notes-summary server_info");
  }
  console.log("initialize:", JSON.stringify(initializeResult));

  const describeResult = await request("describe");
  if (describeResult?.name !== "notes-summary") {
    throw new Error("describe did not return notes-summary");
  }
  for (const field of ["display_name", "version", "description", "runtime"]) {
    if (!describeResult[field]) {
      throw new Error(`describe did not include ${field}`);
    }
  }
  if (!describeResult.host_capabilities?.includes("llm.sample")) {
    throw new Error("describe did not include host_capabilities llm.sample");
  }

  const toolNames = describeResult.tools?.map((tool) => tool.name) || [];
  if (!toolNames.includes("summarize")) {
    throw new Error("describe did not include summarize tool");
  }
  const summarizeTool = describeResult.tools.find((tool) => tool.name === "summarize");
  if (!Array.isArray(summarizeTool.parameters)) {
    throw new Error("summarize tool did not use Anna parameters[] schema");
  }
  if (summarizeTool.input_schema) {
    throw new Error("summarize tool should not use MCP input_schema");
  }
  if (!summarizeTool.parameters.some((parameter) => parameter.name === "notes" && parameter.required === true)) {
    throw new Error("summarize parameters[] did not include required notes parameter");
  }

  console.log("describe:", JSON.stringify({
    name: describeResult.name,
    display_name: describeResult.display_name,
    version: describeResult.version,
    host_capabilities: describeResult.host_capabilities,
    tools: toolNames,
    summarize_parameters: summarizeTool.parameters
  }));

  const healthResult = await request("health");
  if (healthResult?.status !== "ok") {
    throw new Error("health did not return ok");
  }
  console.log("health:", JSON.stringify(healthResult));

  const invokeResult = await request("invoke", {
    tool: "summarize",
    invoke_id: "manual-smoke-invoke",
    arguments: {
      notes: [
        { order: 1, content: "fix login bug" },
        { order: 2, content: "follow up customer" },
        { order: 3, content: "prepare workshop outline" }
      ]
    }
  });
  if (invokeResult?.data?.tool !== "notes-summary") {
    throw new Error("invoke did not return notes-summary tool identity");
  }
  console.log("invoke:", JSON.stringify(invokeResult));

  const shutdownResult = await request("shutdown");
  if (shutdownResult?.ok !== true) {
    throw new Error("shutdown did not return ok");
  }
  console.log("shutdown:", JSON.stringify(shutdownResult));
}

main().catch((error) => {
  console.error(error);
  child.kill();
  process.exitCode = 1;
});
