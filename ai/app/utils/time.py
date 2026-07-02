from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Returns current UTC datetime.
    """
    return datetime.now(timezone.utc)


def utc_timestamp() -> int:
    """
    Returns current UTC timestamp (seconds).
    """
    return int(utc_now().timestamp())
