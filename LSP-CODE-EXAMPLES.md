# LSP Implementation Code Examples

High-level code structure for implementing LSP with pygls. See [ARCHITECTURE-LSP.md](./ARCHITECTURE-LSP.md) for concepts.

---

## Backend: pygls Language Server

### 1. LSP Server Setup (`api/lsp/server.py`)

```python
from pygls.server import LanguageServer
from lsprotocol import types as lsp

server = LanguageServer("yaml-config-server", "v1.0")

@server.feature(lsp.TEXT_DOCUMENT_DID_CHANGE)
async def did_change(params: lsp.DidChangeTextDocumentParams):
    await validate_document(params.text_document.uri)

@server.feature(lsp.TEXT_DOCUMENT_COMPLETION)
async def completions(params: lsp.CompletionParams) -> lsp.CompletionList:
    doc = server.workspace.get_text_document(params.text_document.uri)
    items = get_completions_for_position(doc.source, params.position)
    return lsp.CompletionList(is_incomplete=False, items=items)
```

### 2. Validation with Pydantic (`api/lsp/validation.py`)

ruamel.yaml and Pydantic work in sequence:

```python
from ruamel.yaml import YAML
from pydantic import ValidationError
from api.config import ConfigModel

yaml_parser = YAML()

async def validate_document(uri: str):
    text_doc = server.workspace.get_text_document(uri)
    diagnostics = []

    # 1. Parse with ruamel (keeps AST with positions)
    doc = yaml_parser.load(text_doc.source)

    try:
        # 2. Validate dict with Pydantic
        ConfigModel.model_validate(dict(doc))
    except ValidationError as e:
        for error in e.errors():
            # 3. Map error path → line number via ruamel AST
            #    error['loc'] = ('server', 'port')
            #    doc['server'].lc.key('port') → (line, col)
            line = find_line_for_path(doc, error['loc'])
            diagnostics.append(Diagnostic(line=line, message=error['msg']))

    server.publish_diagnostics(uri, diagnostics)
```

### 3. YAML AST Utilities (`api/lsp/yaml_ast.py`)

`ruamel.yaml` parses YAML into an AST where every node has `.lc` (line/column) info:

```python
from ruamel.yaml import YAML

yaml = YAML()
doc = yaml.load("server:\n  port: 8080")

# Access position info via .lc
doc.lc.key('server')           # → (0, 0) - line/col of 'server'
doc['server'].lc.key('port')   # → (1, 2) - line/col of 'port'
doc['server'].lc.value('port') # → (1, 8) - line/col of '8080'
```

Key functions to implement:

```python
def find_line_for_path(doc, path: tuple) -> int:
    """Map Pydantic error path → line number using ruamel AST."""
    node = doc
    line = 0
    for key in path:
        if key in node:
            line, _ = node.lc.key(key)  # Get line from AST
            node = node[key]
    return line

def get_yaml_path_at_position(doc, line: int) -> list[str]:
    """Walk AST to find path at cursor line. e.g. ['server', 'port']"""
    # Check each key's node.lc.key() to find which contains target line
    ...
```

### 4. Completions from Pydantic Schema (`api/lsp/completions.py`)

```python
from api.config import ConfigModel
from api.lsp.yaml_ast import get_yaml_path_at_position

def get_completions_for_position(source: str, position) -> list:
    # 1. Use AST to find cursor's path in YAML
    path = get_yaml_path_at_position(source, position.line)

    # 2. Navigate Pydantic schema to that path
    schema = ConfigModel.model_json_schema()
    valid_keys = get_keys_at_schema_path(schema, path)

    # 3. Return completions for valid keys
    return [CompletionItem(label=key, ...) for key in valid_keys]
```

### 5. FastAPI WebSocket Integration (`api/index.py`)

```python
@app.websocket("/api/py/lsp")
async def lsp_endpoint(websocket: WebSocket):
    await websocket.accept()
    await lsp_server.serve_websocket(websocket)
```

---

## Frontend: Monaco + LSP Client

### LSP Client Setup (`app/lib/lsp-client.ts`)

```typescript
import { MonacoLanguageClient } from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';

export async function initLspClient() {
  const ws = new WebSocket('ws://localhost:8000/api/py/lsp');

  ws.onopen = () => {
    const socket = toSocket(ws);
    const client = new MonacoLanguageClient({
      name: 'YAML Config Client',
      clientOptions: { documentSelector: [{ language: 'yaml' }] },
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
