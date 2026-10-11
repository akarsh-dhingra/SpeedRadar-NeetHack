"""Minimal client for the neatlogs MCP server (Streamable HTTP, JSON-RPC 2.0).

Used by `spendradar explain` to read a trace's spans. Auth is the project API key as a
bearer token (https://docs.neatlogs.com/integrations/mcp). The key is read from the
environment and never printed or written anywhere.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

URL = os.environ.get("NEATLOGS_MCP_URL", "https://ingest.neatlogs.com/mcp")


class MCPError(RuntimeError):
    pass


class NeatlogsMCP:
    def __init__(self, timeout: float = 120):
        key = os.environ.get("NEATLOGS_API_KEY")
        if not key:
            raise MCPError("NEATLOGS_API_KEY is not set")
        self.headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                        "Accept": "application/json, text/event-stream"}
        self.client = httpx.Client(timeout=timeout)
        self._id = 0
        self._rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                 "clientInfo": {"name": "spendradar", "version": "1"}})
        self.client.post(URL, headers=self.headers, json={"jsonrpc": "2.0", "method": "notifications/initialized"})

    def _rpc(self, method: str, params: dict) -> dict:
        self._id += 1
        r = self.client.post(URL, headers=self.headers,
                             json={"jsonrpc": "2.0", "id": self._id, "method": method, "params": params})
        if sid := r.headers.get("mcp-session-id"):
            self.headers["mcp-session-id"] = sid
        text = r.text
        if "text/event-stream" in r.headers.get("content-type", ""):
            text = "\n".join(line[5:] for line in text.splitlines() if line.startswith("data:"))
        try:
            msg = json.loads(text) if text.strip() else {}
        except ValueError as e:
            raise MCPError(f"{method}: non-JSON response (HTTP {r.status_code})") from e
        if "error" in msg:
            raise MCPError(f"{method}: {msg['error']}")
        return msg.get("result", {})

    def call(self, tool: str, **arguments: Any) -> Any:
        res = self._rpc("tools/call", {"name": tool, "arguments": arguments})
        text = "".join(p.get("text", "") for p in res.get("content", []) if isinstance(p, dict))
        try:
            out = json.loads(text)
        except ValueError:
            return text
        if isinstance(out, dict) and out.get("error"):
            raise MCPError(f"{tool}: {out['error']}")
        return out

    def trace_spans(self, trace_id: str, max_spans: int = 2000) -> dict:
        """All spans of a trace (follows next_offset pages)."""
        first = self.call("get_trace_context", trace_id=trace_id)
        spans = list(first.get("spans", []))
        offset = first.get("next_offset")
        while offset is not None and len(spans) < max_spans:
            page = self.call("get_trace_context", trace_id=trace_id, offset=offset)
            new = page.get("spans", [])
            nxt = page.get("next_offset")
            spans += new
            if not new or nxt is None or nxt <= offset:  # stop on an empty page or a cursor that does not advance
                break
            offset = nxt
        return {**first, "spans": spans}

    def close(self) -> None:
        self.client.close()
