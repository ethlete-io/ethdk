# B886 request log

- `et design --request-log <file>` / `DE_REQUEST_LOG=<file>`: libs/cli/src/lib/design/request-log.ts (listener on the vite httpServer, wired in serve.ts, flag parsed in design-command.ts). One JSON line per finished request: start (ISO), method, url, status, ms, bytes (socket bytesWritten delta, headers included), open (requests open at start). Off by default.
- Spec request-log.spec.ts: line with all fields; no file with the log off. Related vitest 196 files / 2014 tests green, cli:typecheck green, eslint 0 warnings.
- Built cli, restarted tmux studio-serve with DE_REQUEST_LOG=/home/tom/.cache/ethlete-design/4402-requests.jsonl; a curl on :4402 landed lines.
- QUEUE.md: B886 row replaced by a Geparkt line.
