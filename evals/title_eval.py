"""Score spendradar.tools.classify.classify_titles against hand-labelled titles."""
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env")

from spendradar.tools.classify import classify_titles  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    items = json.loads((ROOT / "evals" / "titles_labelled.json").read_text())
    preds, usage = classify_titles([i["title"] for i in items])
    models = sorted({p["model"] for p in preds.values()})
    rows, conf, correct = [], Counter(), 0
    for i in items:
        p = preds.get(i["title"], {}).get("category", "missing")
        ok = p == i["label"]
        correct += ok
        conf[(i["label"], p)] += 1
        rows.append({"title": i["title"], "label": i["label"], "predicted": p, "correct": ok})
        print(f"{'OK  ' if ok else 'FAIL'} {i['title']!r}: label={i['label']} pred={p}")
    tp = conf[("ml_ai", "ml_ai")]
    fp = sum(v for (l, p), v in conf.items() if p == "ml_ai" and l != "ml_ai")
    fn = sum(v for (l, p), v in conf.items() if l == "ml_ai" and p != "ml_ai")
    prec = tp / (tp + fp) if tp + fp else None
    rec = tp / (tp + fn) if tp + fn else None
    acc = correct / len(items)
    print(f"\naccuracy: {correct}/{len(items)} = {acc}")
    print(f"ml_ai precision: {prec} (tp={tp} fp={fp})  recall: {rec} (tp={tp} fn={fn})")
    print("confusion (label -> predicted):")
    for (l, p), v in sorted(conf.items()):
        print(f"  {l} -> {p}: {v}")
    ts = datetime.now()
    result = {"run_timestamp": ts.isoformat(timespec="seconds"), "models": models, "n": len(items),
              "correct": correct, "accuracy": acc, "ml_ai_precision": prec, "ml_ai_recall": rec,
              "ml_ai_tp": tp, "ml_ai_fp": fp, "ml_ai_fn": fn,
              "confusion": {f"{l}->{p}": v for (l, p), v in sorted(conf.items())},
              "rows": rows, "usage": usage}
    out = ROOT / "evidence" / "evals" / f"title-classifier-{ts:%Y%m%dT%H%M%S}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
