"""Write the OpenAPI spec to docs/openapi.json (importable into Postman or Insomnia).

Usage (from backend/):  uv run python -m scripts.export_openapi
"""

import json
from pathlib import Path

from app.main import app

OUTPUT = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"


def main() -> None:
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
