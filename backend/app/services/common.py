from datetime import UTC, date, datetime


def utc_today() -> date:
    """'Today' for due-date logic. One definition keeps filters, metrics and flags consistent."""
    return datetime.now(UTC).date()


def escape_like(term: str) -> str:
    """Escape LIKE wildcards so user input is matched literally."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
