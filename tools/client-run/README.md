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

The reference is the old Tomflix design, call 46 B (`--reference`, default `~/dev/tomflix-clean-home/alter-katalog`),
copied into the sandbox home as `~/alter-katalog`. The image set `~/bilder-von-tom` starts with the titles of
`trap-titles.json`: each shows a trap 46 B draws, with the 46 B fields (no poster, versions, novelty) laid over the
catalog.

The start setup is `tools/scripts/clean-slate-run/overlays/tomflix` plus `et design product new tomflix --base @ethlete/components --from-project tomflix --colors dark --accent #e50914`, run and committed in the copy: the run starts on a dark colour base.

## When it runs

There is no schedule: the human names a client run, and the doc session starts it.

Each run uses Claude usage and leaves its run dir (about 1 GB with `node_modules`) under `~/dev/client-runs`.
