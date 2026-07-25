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

# Warn / critical fire at these fractions of the active model's context window.
WARN_FRACTION = 0.70
CRITICAL_FRACTION = 0.85

# Context window (tokens) per model, matched by substring against the model id
# from the transcript — first match wins. Edit these as model windows change;
# anything unmatched falls back to DEFAULT_WINDOW.
CONTEXT_WINDOWS = (
    ("opus-5", 1_000_000),
    ("opus-4-8", 1_000_000),
    ("sonnet-4-5", 1_000_000),
    ("sonnet-5", 1_000_000),
    ("fable-5", 1_000_000),
    # Generic fallbacks — keep these last: the first substring match wins, so a bare
    # "opus"/"sonnet" entry placed above would shadow every versioned entry below it.
    ("opus", 200_000),
    ("sonnet", 200_000),
    ("haiku", 200_000),
)
DEFAULT_WINDOW = 200_000


def window_for(model):
    """Context window for a model id, by first substring match; DEFAULT_WINDOW otherwise."""
    if model:
        for needle, window in CONTEXT_WINDOWS:
            if needle in model:
                return window
    return DEFAULT_WINDOW


def context_state(transcript_path):
    """(tokens, model) from the last main-chain assistant message.

    tokens ≈ its total input tokens (fresh + cache read + cache creation).
    """
    last_usage = None
    last_model = None
    with open(transcript_path, encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "assistant" or obj.get("isSidechain"):
                continue
            message = obj.get("message") or {}
            usage = message.get("usage")
            if usage:
                last_usage = usage
                last_model = message.get("model") or last_model
    if not last_usage:
        return 0, last_model
    tokens = (
        last_usage.get("input_tokens", 0)
        + last_usage.get("cache_read_input_tokens", 0)
        + last_usage.get("cache_creation_input_tokens", 0)
    )
    return tokens, last_model


def main():
    data = json.load(sys.stdin)
    transcript_path = data.get("transcript_path")
    session_id = data.get("session_id", "unknown")
    if not transcript_path or not os.path.isfile(transcript_path):
        return

    tokens, model = context_state(transcript_path)
    window = window_for(model)
    warn_tokens = int(window * WARN_FRACTION)
    critical_tokens = int(window * CRITICAL_FRACTION)
    tier = 2 if tokens >= critical_tokens else 1 if tokens >= warn_tokens else 0

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
    pct = round(tokens / window * 100)
    win_k = f"{window // 1000}k"
    if tier == 2:
        system_message = (
            f"🔴 Context is at {k} tokens ({pct}% of the {win_k} window) — "
            f"auto-compact is imminent. Run /handoff now and continue in a fresh session."
        )
        additional_context = (
            f"[context-warning hook] The context window is at {k} tokens — {pct}% of "
            f"this model's {win_k} window (critical, ≥{int(CRITICAL_FRACTION * 100)}%). "
            "Finish only the immediate step, then recommend the user run /handoff to "
            "save state and start a fresh session. Do not start new sub-tasks."
        )
    else:
        system_message = (
            f"🟡 Context is at {k} tokens ({pct}% of the {win_k} window). At the next "
            f"natural stopping point, consider /handoff to continue in a fresh session."
        )
        additional_context = (
            f"[context-warning hook] The context window is at {k} tokens — {pct}% of "
            f"this model's {win_k} window (≥{int(WARN_FRACTION * 100)}%). When the "
            "current task reaches a natural stopping point, suggest the user run "
            "/handoff to save state and start a fresh session. Keep working normally until then."
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
