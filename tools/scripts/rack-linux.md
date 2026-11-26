# Rack Linux side (B814 step 4)

Picture suites run on the rack (`ssh trbor@192.168.1.115`, Windows 11 Pro 25H2, 32 threads, 64 GB) in a WSL 2
distro with Docker inside it, in the Playwright image CI pins.

## State

- `Microsoft-Windows-Subsystem-Linux` and `VirtualMachinePlatform` enabled with `dism /norestart` (exit 3010).
- Not done yet: the restart that activates them, the WSL package, the distro, Docker, the image.

## Setup after the restart

From tank, in the rack's default PowerShell:

```powershell
wsl --install --no-distribution --web-download
wsl --install -d Ubuntu-24.04 --name ethlete --no-launch --web-download
wsl -d ethlete -u root -- bash -c "apt-get update && apt-get install -y docker.io git && usermod -aG docker \$(id -nu 1000)"
```

Add `[boot]\nsystemd=true` to `/etc/wsl.conf` in the distro so `dockerd` starts with it, then `wsl --terminate ethlete`.
WSL stops an idle distro after a minute; a `.wslconfig` with `vmIdleTimeout=-1` keeps Docker warm between runs.

## Running a suite

`rack-docker-run.sh <sha> <slot> -- <suite command>` runs inside the distro. It fetches `<sha>` from the
Windows-side mirror (`/mnt/c/Users/trbor/ethlete-mirror.git`, which `remote-run.mjs` fills) into
`~/rack-linux/<slot>` on ext4, runs `yarn install` in the container, then the suite. `node_modules` stays per slot
in the Linux checkout: the Windows worktree's modules hold Windows binaries.

`remote-run.mjs --host rack --linux` calls it after its push to the mirror, through PowerShell:

```
wsl -d ethlete -- bash -lc 'bash <(git -C /mnt/c/Users/trbor/ethlete-mirror.git show <sha>:tools/scripts/rack-docker-run.sh) <sha> <slot> -- <suite>'
```

The container reaches services on the rack's Windows side or the distro at `host.docker.internal`.
