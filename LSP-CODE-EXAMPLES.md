# LSP Implementation Code Examples

High-level code structure for implementing LSP with pygls. See [ARCHITECTURE-LSP.md](./ARCHITECTURE-LSP.md) for concepts.

---

## Backend: pygls Language Server

### 1. LSP Server Setup (`api/lsp/server.py`)

```python
from pygls.server import LanguageServer
from pygls.lsp.server import LanguageServer
from lsprotocol import types as lsp

# Create server instance (singleton, handles multiple connections)
server = LanguageServer("yaml-config-server", "v1.0")

@server.feature(lsp.TEXT_DOCUMENT_DID_OPEN)
async def did_open(params: lsp.DidOpenTextDocumentParams):
    """Called when a document is opened."""
    await validate_document(params.text_document.uri)

@server.feature(lsp.TEXT_DOCUMENT_DID_CHANGE)
async def did_change(params: lsp.DidChangeTextDocumentParams):
    """Called on every keystroke."""
    await validate_document(params.text_document.uri)

@server.feature(lsp.TEXT_DOCUMENT_COMPLETION)
async def completions(params: lsp.CompletionParams) -> lsp.CompletionList:
    """Provide completions at cursor position."""
    doc = server.workspace.get_text_document(params.text_document.uri)
    position = params.position

    # Analyze YAML structure at position
    items = get_completions_for_position(doc.source, position)

    return lsp.CompletionList(is_incomplete=False, items=items)

@server.feature(lsp.TEXT_DOCUMENT_HOVER)
async def hover(params: lsp.HoverParams) -> lsp.Hover | None:
    """Show documentation on hover."""
    doc = server.workspace.get_text_document(params.text_document.uri)
    key = get_key_at_position(doc.source, params.position)

    if key and key in FIELD_DOCS:
        return lsp.Hover(contents=lsp.MarkupContent(
            kind=lsp.MarkupKind.Markdown,
            value=FIELD_DOCS[key]
        ))
    return None
```

### 2. Validation with Pydantic (`api/lsp/validation.py`)

```python
import yaml
from pydantic import ValidationError
from lsprotocol import types as lsp
from api.config import ConfigModel  # Reuse existing Pydantic model

async def validate_document(uri: str):
    """Parse YAML and validate against Pydantic model."""
    doc = server.workspace.get_text_document(uri)
    diagnostics: list[lsp.Diagnostic] = []

    try:
        # Parse YAML
        data = yaml.safe_load(doc.source)

        # Validate with Pydantic
        ConfigModel.model_validate(data)

    except yaml.YAMLError as e:
        # YAML syntax error
        diagnostics.append(lsp.Diagnostic(
            range=lsp.Range(
                start=lsp.Position(line=e.problem_mark.line, character=0),
                end=lsp.Position(line=e.problem_mark.line, character=100),
            ),
            message=str(e.problem),
            severity=lsp.DiagnosticSeverity.Error,
        ))

    except ValidationError as e:
        # Pydantic validation errors
        for error in e.errors():
            line = find_line_for_path(doc.source, error['loc'])
            diagnostics.append(lsp.Diagnostic(
                range=lsp.Range(
                    start=lsp.Position(line=line, character=0),
                    end=lsp.Position(line=line, character=100),
                ),
                message=error['msg'],
                severity=lsp.DiagnosticSeverity.Error,
            ))

    # Send diagnostics to client
    server.publish_diagnostics(uri, diagnostics)
```

### 3. Completions from Pydantic Schema (`api/lsp/completions.py`)

```python
from lsprotocol import types as lsp
from api.config import ConfigModel

def get_completions_for_position(source: str, position: lsp.Position) -> list[lsp.CompletionItem]:
    """Generate completions based on Pydantic model schema."""

    # Get the current path in YAML (e.g., ["server", ""])
    path = get_yaml_path_at_position(source, position)

    # Navigate Pydantic schema to find valid keys
    schema = ConfigModel.model_json_schema()
    valid_keys = get_keys_at_path(schema, path)

    return [
        lsp.CompletionItem(
            label=key,
            kind=lsp.CompletionItemKind.Property,
            detail=info.get('type', ''),
            documentation=info.get('description', ''),
            insert_text=f"{key}: ",
        )
        for key, info in valid_keys.items()
    ]
```

