# Agent Readme

This document is for agents that need to use TreefyIt Build Service as a knowledge-base backend.

TreefyIt is not a generic document chat system. It is an explainable document context service for agents. Use it when you need to reference documents during work and want a human-readable retrieval path instead of opaque embedding-only RAG.

## Service

TreefyIt Build Service turns uploaded documents into structured knowledge trees and exposes those trees through stable HTTP tools.

Primary retrieval style:

```text
overview -> children -> inspect
```

This is intentional. Treat the tree like a document table of contents: understand the structure first, navigate to the relevant branch, then inspect full text only when needed.

Base URL:

```text
http://localhost:8765
```

All JSON APIs are under:

```text
/api
```

Important identity rule:

```text
build.id == tree_id
```

Use the build id returned by `POST /api/build` as the `tree_id` for all tree inspection endpoints.

## Recommended Flow

```text
1. Build a knowledge tree from a file.
2. Use the returned build id as tree_id.
3. Call overview to understand roots.
4. Call children to navigate large branches.
5. Call inspect only for nodes likely to contain useful evidence.
6. Use query logs only for debugging or audit.
```

## Build Knowledge Base

Endpoint:

```http
POST /api/build
Content-Type: multipart/form-data
```

Form fields:

```text
file: required, .md / .pdf / .html / .htm / .zip
model: optional, default deepseek/deepseek-chat
mode: optional, auto | md | semantic
summarize: optional, boolean, default true
```

Important response fields:

```json
{
  "id": "1902897a3b4c0d1e",
  "filename": "paper.pdf",
  "raw_text": "...",
  "tree": [],
  "stats": {
    "node_count": 42,
    "model": "deepseek/deepseek-chat",
    "mode": "auto"
  },
  "has_original_file": true,
  "original_file_url": "/api/build/1902897a3b4c0d1e/file"
}
```

## List Trees

Endpoint:

```http
GET /api/trees
```

Response:

```json
[
  {
    "tree_id": "1902897a3b4c0d1e",
    "node_count": 42,
    "max_depth": 4
  }
]
```

Use this to discover available trees.

## Overview Tree

Endpoint:

```http
GET /api/trees/{tree_id}
```

Response:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_count": 42,
  "max_depth": 4,
  "roots": [
    {
      "path": "0",
      "title": "Introduction",
      "summary": "...",
      "children_count": 3
    }
  ]
}
```

Use this first before inspecting nodes.

## Inspect Node

Endpoint:

```http
GET /api/trees/{tree_id}/nodes/{path}
```

Path examples:

```text
0
0.1
0.1.2
```

Response:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "path": "0.1",
  "title": "Method",
  "text": "Full node text...",
  "summary": "Short summary...",
  "children_count": 2,
  "children": ["0.1.0", "0.1.1"]
}
```

Use this when you need the full content of a specific node.

## Get Children

Endpoint:

```http
GET /api/trees/{tree_id}/children/{path}
```

Response:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "path": "0.1",
  "title": "Method",
  "children_count": 2,
  "children": [
    {
      "path": "0.1.0",
      "title": "Data",
      "summary": "...",
      "children_count": 0
    }
  ]
}
```

Use this to navigate without loading full text for every child.

## Query Logs

Endpoint:

```http
GET /api/queries
```

Returns recent tool calls. Use only for audit or replay.

Endpoint:

```http
GET /api/queries/stats
```

Returns aggregate query counts.

## Chat With Tree

Endpoint:

```http
POST /api/chat
Content-Type: application/json
```

Request:

```json
{
  "bid": "1902897a3b4c0d1e",
  "question": "What are the main findings?",
  "model": "deepseek-chat",
  "session_id": "optional-existing-session"
}
```

Response is streamed as NDJSON or SSE `data: {...}` events.

Important events:

```json
{"type": "start", "session_id": "s_abc123"}
{"type": "text", "text": "The document says..."}
{"type": "tool_call", "name": "node_content", "arguments": "{\"path\":\"0\"}"}
{"type": "tool_result", "name": "node_content", "ok": true, "content": "..."}
{"type": "done", "answer": "..."}
```

Remember `session_id` after the first response and pass it in follow-up questions for the same build.

## Error Handling

Common error shapes:

```json
{"error": "unknown tree_id: <id>"}
{"error": "invalid path: <path>"}
{"error": "not found"}
```

If a tree is unknown, call:

```http
GET /api/trees
```

Then choose an existing `tree_id`.
