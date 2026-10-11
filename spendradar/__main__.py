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
    if args.fixtures:
        from pathlib import Path

        from spendradar.tools import crustdata

        if not Path(args.fixtures).resolve().is_relative_to(Path("evals").resolve()):
            raise SystemExit("fixtures are only allowed from evals/")
        crustdata.FIXTURE_DIR = Path(args.fixtures)
    faults.configure(args.inject or [])
    tags = [f"variant:{args.variant}"] + (["evidence"] if args.evidence else [])
    tags += ["fixture"] if args.fixtures else []
    tags += [f"inject:{i}" for i in args.inject or []]
    return init_tracing(run_id, tags)


def _finish(state) -> None:
    from spendradar.tracing import shutdown_tracing

    shutdown_tracing()
    print(json.dumps({"run_id": state.run_id, "phase": state.phase, "trace_id": state.trace_id,
                      "trace_ids": state.trace_ids,
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
        p.add_argument("--fixtures", default=None, help="EVALS ONLY: folder of altered Crustdata fixtures")
    sub.add_parser("ledger")
    sub.add_parser("export", help="write evidence/frontend_data.json for a front end (docs/frontend-data.md)")
    e = sub.add_parser("eval")
    e.add_argument("--n", type=int, default=1)
    e.add_argument("--variant", default="eval")
    e.add_argument("--evidence", action="store_true")
    e.add_argument("--score", nargs="*", help="score existing run ids instead of launching runs")
    e.add_argument("--fixtures", default=None, help="EVALS ONLY: run against altered fixtures")
    e.add_argument("--data", default="data/acme", help="input folder, e.g. data/kestrel (held-out)")
    e.add_argument("--no-neatlogs", action="store_true", help="do not publish the scorecard as a neatlogs eval trace")
    args = ap.parse_args(argv)

    if args.cmd == "ledger":
        from spendradar import llm

        print(json.dumps(llm.LEDGER.summary(), indent=1))
        return

    if args.cmd == "export":
        from spendradar import export

        print(f"wrote {export.build()}")
        return

    if args.cmd == "eval":
        from spendradar import evals

        path = evals.run_eval(args.n, args.variant, args.evidence, args.score, args.fixtures, args.data)
        card = json.loads(path.read_text(encoding="utf-8"))
        if not args.no_neatlogs:
            from spendradar import neatlogs_evals

            try:
                card["neatlogs_eval_trace_id"] = neatlogs_evals.publish(card, path)
                path.write_text(json.dumps(card, indent=1), encoding="utf-8")
                print(f"neatlogs eval trace: {card['neatlogs_eval_trace_id']}")
            except Exception as e:  # the scorecard is already saved; publishing is best effort
                print(f"warning: eval not published to neatlogs ({type(e).__name__}: {e})", file=sys.stderr)
        print(f"scorecard: {path}")
        print(json.dumps({k: card[k] for k in ("n_runs", "n_runs_incomplete", "n_runs_without_fallback", "planted_total",
                                                "summary_all_runs")}, indent=1))
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
