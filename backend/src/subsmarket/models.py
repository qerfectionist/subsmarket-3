from __future__ import annotations


def import_models() -> None:
    import subsmarket.catalog.models  # noqa: F401
    import subsmarket.core.models  # noqa: F401
    import subsmarket.families.models  # noqa: F401
    import subsmarket.identity.models  # noqa: F401
    import subsmarket.notifications.models  # noqa: F401
