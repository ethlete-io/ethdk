#!/usr/bin/env python3
"""UserPromptSubmit hook: warn when the context window is getting large.

Reads the hook input JSON from stdin, estimates the current context size from
the last main-chain assistant message in the session transcript, and emits a
warning (visible to both the user and Claude) when it crosses a threshold.
Recommends the /handoff skill so work can continue in a fresh session.

Warns once per tier per session (state kept in a temp file); re-arms itself
if the context shrinks again (e.g. after /compact).

Fail-safe: any error exits 0 with no output — the hook must never block a prompt.
"""

import json
import os
import sys
import tempfile

WARN_TOKENS = 100_000
CRITICAL_TOKENS = 140_000


def context_tokens(transcript_path):
    """Context size ≈ total input tokens of the last main-chain assistant message."""
    last = None
    with open(transcript_path, encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "assistant" or obj.get("isSidechain"):
                continue
            usage = (obj.get("message") or {}).get("usage")
            if usage:
                last = usage
    if not last:
        return 0
    return (
        last.get("input_tokens", 0)
        + last.get("cache_read_input_tokens", 0)
        + last.get("cache_creation_input_tokens", 0)
    )


def main():
    data = json.load(sys.stdin)
    transcript_path = data.get("transcript_path")
    session_id = data.get("session_id", "unknown")
    if not transcript_path or not os.path.isfile(transcript_path):
        return

    tokens = context_tokens(transcript_path)
    tier = 2 if tokens >= CRITICAL_TOKENS else 1 if tokens >= WARN_TOKENS else 0

    state_file = os.path.join(
        tempfile.gettempdir(), f"claude-context-warning-{session_id}"
    )
    prev_tier = 0
    try:
        with open(state_file, encoding="utf-8") as f:
            prev_tier = int(f.read().strip() or 0)
    except (OSError, ValueError):
        pass

    if tier != prev_tier:
        try:
            with open(state_file, "w", encoding="utf-8") as f:
                f.write(str(tier))
        except OSError:
            pass

    if tier <= prev_tier:
        return  # already warned at this tier (or context shrank — state re-armed above)

    k = f"~{tokens // 1000}k"
    if tier == 2:
        system_message = (
            f"🔴 Context is at {k} tokens — auto-compact is imminent. "
            f"Run /handoff now and continue in a fresh session."
        )
        additional_context = (
            f"[context-warning hook] The context window is at {k} tokens (critical, "
            f"≥{CRITICAL_TOKENS // 1000}k). Finish only the immediate step, then "
            "recommend the user run /handoff to save state and start a fresh session. "
            "Do not start new sub-tasks."
        )
    else:
        system_message = (
            f"🟡 Context is at {k} tokens. At the next natural stopping point, "
            f"consider /handoff to continue in a fresh session."
        )
        additional_context = (
            f"[context-warning hook] The context window is at {k} tokens "
            f"(≥{WARN_TOKENS // 1000}k). When the current task reaches a natural "
            "stopping point, suggest the user run /handoff to save state and start "
            "a fresh session. Keep working normally until then."
        )

    print(
        json.dumps(
            {
                "systemMessage": system_message,
                "suppressOutput": True,
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": additional_context,
                },
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
