# LSP + WebSocket Architecture

This document describes the architecture for migrating the YAML Config Editor from REST-based completions to a Language Server Protocol (LSP) implementation over WebSocket using **pygls**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Monaco Editor                                │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │              monaco-languageclient                          │    │   │
│  │  │   - Implements LSP client protocol                          │    │   │
│  │  │   - Translates Monaco ↔ LSP messages                        │    │   │
│  │  │                         │                                   │    │   │
│  │  │                         ▼                                   │    │   │
│  │  │  ┌─────────────────────────────────────────────────────┐    │    │   │
│  │  │  │              vscode-ws-jsonrpc                       │    │    │   │
│  │  │  │   - JSON-RPC message framing                         │    │    │   │
│  │  │  │   - WebSocket connection management                  │    │    │   │
│  │  │  └─────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                              │                   │
│                          │ HTTP                         │ WebSocket         │
│                          │ /api/py/config               │ /api/py/lsp       │
│                          ▼                              ▼                   │
└─────────────────────────────────────────────────────────────────────────────┘
                           │                              │
                           └──────────────┬───────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI + pygls)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FastAPI Application                          │   │
│  │                                                                      │   │
│  │  ┌────────────────────────┐   ┌───────────────────────────────────┐ │   │
│  │  │     REST Endpoints     │   │    YAML Language Server (pygls)   │ │   │
│  │  │                        │   │                                   │ │   │
│  │  │  GET  /api/py/config   │   │  WebSocket /api/py/lsp            │ │   │
│  │  │  POST /api/py/config   │   │                                   │ │   │
│  │  │                        │   │  - textDocument/completion        │ │   │
│  │  │  ┌──────────────────┐  │   │  - textDocument/didChange         │ │   │
│  │  │  │  Pydantic Models │◄─┼───┼──- textDocument/hover             │ │   │
│  │  │  │  (shared)        │  │   │  - textDocument/publishDiagnostics│ │   │
│  │  │  └──────────────────┘  │   │                                   │ │   │
│  │  └────────────────────────┘   └───────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                      File System                             │    │   │
│  │  │                    .data/config.yaml                         │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Component  | Library               | Purpose                                |
| ---------- | --------------------- | -------------------------------------- |
| Editor     | Monaco Editor         | VS Code's editor component             |
| LSP Client | monaco-languageclient | LSP protocol implementation for Monaco |
| WebSocket  | vscode-ws-jsonrpc     | JSON-RPC over WebSocket transport      |

### Backend

| Component  | Library     | Purpose                                           |
| ---------- | ----------- | ------------------------------------------------- |
| Framework  | FastAPI     | Async Python web framework                        |
| LSP Server | pygls       | Python Language Server Protocol                   |
| Validation | Pydantic    | Schema validation (REST + LSP)                    |
| YAML AST   | ruamel.yaml | YAML parsing with line/column position info (.lc) |

---

## Implementation Overview

### LSP Server (pygls)

- Create a `LanguageServer` instance with pygls
- Register handlers for LSP features using `@server.feature()` decorators
- On `textDocument/completion`: analyze cursor position, return context-aware suggestions
- On `textDocument/didChange`: parse YAML, validate with Pydantic, publish diagnostics
- On `textDocument/hover`: return documentation for the key under cursor
- Expose via FastAPI WebSocket endpoint at `/api/py/lsp`

### YAML AST (ruamel.yaml)

The LSP requires mapping between **source positions** (line/column) and **schema paths** (e.g., `['server', 'port']`). This is impossible with simple string parsing — we need a YAML AST that preserves position information.

`ruamel.yaml` provides this via `CommentedMap` and `CommentedSeq` nodes with `.lc` (line/column) attributes:

```python
doc = yaml.load("server:\n  port: 8080")
doc.lc.key('server')        # → (0, 0)  line/col of 'server' key
doc['server'].lc.key('port') # → (1, 2)  line/col of 'port' key
doc['server'].lc.value('port') # → (1, 8)  line/col of '8080' value
```

### Autocompletion Flow

```
Cursor position ──► ruamel AST ──► Schema path ──► Pydantic schema ──► CompletionItems
     │                  │               │                │
     │                  │               │                └─ properties: {host, port, debug}
     │                  │               │
     │                  │               └─ ['server']
     │                  │
     │                  └─ walk tree using .lc to find containing node
     │
     └─ line 2, col 4
```

1. **Monaco** sends cursor position (line 2, col 4)
2. **ruamel AST** → walk tree, find cursor is inside `server:` block → path = `['server']`
3. **Pydantic schema** → look up `['server']` → get valid properties: `{host, port, debug}`
4. **Return** `CompletionItem` for each property

```python
path = get_yaml_path_at_position(doc, line=2)  # → ['server']
schema = ConfigModel.model_json_schema()
props = schema['properties']['server']['properties']  # → {host, port, debug}
# Return completions for host, port, debug
```

### Validation Flow (ruamel + Pydantic)

ruamel.yaml and Pydantic don't integrate directly — they're used in **sequence**:

```
YAML string ──► ruamel.yaml ──► Python dict ──► Pydantic ──► Errors with path
                    │                              │
                    │                              └─ ('server', 'port')
                    │
                    └─ AST with .lc positions
```

1. **ruamel.yaml** parses YAML → Python dict (but keeps the AST with positions)
2. **Pydantic** validates the dict → returns errors with **paths** like `('server', 'port')`
3. **Map back**: Use ruamel's AST to convert path → line number

```python
doc = yaml.load(source)                    # ruamel parses, keeps AST
ConfigModel.model_validate(doc)            # pydantic validates dict
# ValidationError: loc=('server', 'port'), msg='Input should be integer'

line, _ = doc['server'].lc.key('port')     # ruamel AST → line 5
# Now we can show the red squiggle on line 5
```

### Frontend LSP Client

- Connect to `ws://localhost:8000/api/py/lsp` via WebSocket
- Use `monaco-languageclient` to wrap the connection
- Configure document selector for YAML language
- Handle connection errors with auto-reconnect

---

## Features

| Feature              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| **Completions**      | Auto-suggest keys and enum values from Pydantic schema |
| **Validation**       | Red squiggles for type errors, missing required fields |
| **Hover**            | Show field descriptions from Pydantic model docstrings |
| **Type checking**    | Error if `port: "not a number"`                        |
| **Range validation** | Error if `port: 99999` (exceeds maximum)               |
| **Custom errors**    | Pydantic validation messages shown inline              |

---

## Code Examples

See [LSP-CODE-EXAMPLES.md](./LSP-CODE-EXAMPLES.md) for complete implementation code including:

- pygls server implementation
- FastAPI WebSocket integration
- Frontend LSP client setup
- LSP message flow diagrams
