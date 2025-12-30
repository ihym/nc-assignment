"""Config API endpoints and related functionality."""

import os
import yaml
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Literal


# Configuration constants
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", ".data")
os.makedirs(DATA_DIR, exist_ok=True)
CONFIG_FILE_PATH = os.path.join(DATA_DIR, "config.yaml")

DEFAULT_CONFIG = {
    "server": {"host": "127.0.0.1", "port": 3000, "use_ssl": True},
    "logging": {"level": "debug", "file": "./debug.log"},
}


# Pydantic models
class ServerConfig(BaseModel):
    host: str
    port: int
    use_ssl: bool


class LoggingConfig(BaseModel):
    level: Literal["debug", "info", "warn", "error"]
    file: str


class Config(BaseModel):
    server: ServerConfig
    logging: LoggingConfig


class ConfigUpdate(BaseModel):
    yaml_content: str


class ConfigResponse(BaseModel):
    config: Config
    yaml_content: str


class ConfigUpdateResponse(BaseModel):
    success: bool
    config: Config
    yaml_content: str


# Storage functions
def ensure_config_exists():
    """Create default config file if it doesn't exist."""
    if not os.path.exists(CONFIG_FILE_PATH):
        with open(CONFIG_FILE_PATH, "w") as f:
            yaml.dump(DEFAULT_CONFIG, f, default_flow_style=False, sort_keys=False)


def load_config() -> dict:
    """Load configuration from YAML file."""
    ensure_config_exists()
    with open(CONFIG_FILE_PATH, "r") as f:
        return yaml.safe_load(f)


def save_config(config: dict):
    """Save configuration to YAML file."""
    with open(CONFIG_FILE_PATH, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


# API route handlers
def get_config() -> ConfigResponse:
    """Get the current YAML configuration."""
    try:
        config_dict = load_config()
        yaml_content = yaml.dump(config_dict, default_flow_style=False, sort_keys=False)
        config = Config(**config_dict)
        return ConfigResponse(config=config, yaml_content=yaml_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def update_config(update: ConfigUpdate) -> ConfigUpdateResponse:
    """Update the YAML configuration."""
    try:
        # Parse and validate the YAML content
        config_dict = yaml.safe_load(update.yaml_content)

        # Validate against our schema using Pydantic
        validated_config = Config(**config_dict)

        # Save the validated config
        save_config(config_dict)

        return ConfigUpdateResponse(
            success=True,
            config=validated_config,
            yaml_content=yaml.dump(config_dict, default_flow_style=False, sort_keys=False),
        )
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def register_routes(app):
    """Register config API routes."""
    app.get("/api/py/config", response_model=ConfigResponse)(get_config)
    app.post("/api/py/config", response_model=ConfigUpdateResponse)(update_config)
