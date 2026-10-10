"""Step 2 spike: one traced Gemini call + a custom TOOL span, and find the trace id."""

import os

from dotenv import load_dotenv

load_dotenv(".env")
from spendradar.tracing import init_tracing, shutdown_tracing  # noqa: E402

init_tracing("probe-step2", ["variant:probe"])
import neatlogs  # noqa: E402
from google import genai  # noqa: E402  (constructed after init)

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


@neatlogs.span(kind="TOOL", name="act:echo", tool_name="echo")
def echo(x: str) -> str:
    return x


with neatlogs.trace("probe_run", kind="WORKFLOW", session_id="probe-step2") as span:
    print("span type:", type(span).__name__, [a for a in dir(span) if "context" in a.lower() or "id" in a.lower()][:10])
    try:
        ctx = span.get_span_context()
        print("otel trace id:", format(ctx.trace_id, "032x"))
    except Exception as e:
        print("otel lookup failed:", e)
    echo("hello")
    r = client.models.generate_content(model="gemini-3.5-flash-lite", contents="Reply with one word: traced")
    print("llm:", r.text)
shutdown_tracing()
