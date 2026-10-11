"""Named, versioned prompt templates, tracked by neatlogs.

Each LLM prompt the agent sends is a template here. `use()` renders it and wraps the call
in `neatlogs.trace(..., system_prompt_template=..., user_prompt_template=..., version=...)`,
so the nested LLM span carries the template, its variables and the version, and neatlogs
groups calls by prompt key. Bump `version` whenever a template's text changes, so a
before/after comparison can be filtered by prompt version.

Rendering is single-pass ({{name}} → value) so a value that itself contains "{{x}}" is
never substituted again; the rendered text is byte-identical to the pre-template prompts.
"""

from __future__ import annotations

import re
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator

import neatlogs

_VAR = re.compile(r"\{\{(\w+)\}\}")


@dataclass(frozen=True)
class Prompt:
    key: str
    version: str
    system: str
    user: str


def render(text: str, variables: dict[str, Any]) -> str:
    return _VAR.sub(lambda m: str(variables[m.group(1)]), text)


@contextmanager
def use(p: Prompt, **variables: Any) -> Iterator[tuple[str, str]]:
    """Yield (system, user) for `p`; LLM calls inside are tagged with the template and version."""
    system, user = render(p.system, variables), render(p.user, variables)
    with neatlogs.trace(f"prompt:{p.key}", kind="CHAIN",
                        system_prompt_template=p.system or None, system_prompt_variables=None,
                        user_prompt_template=p.user, user_prompt_variables=variables or None,
                        version=p.version):
        yield system, user


PLAN = Prompt(
    key="plan", version="v1",
    system="You are the planner of a finance analysis agent. Be complete and concrete.",
    user=("GOAL: {{goal}}\n\nINPUT FOLDER ({{input_dir}}):\n{{files}}\n\nCOMPETITORS:\n{{competitors}}"
          "\n\nTOOLS:\n{{tools}}"
          "\n\nWrite the task list. Paths are relative to the input folder. Read every finance file once "
          "(invoices default to mode 'text'; ignore README/competitors.yaml), fetch every competitor, fetch jobs "
          "and classify titles for every competitor (needed for ML/AI), and order tasks so inputs exist before "
          "they are needed. One task per file or competitor action."))

RECOVERY = Prompt(
    key="decide_recovery", version="v1",
    system="You choose recovery actions for a finance analysis agent.",
    user=("A step of the finance agent failed verification.\nTask: {{task}}\n"
          "Failure: {{failure}}\nDetail: {{detail}}\nAttempts so far: {{attempts}}\n"
          "Previous decisions for this task: {{previous}}\n"
          "Pick the recovery action most likely to produce a correct, sourced number. "
          "Do not repeat an action that already failed for this task."))

AUDIT_JUDGE = Prompt(
    key="audit_judge", version="v1",
    system="You are a sceptical finance auditor checking an analyst's findings.",
    user=("FINDING ({{category}}, confidence {{confidence}}):\n{{statement}}\n\n"
          "DETERMINISTIC CHECKS:\n{{checks}}"
          "\n\nEVIDENCE THAT MIGHT CONTRADICT IT:\n{{evidence}}"
          "\n\nTry to disprove the finding. 'overturn' = the evidence shows it is wrong or unsupported; "
          "'downgrade' = it may hold but the evidence weakens it materially; 'confirm' = it survives. "
          "For an invoice flagged as mis-categorised, decide from the LINE ITEMS: does the work belong to the "
          "category of the cost centre it was billed to? The kind of work decides the category, not which "
          "cost centre paid. If any invoice's line items do not match its cost centre, the flag is correct: "
          "'confirm' and set corrected_category to the category the line items belong to. "
          "Judge only from the evidence given; do not invent facts."))

LINE_ITEMS = Prompt(
    key="line_items_vs_cost_centre", version="v1",
    system="You classify invoice line items into budget categories.",
    user=("For each invoice, say which budget category the WORK in its line items belongs to: "
          "engineering, ml_ai, sales, marketing or infra_cloud ('unclear' if you cannot tell). Judge only from "
          "the line items, not from the cost centre or vendor name.\n\n{{invoices}}"))

CLASSIFY_TITLES = Prompt(
    key="classify_titles", version="v1",
    system=(
        "You map job titles to spend categories for a people-cost comparison.\n"
        "engineering: software, infra, SRE, security, data engineering, developer advocacy.\n"
        "ml_ai: roles whose main job is building or researching ML/AI models or ML/AI products "
        "(ML engineer, applied scientist, AI engineer, research scientist, MLOps).\n"
        "sales: AE, SDR/BDR, sales engineering, solutions/pre-sales, partnerships, customer success.\n"
        "marketing: product/growth/brand/content marketing, events, comms.\n"
        "other: everything else (product management, design, finance, HR, ops, support, legal, interns "
        "that do not clearly fit). Classify by the role's work, not by buzzwords in the team name."),
    user="Classify each title. Return every title exactly as given.\n{{titles}}")

PDF_EXTRACT = Prompt(
    key="read_pdf_llm", version="v2", system="",
    # v2: on real FCC broadcast invoices v1 copied "Net Amount Due" (gross minus agency commission) as the
    # stated total on 4 of 12; see evidence/real-invoices/.
    user=("Extract this invoice exactly as printed. Amounts as numbers without separators. "
          "Do not compute or correct anything; copy the stated total as printed. "
          "stated_total is the gross total of the charges (the line labelled Total, Gross Total or Total Charges), "
          "before any agency commission, discount or deduction. Never use Net Amount Due or Balance Due when a "
          "gross total is printed. Each line item is one charge line with its printed amount."))
