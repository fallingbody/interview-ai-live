from typing import Dict, List

from app.core.exceptions import ValidationError


def validate_required_fields(payload: Dict, required_fields: List[str]) -> None:
    """
    Ensure required fields exist and are not None.
    """
    missing = [
        field
        for field in required_fields
        if field not in payload or payload[field] is None
    ]

    if missing:
        raise ValidationError(
            f"Missing required fields: {', '.join(missing)}"
        )
