# Rack Linux side (B814 step 4)

Picture suites run on the rack (`ssh trbor@192.168.1.115`, Windows 11 Pro 25H2, 32 threads, 64 GB) in a WSL 2
distro with Docker inside it, in the Playwright image CI pins.

## State

Set up on 2026-11-26: distro `ethlete` (Ubuntu 24.04, WSL 2, systemd), `docker.io`, user `trbor` in group `docker`,
`vmIdleTimeout=-1`, the CI image pulled by digest.

## Setup from scratch

From tank, in the rack's default PowerShell:

```powershell
wsl --install --no-distribution --web-download
wsl --install -d Ubuntu-24.04 --name ethlete --no-launch --web-download
wsl -d ethlete -u root -- bash -c "apt-get update && apt-get install -y docker.io git && usermod -aG docker \$(id -nu 1000)"
```

Add `[boot]\nsystemd=true` to `/etc/wsl.conf` in the distro so `dockerd` starts with it, then `wsl --terminate ethlete`.
`vmIdleTimeout=-1` in `.wslconfig` keeps the WSL VM up, not the distro: WSL still stops `ethlete` some seconds after
its last `wsl.exe` session, and the next run pays about 3 s for the distro boot (systemd, dockerd).

## Running a suite

`rack-docker-run.sh <sha> <slot> -- <suite command>` runs inside the distro. It fetches `<sha>` from the
Windows-side mirror (`/mnt/c/Users/trbor/ethlete-mirror.git`, which `remote-run.mjs` fills) into
`~/rack-linux/<slot>` on ext4, runs `yarn install` in the container, then the suite. `node_modules` stays per slot
in the Linux checkout: the Windows worktree's modules hold Windows binaries.

Git reads the mirror on `/mnt/c` through 9p at about 150 objects/s (a first fetch did not finish in 17 min), so the
script copies the mirror's objects to `~/rack-linux/mirror.git` on ext4 and fetches `--depth 2` from there (the parent makes a `<parent>..<sha>` range work).
The CI image has no C linker or Rust, and Studio e2e builds its design host with cargo: the script builds a local
`rack-linux-ci:<digest>` image on top of the pinned one (build-essential, rustup minimal) once per digest. Browsers
and fonts stay those of the pin. `target/` survives `git clean`, the cargo registry lives in `~/rack-linux/.cache`.

The container runs as the distro user (uid 1000, `ubuntu` in the image) so the checkout stays writable; corepack
and the yarn cache live in `~/rack-linux/.cache`. `remote-run.mjs --host rack --linux` writes the working-tree copy
of the script to `C:\Users\trbor\ethlete-rr\` after its bundle transfer, then calls it from Git Bash with
`MSYS_NO_PATHCONV=1 wsl.exe -d ethlete -- bash /mnt/c/Users/trbor/ethlete-rr/rack-docker-run.sh <sha> <slot> -- <suite>`
(without `MSYS_NO_PATHCONV` Git Bash rewrites `/mnt/c/...` to `C:/Program Files/Git/mnt/c/...`).

The container reaches services on the rack's Windows side or the distro at `host.docker.internal`.

## The `next` mirror (B815)

`node tools/scripts/next-mirror.mjs watch` polls `refs/heads/next` every 15 s and runs
`push-suite.mjs --only lint,tools,coverage <parent>..<sha>` for each new commit, oldest first, through
`remote-run --host rack --linux --slot mirror`. It writes `/tmp/ethlete-mirror/<sha>.json` (`green`, `red` with the
failing step, or `error` for an infrastructure failure), appends one line to `/tmp/ethlete-mirror/verdicts.log` and
replaces `latest.txt`; `next-mirror.mjs status` prints the latest line. `next-mirror.mjs run <rev>` mirrors one
commit. It only reports: it never reverts or pushes. Stop the watcher to switch it off; `state.json` keeps the last
mirrored commit, delete it to start from the current head.
