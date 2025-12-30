# YAML Config Editor

A web application for editing YAML configuration files with dual-view editing: a Monaco-powered YAML editor and a form-based UI. Changes sync bidirectionally in real-time and persist to the backend automatically.

## Features

- **Dual-View Editing**: Edit configuration through a YAML code editor or a visual form
- **Real-Time Sync**: Changes in one view instantly reflect in the other
- **Auto-Save**: Debounced persistence (800ms) to the backend with React Query
- **Type-Safe API**: Auto-generated TypeScript SDK from OpenAPI spec using @hey-api/openapi-ts
- **Code Completion**: Intelligent suggestions in the YAML editor

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- [uv](https://docs.astral.sh/uv/) - Fast Python package installer

### Installation

**Install Node.js dependencies**

```bash
pnpm install
```

**Install Python dependencies**

```bash
uv sync
```

### Running the Application

Start both the frontend and backend with a single command:

```bash
pnpm dev
```

This will start:

- **Next.js frontend** at [http://localhost:3000](http://localhost:3000)
- **FastAPI backend** at [http://localhost:8000](http://localhost:8000)

Alternatively, run them separately:

```bash
# Terminal 1 - Frontend
pnpm next-dev

# Terminal 2 - Backend
uv run uvicorn api.index:app --reload
```

### Regenerate API SDK

When you change the FastAPI endpoints, regenerate the TypeScript SDK:

```bash
# Make sure the backend is running first
pnpm generate-api
```

This uses [@hey-api/openapi-ts](https://heyapi.dev/) to generate:

- Type definitions from Pydantic models
- SDK functions for each endpoint
- React Query hooks for data fetching

### API Documentation

Once running, access the FastAPI documentation at:

- Swagger UI: [http://localhost:8000/api/py/docs](http://localhost:8000/api/py/docs)
- OpenAPI JSON: [http://localhost:8000/api/py/openapi.json](http://localhost:8000/api/py/openapi.json)

## Assumptions & Trade-offs

### Assumptions

1. **Single User**: The application assumes single-user access. Concurrent editing is not handled.
2. **Local Storage**: Config file is stored on the server filesystem, not in a database.
3. **Fixed Schema**: The YAML schema is hardcoded. Schema changes require code updates.
4. **Development Focus**: Optimized for development experience; production deployment would need additional configuration.

### Trade-offs

1. **Rest API for Completions**: Using rest API for completions. Trade-off: more overhead compared to websockets but less hustle to setup.
2. **File-based Storage**: Simpler than database, allows direct YAML file inspection. Trade-off: not suitable for multi-user or distributed deployments.
3. **React Query + Generated SDK**: Type-safe API calls with automatic caching and refetching. Trade-off: requires regenerating SDK when API changes.

## Future Improvements

Given more time, the following enhancements could be made:

1. **Enhanced Completion Service**
   - LSP integration
   - More contextual suggestions based on cursor position

2. **Better Validation**
   - Visual error highlighting in the editor (red squiggles)
   - JSON Schema validation with detailed error messages
   - Custom validation rules
