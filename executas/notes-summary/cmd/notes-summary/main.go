package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	toolID          = "notes-summary"
	toolVersion     = "1.0.0"
	toolDisplayName = "Mini Notes Summary"
)

type envelope struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type invokeParams struct {
	Tool      string          `json:"tool"`
	Method    string          `json:"method"`
	Arguments invokeArguments `json:"arguments"`
	Args      invokeArguments `json:"args"`
	InvokeID  string          `json:"invoke_id"`
	ID        string          `json:"id"`
}

type invokeArguments struct {
	Notes []rawNote `json:"notes"`
}

type rawNote struct {
	Order     float64 `json:"order"`
	Content   string  `json:"content"`
	CreatedAt string  `json:"createdAt"`
}

type note struct {
	Order     int    `json:"order"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type pendingRequest struct {
	resolve chan envelope
}

var (
	writeMu sync.Mutex
	pending = struct {
		sync.Mutex
		items map[string]pendingRequest
	}{items: map[string]pendingRequest{}}
)

var manifest = map[string]any{
	"name":              toolID,
	"display_name":      toolDisplayName,
	"version":           toolVersion,
	"description":       "Summarize Mini Notes through Anna host sampling.",
	"host_capabilities": []string{"llm.sample"},
	"runtime": map[string]any{
		"type":    "binary",
		"command": []string{"notes-summary"},
	},
	"tools": []any{
		map[string]any{
			"name":        "summarize",
			"description": "Summarize the current notes via host sampling.",
			"parameters": []any{
				map[string]any{
					"name":        "notes",
					"type":        "array",
					"description": "Notes to summarize. Each note should include content and order.",
					"required":    true,
				},
			},
		},
	},
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1024), 1024*1024*16)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var env envelope
		if err := json.Unmarshal([]byte(line), &env); err != nil {
			fmt.Fprintf(os.Stderr, "[%s] invalid json: %v\n", toolID, err)
			write(errorEnvelope(nil, -32700, "Parse error"))
			continue
		}

		if handleReverseResponse(env) {
			continue
		}

		go func(request envelope) {
			write(dispatch(request))
		}(env)
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "[%s] stdin error: %v\n", toolID, err)
	}
	closePending(errors.New("stdin closed before reverse RPC response"))
}

func dispatch(env envelope) envelope {
	if env.JSONRPC != "2.0" || env.Method == "" {
		return errorEnvelope(env.ID, -32600, "Invalid Request")
	}

	var result any
	var err error

	switch env.Method {
	case "initialize":
		result = map[string]any{
			"protocolVersion": "2.0",
			"server_info": map[string]any{
				"name":    toolID,
				"version": toolVersion,
			},
			"capabilities": map[string]any{
				"sampling": map[string]any{},
			},
			"client_capabilities": map[string]any{
				"sampling": map[string]any{},
			},
		}
	case "describe":
		result = manifest
	case "health":
		result = map[string]any{"status": "ok"}
	case "shutdown":
		go func() {
			time.Sleep(20 * time.Millisecond)
			os.Exit(0)
		}()
		result = map[string]any{"ok": true}
	case "invoke":
		result, err = invoke(env)
	default:
		return errorEnvelope(env.ID, -32601, "Method not found: "+env.Method)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "[%s] %v\n", toolID, err)
		return errorEnvelope(env.ID, -32000, err.Error())
	}

	return resultEnvelope(env.ID, result)
}

func invoke(env envelope) (map[string]any, error) {
	var params invokeParams
	if len(env.Params) > 0 {
		if err := json.Unmarshal(env.Params, &params); err != nil {
			return nil, err
		}
	}

	toolName := params.Tool
	if toolName == "" {
		toolName = params.Method
	}
	if toolName == "" {
		toolName = "summarize"
	}
	if toolName != "summarize" {
		return nil, fmt.Errorf("unknown tool: %s", toolName)
	}

	args := params.Arguments
	if len(args.Notes) == 0 {
		args = params.Args
	}

	notes := normalizeNotes(args.Notes)
	if len(notes) == 0 {
		return map[string]any{"success": false, "error": "notes are required"}, nil
	}

	invokeID := params.InvokeID
	if invokeID == "" {
		invokeID = params.ID
	}
	if invokeID == "" {
		invokeID = rawIDAsString(env.ID)
	}
	if invokeID == "" {
		invokeID = newID()
	}

	sample, err := requestSampling(buildSummaryPrompt(notes), invokeID)
	if err != nil {
		return map[string]any{"success": false, "error": "sampling failed: " + err.Error()}, nil
	}

	summary, err := readSamplingText(sample)
	if err != nil {
		return map[string]any{"success": false, "error": "sampling failed: " + err.Error()}, nil
	}

	return map[string]any{
		"success": true,
		"data": map[string]any{
			"tool":    toolID,
			"summary": summary,
		},
	}, nil
}

func normalizeNotes(raw []rawNote) []note {
	notes := []note{}
	for i, rawNote := range raw {
		content := strings.TrimSpace(rawNote.Content)
		if content == "" {
			continue
		}

		order := int(rawNote.Order)
		if order <= 0 {
			order = i + 1
		}

		notes = append(notes, note{
			Order:     order,
			Content:   content,
			CreatedAt: rawNote.CreatedAt,
		})
	}
	return notes
}

func buildSummaryPrompt(notes []note) string {
	lines := []string{
		"You are summarizing a short personal notes list for a Mini Notes app.",
		"Write a friendly, concise English summary for the user.",
		"Mention the number of notes, the key points, and any rough categories you can infer.",
		"Do not invent details that are not present in the notes.",
		"",
		"Notes:",
	}
	for _, note := range notes {
		lines = append(lines, fmt.Sprintf("%d. %s", note.Order, note.Content))
	}
	return strings.Join(lines, "\n")
}

func requestSampling(prompt string, invokeID string) (json.RawMessage, error) {
	id := newID()
	ch := make(chan envelope, 1)

	pending.Lock()
	pending.items[id] = pendingRequest{resolve: ch}
	pending.Unlock()

	write(envelope{
		JSONRPC: "2.0",
		ID:      mustRawString(id),
		Method:  "sampling/createMessage",
		Params: mustRaw(map[string]any{
			"messages": []any{
				map[string]any{
					"role": "user",
					"content": map[string]any{
						"type": "text",
						"text": prompt,
					},
				},
			},
			"maxTokens": 400,
			"metadata": map[string]any{
				"invoke_id": invokeID,
				"tool_id":   toolID,
			},
		}),
	})

	select {
	case env := <-ch:
		if env.Error != nil {
			return nil, errors.New(env.Error.Message)
		}
		return env.Result, nil
	case <-time.After(30 * time.Second):
		pending.Lock()
		delete(pending.items, id)
		pending.Unlock()
		return nil, errors.New("sampling request timed out")
	}
}

func readSamplingText(raw json.RawMessage) (string, error) {
	var asObject struct {
		Text    string `json:"text"`
		Content any    `json:"content"`
	}
	if err := json.Unmarshal(raw, &asObject); err != nil {
		return "", err
	}

	if asObject.Text != "" {
		return asObject.Text, nil
	}

	switch content := asObject.Content.(type) {
	case map[string]any:
		if content["type"] == "text" {
			if text, ok := content["text"].(string); ok && text != "" {
				return text, nil
			}
		}
	case []any:
		parts := []string{}
		for _, item := range content {
			part, ok := item.(map[string]any)
			if !ok || part["type"] != "text" {
				continue
			}
			text, ok := part["text"].(string)
			if ok && text != "" {
				parts = append(parts, text)
			}
		}
		if len(parts) > 0 {
			return strings.Join(parts, "\n"), nil
		}
	}

	return "", errors.New("sampling response did not include text content")
}

func handleReverseResponse(env envelope) bool {
	if env.Method != "" || len(env.ID) == 0 {
		return false
	}

	id := rawIDAsString(env.ID)
	if id == "" {
		return false
	}

	pending.Lock()
	item, ok := pending.items[id]
	if ok {
		delete(pending.items, id)
	}
	pending.Unlock()

	if !ok {
		return false
	}

	item.resolve <- env
	return true
}

func closePending(err error) {
	pending.Lock()
	items := pending.items
	pending.items = map[string]pendingRequest{}
	pending.Unlock()

	for _, item := range items {
		item.resolve <- envelope{
			Error: &rpcError{Code: -32000, Message: err.Error()},
		}
	}
}

func write(env envelope) {
	writeMu.Lock()
	defer writeMu.Unlock()

	payload, err := json.Marshal(env)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[%s] failed to marshal response: %v\n", toolID, err)
		return
	}
	fmt.Fprintln(os.Stdout, string(payload))
}

func resultEnvelope(id json.RawMessage, result any) envelope {
	return envelope{
		JSONRPC: "2.0",
		ID:      id,
		Result:  mustRaw(result),
	}
}

func errorEnvelope(id json.RawMessage, code int, message string) envelope {
	return envelope{
		JSONRPC: "2.0",
		ID:      idOrNull(id),
		Error:   &rpcError{Code: code, Message: message},
	}
}

func idOrNull(id json.RawMessage) json.RawMessage {
	if len(id) == 0 {
		return json.RawMessage("null")
	}
	return id
}

func mustRaw(value any) json.RawMessage {
	payload, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return payload
}

func mustRawString(value string) json.RawMessage {
	return mustRaw(value)
}

func rawIDAsString(raw json.RawMessage) string {
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return asString
	}

	var asNumber float64
	if err := json.Unmarshal(raw, &asNumber); err == nil {
		return fmt.Sprintf("%.0f", asNumber)
	}

	return ""
}

func newID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("sampling-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
