# TreefyIt MCP / Skill Integration

This document describes the intended MCP or Skill integration for TreefyIt.

The goal is simple: users install one Skill or MCP server, then their agent can build and inspect document knowledge bases with a tiny set of tools. The agent should not need to know PDF parsing, Markdown chunking, tree construction, storage, or retrieval internals.

TreefyIt is not primarily a "chat with documents" product. It is an AI infrastructure layer for agents that need to reference documents while doing work. The retrieval model should be explainable and human-readable: the agent navigates a document tree the way a human reads a table of contents, opens sections, and checks evidence.

## Product Goal

TreefyIt should feel like an explainable document memory backend for agents.

The core design principles are:

```text
Agent-first: tools are optimized for agents that need document context during work.
Human-readable: the same structure should be understandable by humans for debugging and trust.
Explainable: retrieval should show which node, section, and source file was used.
Tree-first: overview -> children -> inspect is the primary path.
Vector search, if added later, is a supplement rather than the main interface.
```

User experience:

```text
1. User installs TreefyIt Skill or TreefyIt MCP.
2. User gives the agent a file or asks it to use an existing knowledge tree.
3. Agent calls build_knowledge(file) if needed.
4. Agent calls overview_forest() or search_trees(query) when it needs to choose a knowledge base.
5. Agent calls overview(tree_id), inspect(tree_id, node_id), and children(tree_id, node_id) to retrieve only relevant parts.
6. Agent answers with grounded, inspectable context from the document tree.
```

The agent should have near-zero integration burden.

## Installation Shape

There are two acceptable integration forms.

### Option A: Skill

Users install a TreefyIt Skill into their agent environment.

The Skill wraps TreefyIt Build Service and exposes a small tool surface:

```text
build_knowledge(file)
overview_forest()
search_trees(query)
overview(tree_id)
inspect(tree_id, node_id)
children(tree_id, node_id)
```

The Skill may also include prompt instructions:

```text
When answering questions about uploaded documents, build or select a TreefyIt knowledge tree first.
Use overview before inspect.
Use children to navigate large branches.
Only inspect full node text when needed.
```

### Option B: MCP Server

Users add a TreefyIt MCP server to their agent runtime.

Example local config shape:

```json
{
  "mcpServers": {
    "treefyit": {
      "command": "treefyit-mcp",
      "args": ["--base-url", "http://localhost:8765"]
    }
  }
}
```

Cloud config shape:

```json
{
  "mcpServers": {
    "treefyit": {
      "command": "treefyit-mcp",
      "args": [
        "--base-url",
        "https://api.treefyit.example.com",
        "--api-key",
        "${TREEFYIT_API_KEY}"
      ]
    }
  }
}
```

## Minimal Tool Surface

The first production version should expose as few tools as possible.

### build_knowledge

Builds a document knowledge tree from a user-provided file.

Tool name:

```text
build_knowledge
```

Input:

```json
{
  "file": {
    "path": "/absolute/path/to/paper.pdf"
  },
  "summarize": true
}
```

Input fields:

```text
file.path: required if the runtime passes local files by path
file.name: optional display filename
summarize: optional, boolean
```

Output:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "filename": "paper.pdf",
  "node_count": 42,
  "max_depth": 4,
  "has_original_file": true
}
```

Implementation:

```text
POST /api/build
```

Notes:

- The returned `tree_id` is the Build Service `build.id`.
- The MCP server should upload the file as multipart form data.
- The agent should store `tree_id` in conversation memory.

### overview_forest

Returns the forest-level summary of all available knowledge bases.

Tool name:

```text
overview_forest
```

Input:

```json
{}
```

Implementation:

```text
GET /api/forest
```

### search_trees

Searches the whole forest and returns the most relevant knowledge bases.

Tool name:

```text
search_trees
```

Input:

```json
{
  "query": "transformer inference optimization",
  "limit": 5
}
```

Implementation:

```text
GET /api/forest/search/trees?q=<query>&limit=<limit>
```

### overview

Returns the root-level structure of a knowledge tree.

Tool name:

```text
overview
```

Input:

```json
{
  "tree_id": "1902897a3b4c0d1e"
}
```

Output:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_count": 42,
  "max_depth": 4,
  "roots": [
    {
      "node_id": "0",
      "title": "Introduction",
      "summary": "...",
      "children_count": 3
    }
  ]
}
```

Implementation:

```text
GET /api/trees/{tree_id}
```

Mapping:

```text
API path -> MCP node_id
```

The MCP surface should call this `node_id` because it is easier for agents to understand than `path`.

### inspect

Returns full content for one node.

Tool name:

```text
inspect
```

Input:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_id": "0.1"
}
```

Output:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_id": "0.1",
  "title": "Method",
  "text": "Full node text...",
  "summary": "Short summary...",
  "children_count": 2,
  "children": ["0.1.0", "0.1.1"]
}
```

Implementation:

```text
GET /api/trees/{tree_id}/nodes/{node_id}
```

Usage guidance:

- Use `inspect` only when the agent needs full text.
- Prefer `overview` and `children` first for broad navigation.
- Inspect a small number of relevant nodes instead of reading the entire tree.

### children

Returns child node metadata without loading full text for every child.

Tool name:

```text
children
```

Input:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_id": "0.1"
}
```

Output:

```json
{
  "tree_id": "1902897a3b4c0d1e",
  "node_id": "0.1",
  "title": "Method",
  "children_count": 2,
  "children": [
    {
      "node_id": "0.1.0",
      "title": "Data",
      "summary": "...",
      "children_count": 0
    }
  ]
}
```

Implementation:

```text
GET /api/trees/{tree_id}/children/{node_id}
```

## Optional Tools

These are useful but should not be required for the first integration.

### list_knowledge

Lists available trees.

Implementation:

```text
GET /api/trees
```

### get_original_file

Returns or links the persisted original file.

Implementation:

```text
GET /api/build/{tree_id}/file
```

### ask_knowledge

Runs the server-side chat agent against a tree.

Implementation:

```text
POST /api/chat
```

This is optional because many agent runtimes prefer to use their own reasoning loop and only call retrieval tools.

## Agent Prompt Contract

Recommended tool instructions:

```text
TreefyIt exposes document knowledge trees.

Use build_knowledge(file) when the user provides a new document.
Use overview(tree_id) before inspecting specific nodes.
Use children(tree_id, node_id) to navigate deeper branches.
Use inspect(tree_id, node_id) only for nodes likely to contain answer evidence.
Do not inspect every node unless the user asks for exhaustive analysis.
When citing evidence, include the node_id and title.
```

## Error Handling

Tool errors should be normalized for agents.

Unknown tree:

```json
{
  "error": "unknown_tree",
  "message": "Tree not found. Call list_knowledge or build_knowledge first."
}
```

Invalid node:

```json
{
  "error": "invalid_node",
  "message": "Node id is invalid for this tree."
}
```

Build failed:

```json
{
  "error": "build_failed",
  "message": "The document could not be parsed."
}
```

## Local vs Cloud

The MCP or Skill should hide deployment details from the agent.

Local:

```text
TreefyIt Build Service runs at http://localhost:8765
```

Cloud:

```text
TreefyIt Build Service runs at a hosted base URL with API key auth.
```

The tool surface should stay the same in both modes.

## Non-Goals

- Do not expose raw database tables.
- Do not expose internal parser steps as tools.
- Do not require agents to parse Markdown/PDF/HTML themselves.
- Do not force agents to read full `raw_text` before using the tree.
- Do not expose internal design documents through the public MCP docs.
