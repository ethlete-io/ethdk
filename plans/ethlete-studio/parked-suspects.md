# Parked suspects

One line per Suspect without proof (ADR 0276). A second time makes it a finding with a number; then delete the line here.

- eslint-plugin checkJs (Mac, 989): allowJs+checkJs gives 271 errors; its new typecheck target checks no file. Measured, not blocking. Parked (ADR 0276).
- slice typecheck gap (Mac, 920): a slice check ran tsc with the app tsconfig only, so a spec type error reached push:suite. Parked (ADR 0276).
- sketch ready note spam (Linux, 945): `sketch ready` prints about 30 UNBOUND-INPUT note lines per variant. Parked (ADR 0276).
- stale baseline entries (Mac, 948): design check keeps reporting baseline entries that no longer fire. Parked (ADR 0276).
- compare mid-run rebuild (Mac, 949): compare does not say when the app rebuilt in the middle of a run. Parked (ADR 0276).
- jsdom and @layer (Mac, 950): jsdom ignores rules inside `@layer`, so a spec of an SDK component needs a hand shim. Parked (ADR 0276).
- sketch withdraw default reason (Mac, 952): `sketch withdraw` without `--reason` wrote a default reason that did not match the variant. Parked (ADR 0276).
- --lint refuses --product (Mac, 953): `design check --lint` refuses `--product` while the sketch commands want it. Parked (ADR 0276).
- e2e --load timing (Mac, 962): `studio:e2e --load` starts the busy loops before the Studio build, so load reaches 100-135 instead of 28-30. Parked (ADR 0276).
- stale-CLI untracked files (Mac, 964): the stale-CLI diff misses untracked libs/cli files, and the copy `et:design` picked is not probed. Parked (ADR 0276).
- baselined warnings drown (Linux, 970): baselined DROPPED-PROP hits print as warnings on every check and drown the real ones. Parked (ADR 0276).
- ACTION-UNDECLARED count jump (Linux, 971): the sdk ACTION-UNDECLARED count moved from 852 to 1041 between two runs minutes apart. Parked (ADR 0276).
- token map sizes (Linux, 972): Studio `sdk-token-map.css` ties only md and xs `et-button` to `--control-*` tokens. Parked (ADR 0276).
- compare --base long list (Linux, 975): `compare --base` over a wide range prints one line per changed state. Parked (ADR 0276).
- reopened picked sketch (Linux, 978): a picked sketch that `sketch ready` reopens may show a mixed state in Studio. Parked (ADR 0276).
- cli copies affected graph (Linux, 980): other cli copies of SDK source have the same affected-graph gap as the surface-interactive copy. Parked (ADR 0276).
- shot source=app clip/view (Linux, 987): `clip` and `view` on `shot?source=app` are likely ignored like the theme params were. Parked (ADR 0276).
- e2e ECONNRESET (Mac, 992): an e2e case failed with `read ECONNRESET` in the shot ETag fetch at load 33.5. Parked (ADR 0276).
- e2e worker count (Mac, 994): the e2e step of push:suite takes 7 min against a 5 min budget with 3 workers. Parked (ADR 0276).
- sketch check refusal order (Linux, 995): `sketch check` exits 1 on UTILITY-CSS lines before the look-alike step, so a refusal hides later steps. Parked (ADR 0276).
