# Client run (B687)

`yarn client-run` copies `~/dev/tomflix` into `~/dev/client-runs/<stamp>/tomflix`, lets a headless client agent
work through `order.md` in the clean-slate sandbox, and judges the result from what Studio would show:
shots, frames, and the tree. The judge writes `findings.md` and `shots.json` into the run dir.

```bash
yarn client-run                                  # builds a scratch SDK (~5 min), runs, judges, removes the scratch
yarn client-run --sdk <built sdk copy>           # reuses a scratch copy with dist/libs/{cli,agent-rules}
yarn client-run --judge <run dir> [--sdk <dir>]  # judges an earlier run again, with that copy's cli
```

`expect.json` names what the order asks for; the judge reports a missing sketch or a wrong variant count.

## Running it on a schedule

Nothing is installed by the repo. To run it every Monday and Thursday at 03:30, add this line with `crontab -e`:

```cron
30 3 * * 1,4 cd $HOME/dev/ethlete-sdk && PATH=$HOME/.local/share/fnm/aliases/default/bin:$HOME/.local/bin:/usr/bin:/bin NX_NO_CLOUD=true yarn client-run >> $HOME/dev/client-runs/cron.log 2>&1
```

Each run uses Claude usage and leaves its run dir (about 1 GB with `node_modules`) under `~/dev/client-runs`.
