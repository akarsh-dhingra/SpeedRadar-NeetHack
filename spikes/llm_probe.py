"""Step 2 spike: exercise llm.complete (schema), llm.choose (function calling) and an injected fallback, traced."""

from dotenv import load_dotenv

load_dotenv(".env")
import os  # noqa: E402

os.environ["SPENDRADAR_LLM_CACHE"] = "0"
from pydantic import BaseModel  # noqa: E402

from spendradar import faults  # noqa: E402
from spendradar.tracing import init_tracing, shutdown_tracing  # noqa: E402

init_tracing("probe-llm", ["variant:probe", "inject:llm:429"])
import neatlogs  # noqa: E402

from spendradar import llm  # noqa: E402


class TitleClass(BaseModel):
    category: str
    reason: str


with neatlogs.trace("probe_llm", kind="WORKFLOW") as span:
    print("trace", format(span.get_span_context().trace_id, "032x"))
    r = llm.complete("extract", "Classify the job title 'Senior Machine Learning Engineer' as one of engineering, ml_ai, sales, marketing. JSON with category and reason.", schema=TitleClass)
    print("complete:", r.model, r.parsed, r.tokens_in, r.tokens_out, r.latency_s)
    faults.configure(["llm:429"])
    c = llm.choose("reason", "An invoice PDF failed to parse with pdfplumber (no text layer). Choose a recovery action.", [
        {"name": "reparse_alt", "description": "Re-parse with the LLM PDF reader", "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": ["reason"]}},
        {"name": "skip", "description": "Skip the file and list it under Not analysed", "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": ["reason"]}},
    ])
    print("choose:", c.name, c.args, "model", c.result.model, "fallbacks", c.result.fallbacks, c.result.latency_s)
print(llm.LEDGER.summary())
shutdown_tracing()
