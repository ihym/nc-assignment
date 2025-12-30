"""Completions API endpoint and completion logic."""

from typing import List
import yaml
from pydantic import BaseModel
from typing import Optional


# Pydantic models
class CompletionRequest(BaseModel):
    line: str
    cursor_position: int
    full_content: str
    line_number: int


class CompletionItem(BaseModel):
    label: str
    kind: str
    detail: Optional[str] = None
    insertText: str
    documentation: Optional[str] = None


class CompletionResponse(BaseModel):
    completions: List[CompletionItem]


# Completion logic
def get_completions(
    line: str, cursor_position: int, full_content: str, line_number: int
) -> List[dict]:
    """Generate completion suggestions based on cursor position and context."""
    completions = []

    # Get the text before cursor
    text_before_cursor = line[:cursor_position].strip()

    # Determine indentation level (0 = root, 2 = first level, 4 = second level)
    leading_spaces = len(line) - len(line.lstrip())

    # Check what's in the content already to provide context-aware completions
    try:
        existing_config = yaml.safe_load(full_content) if full_content.strip() else {}
    except Exception:
        existing_config = {}

    # Root level completions (no indentation)
    if leading_spaces == 0:
        if not text_before_cursor or text_before_cursor == "":
            # Suggest top-level keys
            if "server" not in str(existing_config):
                completions.append(
                    {
                        "label": "server",
                        "kind": "property",
                        "detail": "Server configuration block",
                        "insertText": 'server:\n  host: "127.0.0.1"\n  port: 3000\n  use_ssl: true',
                        "documentation": "Configure the web server settings including host, port, and SSL",
                    }
                )
            if "logging" not in str(existing_config):
                completions.append(
                    {
                        "label": "logging",
                        "kind": "property",
                        "detail": "Logging configuration block",
                        "insertText": 'logging:\n  level: "debug"\n  file: "./debug.log"',
                        "documentation": "Configure logging settings including level and output file",
                    }
                )
        elif text_before_cursor.startswith("s"):
            completions.append(
                {
                    "label": "server",
                    "kind": "property",
                    "detail": "Server configuration block",
                    "insertText": 'server:\n  host: "127.0.0.1"\n  port: 3000\n  use_ssl: true',
                    "documentation": "Configure the web server settings",
                }
            )
        elif text_before_cursor.startswith("l"):
            completions.append(
                {
                    "label": "logging",
                    "kind": "property",
                    "detail": "Logging configuration block",
                    "insertText": 'logging:\n  level: "debug"\n  file: "./debug.log"',
                    "documentation": "Configure logging settings",
                }
            )

    # First level (under server: or logging:)
    elif leading_spaces == 2:
        # Check context - are we under server or logging?
        lines = full_content.split("\n")
        parent_key = None
        for i in range(line_number - 1, -1, -1):
            if i < len(lines):
                l = lines[i]
                if l and not l.startswith(" ") and ":" in l:
                    parent_key = l.split(":")[0].strip()
                    break

        if parent_key == "server":
            server_keys = ["host", "port", "use_ssl"]
            for key in server_keys:
                if text_before_cursor == "" or key.startswith(text_before_cursor):
                    if key == "host":
                        completions.append(
                            {
                                "label": "host",
                                "kind": "property",
                                "detail": "string - Hostname or IP address",
                                "insertText": 'host: "127.0.0.1"',
                                "documentation": "The hostname or IP address to bind to",
                            }
                        )
                    elif key == "port":
                        completions.append(
                            {
                                "label": "port",
                                "kind": "property",
                                "detail": "integer - Port number",
                                "insertText": "port: 3000",
                                "documentation": "The port number (1-65535)",
                            }
                        )
                    elif key == "use_ssl":
                        completions.append(
                            {
                                "label": "use_ssl",
                                "kind": "property",
                                "detail": "boolean - Enable SSL",
                                "insertText": "use_ssl: true",
                                "documentation": "Whether to enable SSL/TLS encryption",
                            }
                        )

        elif parent_key == "logging":
            logging_keys = ["level", "file"]
            for key in logging_keys:
                if text_before_cursor == "" or key.startswith(text_before_cursor):
                    if key == "level":
                        completions.append(
                            {
                                "label": "level",
                                "kind": "property",
                                "detail": "enum - Log level",
                                "insertText": 'level: "debug"',
                                "documentation": "Log level: debug, info, warn, error",
                            }
                        )
                    elif key == "file":
                        completions.append(
                            {
                                "label": "file",
                                "kind": "property",
                                "detail": "string - Log file path",
                                "insertText": 'file: "./debug.log"',
                                "documentation": "Path to the log output file",
                            }
                        )

    # Value completions (after a colon) - only for booleans and enums
    if ":" in text_before_cursor:
        key = text_before_cursor.split(":")[0].strip()

        if key == "use_ssl":
            completions.extend(
                [
                    {
                        "label": "true",
                        "kind": "value",
                        "detail": "Enable SSL",
                        "insertText": "true",
                        "documentation": "Enable SSL/TLS",
                    },
                    {
                        "label": "false",
                        "kind": "value",
                        "detail": "Disable SSL",
                        "insertText": "false",
                        "documentation": "Disable SSL/TLS",
                    },
                ]
            )

        elif key == "level":
            for level in ["debug", "info", "warn", "error"]:
                completions.append(
                    {
                        "label": level,
                        "kind": "value",
                        "detail": f"Log level: {level}",
                        "insertText": level,
                        "documentation": f"Set logging level to {level}",
                    }
                )

    return completions


# API route handler
def post_completions(request: CompletionRequest) -> CompletionResponse:
    """Get completions for the current cursor position."""
    completions = get_completions(
        line=request.line,
        cursor_position=request.cursor_position,
        full_content=request.full_content,
        line_number=request.line_number,
    )
    return CompletionResponse(completions=[CompletionItem(**c) for c in completions])


def register_routes(app):
    """Register completions API routes."""
    app.post("/api/py/completions", response_model=CompletionResponse)(post_completions)