### 4. FastAPI WebSocket Integration (`api/index.py`)

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from api.lsp.server import server as lsp_server

app = FastAPI()

@app.websocket("/api/py/lsp")
async def lsp_endpoint(websocket: WebSocket):
    """WebSocket endpoint for LSP communication."""
    await websocket.accept()

    try:
        # pygls handles the LSP protocol over this WebSocket
        await lsp_server.serve_websocket(websocket)
    except WebSocketDisconnect:
        pass  # Client disconnected normally
```

---

## Frontend: Monaco + LSP Client

### 1. LSP Client Setup (`app/lib/lsp-client.ts`)

```typescript
import { MonacoLanguageClient } from 'monaco-languageclient';
import { initServices } from 'monaco-languageclient/vscode/services';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';

let client: MonacoLanguageClient | null = null;

export async function initLspClient() {
  // Initialize Monaco services (once, globally)
  await initServices({});

  // Connect to pygls server
  const ws = new WebSocket('ws://localhost:8000/api/py/lsp');

  ws.onopen = () => {
    const socket = toSocket(ws);

    client = new MonacoLanguageClient({
      name: 'YAML Config Client',
      clientOptions: {
        documentSelector: [{ language: 'yaml' }],
      },
      connectionProvider: {
        get: () =>
          Promise.resolve({
            reader: new WebSocketMessageReader(socket),
            writer: new WebSocketMessageWriter(socket),
          }),
      },
    });

    client.start();
  };

  ws.onclose = () => {
    // Auto-reconnect after delay
    setTimeout(initLspClient, 3000);
  };
}

export function disposeLspClient() {
  client?.stop();
  client = null;
}
```

### 2. Monaco Editor Component (`app/components/YamlEditor.tsx`)

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { initLspClient, disposeLspClient } from '@/lib/lsp-client';

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function YamlEditor({ value, onChange }: YamlEditorProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initLspClient();
    }

    return () => {
      disposeLspClient();
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    // Set document URI so LSP can track it
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelUri(model, monaco.Uri.parse('file:///config.yaml'));
    }
  };

  return (
    <Editor
      height="400px"
      defaultLanguage="yaml"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        lineNumbers: 'on',
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
      }}
    />
  );
}
```

---

## Message Flow

```
Monaco Editor                              pygls Server
     │                                         │
     │──── initialize ────────────────────────►│
     │◄─── capabilities ───────────────────────│
     │                                         │
     │──── textDocument/didOpen ──────────────►│
     │         (full document text)            │
     │◄─── textDocument/publishDiagnostics ────│
     │         (validation errors)             │
     │                                         │
     │  [user types]                           │
     │──── textDocument/didChange ────────────►│
     │◄─── textDocument/publishDiagnostics ────│
     │                                         │
     │  [user triggers autocomplete]           │
     │──── textDocument/completion ───────────►│
     │◄─── CompletionList ─────────────────────│
     │                                         │
     │  [user hovers over key]                 │
     │──── textDocument/hover ────────────────►│
     │◄─── Hover (markdown docs) ──────────────│
     │                                         │
```

---

## Dependencies

### Python (`pyproject.toml`)

```toml
[project]
dependencies = [
    "fastapi>=0.100.0",
    "pygls>=1.2.0",
    "lsprotocol>=2023.0.0",
    "pydantic>=2.0.0",
    "ruamel.yaml>=0.18.0",
    "uvicorn[standard]>=0.23.0",
]
```

### Node.js (`package.json`)

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "monaco-languageclient": "^8.0.0",
    "vscode-ws-jsonrpc": "^3.0.0"
  }
}
```
