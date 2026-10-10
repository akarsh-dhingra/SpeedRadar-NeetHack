"""Run state. Every number the agent holds carries the source it came from."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

Category = Literal["engineering", "ml_ai", "sales", "marketing", "infra_cloud"]
PEOPLE_CATEGORIES: tuple[str, ...] = ("engineering", "ml_ai", "sales", "marketing")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Source(BaseModel):
    kind: Literal["file", "crustdata", "derived", "llm"]
    ref: str  # file path / endpoint
    locator: str = ""  # sheet!row, page, json path, request id
    fetched_at: str = Field(default_factory=now)
    note: str = ""


class Figure(BaseModel):
    """A number plus where it came from. Numbers without a source never reach the report."""

    id: str
    label: str
    value: float
    unit: str = "USD"
    category: str | None = None
    sources: list[Source]
    estimate: bool = False


class Task(BaseModel):
    id: str
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""
    parent: str | None = None  # set for fix-up tasks
    attempts: int = 0
    status: Literal["pending", "done", "failed", "skipped"] = "pending"


class Check(BaseModel):
    name: str
    target: str
    passed: bool
    detail: str = ""


class RecoveryDecision(BaseModel):
    task_id: str
    failed_check: str
    options: list[str]
    chosen: str
    reason: str
    model: str
    default: str  # what a fixed rule would have done; differs → worth showing


class CompetitorSignal(BaseModel):
    name: str  # e.g. role_headcount, function_timeseries, job_titles
    category: str
    headcount: float
    as_of: str
    source: Source


class CompetitorProfile(BaseModel):
    name: str
    domain: str
    total_headcount: int | None = None
    total_as_of: str = ""
    signals: list[CompetitorSignal] = Field(default_factory=list)
    news: list[dict] = Field(default_factory=list)
    funding: dict = Field(default_factory=dict)
    missing: list[str] = Field(default_factory=list)
    substitute_for: str | None = None
    data_mode: Literal["real", "fixture"] = "real"


class Finding(BaseModel):
    id: str
    category: str
    kind: Literal["policy", "internal", "gap"]
    statement: str
    ours: float | None = None
    theirs_low: float | None = None
    theirs_high: float | None = None
    policy_violated: bool | None = None
    figure_ids: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    confidence_inputs: dict = Field(default_factory=dict)
    status: Literal["open", "confirmed", "downgraded", "overturned"] = "open"
    audit_notes: list[str] = Field(default_factory=list)


class RunState(BaseModel):
    run_id: str
    goal: str
    input_dir: str
    started_at: str = Field(default_factory=now)
    git_sha: str = ""
    tags: list[str] = Field(default_factory=list)
    trace_id: str = ""  # first trace of the run
    trace_ids: list[str] = Field(default_factory=list)  # one per process (resume adds one); session_id = run_id
    phase: Literal["plan", "execute", "audit", "report", "done"] = "plan"
    plan_rationale: str = ""
    queue: list[Task] = Field(default_factory=list)
    done: list[Task] = Field(default_factory=list)
    figures: dict[str, Figure] = Field(default_factory=dict)
    competitors: dict[str, CompetitorProfile] = Field(default_factory=dict)
    checks: list[Check] = Field(default_factory=list)
    decisions: list[RecoveryDecision] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    not_analysed: list[dict] = Field(default_factory=list)
    flags: list[dict] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    invoices: list[dict] = Field(default_factory=list)
    budget: dict = Field(default_factory=dict)
    policy: dict = Field(default_factory=dict)
    salary: dict[str, float] = Field(default_factory=dict)
    title_classes: dict[str, dict] = Field(default_factory=dict)
    llm_usage: dict[str, dict] = Field(default_factory=dict)  # model -> {calls, tokens_in, tokens_out, latency_s}
    crustdata_credits: float = 0.0
    injected: list[str] = Field(default_factory=list)
    data_mode: Literal["real", "fixture"] = "real"
    step: int = 0
