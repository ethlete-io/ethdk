#!/usr/bin/env python3
"""Stop hook: logs the chat text of a builder turn and blocks a turn that ends with more than one line.

Only runs in a session started with `--role builder` (ETHLETE_AGENT_ROLE=builder). Appends one
JSON line to .claude/builder-chat-words.jsonl: timestamp, session_id, words, lines, committed, reported, blocked.
It blocks the stop once (not again while stop_hook_active is set) when the turn's text blocks and
last_assistant_message hold more than one non-empty line, or when the turn ran `git commit` or `git push` and sent
no report (no SendMessage, no `agent-sessions send`). It always exits 0.
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
REPORT_REASON = (
    "builder: this turn committed or pushed and sent no report. Send it to the grill session with SendMessage "
    "or `agent-sessions.mjs send`, then end the turn."
)
SEPARATORS = ";&|()\n"
GIT_OPTIONS_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}


def is_prompt(entry):
    if entry.get("type") != "user":
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )


def turn_entries(path):
    texts = []
    tools = []
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
                tools = []
            elif entry.get("type") == "assistant":
                content = (entry.get("message") or {}).get("content")
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        if block.get("type") == "text":
                            texts.append(str(block.get("text", "")))
                        elif block.get("type") == "tool_use":
                            tools.append(block)
    return texts, tools


def bash_commands(tools):
    for tool in tools:
        if tool.get("name") == "Bash":
            command = (tool.get("input") or {}).get("command")
            if isinstance(command, str):
                yield command


def read_heredoc_delimiter(command, index):
    strip_tabs = command.startswith("-", index)
    if strip_tabs:
        index += 1
    while index < len(command) and command[index] in " \t":
        index += 1
    delimiter = []
    while index < len(command) and command[index] not in " \t" + SEPARATORS + "<>":
        char = command[index]
        if char in "'\"":
            end = command.find(char, index + 1)
            end = len(command) if end == -1 else end
            delimiter.append(command[index + 1 : end])
            index = end + 1
        else:
            if char != "\\":
                delimiter.append(char)
            index += 1
    return "".join(delimiter), strip_tabs, index


def skip_heredoc_bodies(command, index, heredocs):
    for delimiter, strip_tabs in heredocs:
        while index < len(command):
            end = command.find("\n", index)
            end = len(command) if end == -1 else end
            row = command[index:end]
            index = end + 1
            if (row.lstrip("\t") if strip_tabs else row) == delimiter:
                break
    return index


def simple_commands(command):
    commands = [[]]
    word = None
    heredocs = []
    index = 0

    def end_word():
        nonlocal word
        if word is not None:
            commands[-1].append(word)
            word = None

    def end_command():
        end_word()
        if commands[-1]:
            commands.append([])

    while index < len(command):
        char = command[index]
        if char == "\\":
            if command.startswith("\n", index + 1):
                index += 2
                continue
            word = (word or "") + command[index + 1 : index + 2]
            index += 2
        elif char == "'":
            end = command.find("'", index + 1)
            end = len(command) if end == -1 else end
            word = (word or "") + command[index + 1 : end]
            index = end + 1
        elif char == '"':
            index += 1
            chars = []
            while index < len(command) and command[index] != '"':
                if command[index] == "\\" and index + 1 < len(command):
                    index += 1
                chars.append(command[index])
                index += 1
            word = (word or "") + "".join(chars)
            index += 1
        elif char == "#" and word is None:
            end = command.find("\n", index)
            index = len(command) if end == -1 else end
        elif command.startswith("<<<", index):
            end_word()
            index += 3
        elif command.startswith("<<", index):
            end_word()
            delimiter, strip_tabs, index = read_heredoc_delimiter(command, index + 2)
            heredocs.append((delimiter, strip_tabs))
        elif char == "\n":
            end_command()
            index = skip_heredoc_bodies(command, index + 1, heredocs)
            heredocs = []
        elif char in SEPARATORS:
            end_command()
            index += 1
        elif char in " \t":
            end_word()
            index += 1
        else:
            word = (word or "") + char
            index += 1
    end_command()
    return [words for words in commands if words]


def command_words(words):
    index = 0
    while index < len(words) and "=" in words[index] and not words[index].startswith("-"):
        index += 1
    return words[index:]


def is_git_commit(words):
    words = command_words(words)
    if not words or os.path.basename(words[0]) != "git":
        return False
    index = 1
    while index < len(words) and words[index].startswith("-"):
        index += 2 if words[index] in GIT_OPTIONS_WITH_VALUE else 1
    return index < len(words) and words[index] in ("commit", "push")


def is_report_send(words):
    words = command_words(words)
    if len(words) < 3:
        return False
    if words[0] == "yarn":
        return words[1:3] == ["agents:sessions", "send"]
    if os.path.basename(words[0]) != "node":
        return False
    scripts = [word for word in words[1:] if not word.startswith("-")]
    return len(scripts) >= 2 and os.path.basename(scripts[0]) == "agent-sessions.mjs" and scripts[1] == "send"


def bash_simple_commands(tools):
    for command in bash_commands(tools):
        yield from simple_commands(command)


def has_commit(tools):
    return any(is_git_commit(words) for words in bash_simple_commands(tools))


def has_report(tools):
    return any(tool.get("name") == "SendMessage" for tool in tools) or any(
        is_report_send(words) for words in bash_simple_commands(tools)
    )


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
    texts, tools = turn_entries(path) if has_transcript else ([], [])
    texts = with_final(texts, final)
    lines = sum(1 for text in texts for row in text.splitlines() if row.strip())
    committed = has_commit(tools)
    reported = has_report(tools)
    unreported = committed and not reported
    blocked = (lines > 1 or unreported) and not payload.get("stop_hook_active")
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": payload.get("session_id"),
        "words": sum(len(text.split()) for text in texts),
        "lines": lines,
        "committed": committed,
        "reported": reported,
        "blocked": blocked,
    }
    with open(log, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
    if blocked:
        reason = REPORT_REASON if unreported else BLOCK_REASON
        print(json.dumps({"decision": "block", "reason": reason}))


try:
    main()
except Exception:
    pass
sys.exit(0)
