from typing import Any, Dict, List

from app.core.exceptions import ServiceError


def validate_llm_output(output: Any) -> None:
    """
    Basic sanity checks for LLM output.
    """
    if output is None:
        raise ServiceError("LLM returned empty response")

    if isinstance(output, str):
        if not output.strip():
            raise ServiceError("LLM returned empty text")

    if isinstance(output, Dict):
        if not output:
            raise ServiceError("LLM returned empty JSON")

    if isinstance(output, List):
        if not output:
            raise ServiceError("LLM returned empty list")
