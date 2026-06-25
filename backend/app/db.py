import sqlite3
from pathlib import Path

from app.core.config import settings


def get_database_path() -> Path:
    raw_path = settings.database_url.replace("sqlite:///", "", 1)
    return Path(raw_path).resolve()


def get_connection() -> sqlite3.Connection:
    db_path = get_database_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection
