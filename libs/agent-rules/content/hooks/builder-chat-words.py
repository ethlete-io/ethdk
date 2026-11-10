#!/usr/bin/env python3
"""Stop hook: logs the chat text of a builder turn and blocks a turn that ends with more than one line.

Only runs in a session started with `--role builder` (ETHLETE_AGENT_ROLE=builder). Appends one
JSON line to .claude/builder-chat-words.jsonl: timestamp, session_id, words, lines, blocked. When
the turn's text blocks and last_assistant_message hold more than one non-empty line it blocks the stop once (not again while
stop_hook_active is set). It always exits 0.
"""

import json
import os
import sys
from datetime import datetime, timezone

LOG_FILE = os.path.join(".claude", "builder-chat-words.jsonl")
BLOCK_REASON = (
    "builder: no chat text. Send the report with SendMessage to the grill session; "
    "end the turn with at most one line."
)


def is_prompt(entry):
    if entry.get("type") != "user":
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )


def turn_texts(path):
    texts = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if not isinstance(entry, dict):
                continue
            if is_prompt(entry):
                texts = []
            elif entry.get("type") == "assistant":
                content = (entry.get("message") or {}).get("content")
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            texts.append(str(block.get("text", "")))
    return texts


def with_final(texts, final):
    if not isinstance(final, str) or not final.strip():
        return texts
    if texts and texts[-1].strip() == final.strip():
        return texts
    return [*texts, final]


def main():
    if os.environ.get("ETHLETE_AGENT_ROLE") != "builder":
        return
    payload = json.load(sys.stdin)
    path = payload.get("transcript_path")
    final = payload.get("last_assistant_message")
    has_transcript = bool(path) and os.path.isfile(path)
    if not has_transcript and not isinstance(final, str):
        return
    root = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    log = os.path.join(root, LOG_FILE)
    os.makedirs(os.path.dirname(log), exist_ok=True)
    # Claude Code calls the Stop hook before the final text block reaches the transcript.
    texts = with_final(turn_texts(path) if has_transcript else [], final)
    lines = sum(1 for text in texts for row in text.splitlines() if row.strip())
    blocked = lines > 1 and not payload.get("stop_hook_active")
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": payload.get("session_id"),
        "words": sum(len(text.split()) for text in texts),
        "lines": lines,
        "blocked": blocked,
    }
    with open(log, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
    if blocked:
        print(json.dumps({"decision": "block", "reason": BLOCK_REASON}))


try:
    main()
except Exception:
    pass
sys.exit(0)
