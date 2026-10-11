"""Code provenance: which commit, and which Entire checkpoint, produced a run.

Spend Radar says where every number came from. This goes one level further down:
every run records the exact code that produced it, and the Entire checkpoint that
links that commit to the coding-agent session (prompts, reasoning, changes) behind it.
Report header, neatlogs root span and eval scorecards all carry it.
"""

from __future__ import annotations

import re
import subprocess

ENTIRE_COMMIT_URL = "https://entire.io/gh/{owner}/{repo}/commit/{sha}"
GITHUB_COMMIT_URL = "https://github.com/{owner}/{repo}/commit/{sha}"


def _git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def _owner_repo() -> tuple[str, str] | None:
    url = _git("remote", "get-url", "origin")
    m = re.search(r"github\.com[:/]([^/]+)/([^/.]+?)(?:\.git)?$", url)
    return (m.group(1), m.group(2)) if m else None


def code_provenance() -> dict:
    """{commit, dirty, checkpoint, checkpoint_commit, entire_url, github_url}; empty values outside git."""
    sha = _git("rev-parse", "HEAD")
    if not sha:
        return {}
    dirty = bool(_git("status", "--porcelain", "--untracked-files=no"))
    # The nearest commit at or before HEAD that carries an Entire checkpoint trailer.
    log = _git("log", "-30", "--format=%H%x09%(trailers:key=Entire-Checkpoint,valueonly,separator=%x2C)")
    checkpoint, cp_commit = "", ""
    for line in log.splitlines():
        c, _, cp = line.partition("\t")
        if cp.strip():
            checkpoint, cp_commit = cp.strip().split(",")[0], c
            break
    out = {"commit": sha, "dirty": dirty, "checkpoint": checkpoint, "checkpoint_commit": cp_commit,
           "entire_url": "", "github_url": ""}
    if (orr := _owner_repo()):
        owner, repo = orr
        out["github_url"] = GITHUB_COMMIT_URL.format(owner=owner, repo=repo, sha=sha)
        if cp_commit:
            out["entire_url"] = ENTIRE_COMMIT_URL.format(owner=owner, repo=repo, sha=cp_commit)
    return out


def markdown_line(p: dict) -> str:
    """One report-header line; says plainly when the run had uncommitted changes."""
    if not p.get("commit"):
        return "- Code: not in a git checkout"
    short = p["commit"][:7]
    parts = [f"- Code: commit [`{short}`]({p['github_url']})" if p["github_url"] else f"- Code: commit `{short}`"]
    if p["dirty"]:
        parts.append("**with uncommitted changes** (the checkpoint below is the closest committed state)")
    if p["checkpoint"]:
        cp = f"Entire checkpoint `{p['checkpoint']}`"
        parts.append(f"[{cp}]({p['entire_url']}) (the agent session that wrote this code)" if p["entire_url"] else cp)
    return " · ".join(parts)
