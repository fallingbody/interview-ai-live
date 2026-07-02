from uuid import UUID, uuid4


def generate_uuid() -> UUID:
    """
    Generate a UUID4.
    Centralized for consistency & testability.
    """
    return uuid4()
