"""Deliberate fault injection for recovery traces (`--inject target:fault`).

Each injected fault fires once per process. Injected runs are tagged
`inject:<spec>` in neatlogs and labelled in the run report.
"""

from __future__ import annotations

_active: set[str] = set()
fired: list[str] = []


def configure(specs: list[str]) -> None:
    _active.clear()
    _active.update(specs)


def active() -> list[str]:
    return sorted(_active | set(fired))


def fire(spec: str) -> bool:
    if spec in _active:
        _active.discard(spec)
        fired.append(spec)
        import neatlogs

        with neatlogs.trace(f"fault:injected:{spec}", kind="GUARDRAIL") as span:
            span.set_attribute("spendradar.fault", spec)
        return True
    return False
