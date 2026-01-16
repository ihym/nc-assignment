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

| Component  | Library     | Purpose                         |
| ---------- | ----------- | ------------------------------- |
| Framework  | FastAPI     | Async Python web framework      |
| LSP Server | pygls       | Python Language Server Protocol |
| Validation | Pydantic    | Schema validation (REST + LSP)  |
| YAML       | ruamel.yaml | YAML parsing with position info |

---

## Implementation Overview

### LSP Server (pygls)

- Create a `LanguageServer` instance with pygls
- Register handlers for LSP features using `@server.feature()` decorators
- On `textDocument/completion`: analyze cursor position, return context-aware suggestions
- On `textDocument/didChange`: parse YAML, validate with Pydantic, publish diagnostics
- On `textDocument/hover`: return documentation for the key under cursor
- Expose via FastAPI WebSocket endpoint at `/api/py/lsp`

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
