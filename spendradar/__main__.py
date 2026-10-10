"""CLI: python -m spendradar run|resume|ledger …  (one process = one neatlogs-tagged run)."""

from __future__ import annotations

import argparse
import json
import os
import sys

from dotenv import load_dotenv


def _start(run_id: str, args: argparse.Namespace) -> list[str]:
    from spendradar import faults
    from spendradar.tracing import init_tracing

    if args.evidence:
        os.environ["SPENDRADAR_LLM_CACHE"] = "0"
    faults.configure(args.inject or [])
    tags = [f"variant:{args.variant}"] + (["evidence"] if args.evidence else [])
    tags += [f"inject:{i}" for i in args.inject or []]
    return init_tracing(run_id, tags)


def _finish(state) -> None:
    from spendradar.tracing import shutdown_tracing

    shutdown_tracing()
    print(json.dumps({"run_id": state.run_id, "phase": state.phase, "trace_id": state.trace_id,
                      "report": f"runs/{state.run_id}/report.md", "findings": [
                          {"id": f.id, "status": f.status, "confidence": f.confidence} for f in state.findings],
                      "decisions": [(d.task_id, d.chosen, d.default) for d in state.decisions],
                      "llm_usage": state.llm_usage, "crustdata_credits": state.crustdata_credits}, indent=1))


def main(argv: list[str] | None = None) -> None:
    load_dotenv(".env")
    ap = argparse.ArgumentParser(prog="spendradar")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("run", "resume"):
        p = sub.add_parser(name)
        p.add_argument("target", help="input folder (run) or run id (resume)")
        p.add_argument("--inject", action="append", help="fault to inject, e.g. crustdata:429, llm:429")
        p.add_argument("--variant", default="dev")
        p.add_argument("--evidence", action="store_true", help="LLM cache off; tagged as an evidence run")
        p.add_argument("--crash-after-step", type=int, default=None, help="simulate a crash (resume demo)")
    sub.add_parser("ledger")
    args = ap.parse_args(argv)

    if args.cmd == "ledger":
        from spendradar import llm

        print(json.dumps(llm.LEDGER.summary(), indent=1))
        return

    from spendradar import agent  # noqa: F401  (imported after env is ready)

    if args.cmd == "run":
        run_id = agent.new_run_id()
        tags = _start(run_id, args)
        from spendradar.tracing import git_sha

        state = agent.new_state(args.target, tags, git_sha(), run_id)
        agent.save(state)
    else:
        state = agent.load(args.target)
        _start(state.run_id, args)
        state.notes.append(f"resumed at phase '{state.phase}', step {state.step}")
    if args.crash_after_step:
        agent.CRASH_AFTER_STEP = args.crash_after_step
    try:
        state = agent.run_phases(state)
    finally:
        _finish(state)
    sys.exit(0 if state.phase == "done" else 1)


if __name__ == "__main__":
    main()
