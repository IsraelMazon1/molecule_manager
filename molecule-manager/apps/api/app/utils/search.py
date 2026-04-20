def escape_like(value: str) -> str:
    """Escape SQL LIKE wildcards so user input is treated as literal text."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
