# Parked suspects

One line per Suspect without proof (ADR 0276). A second time makes it a finding with a number; then delete the line here.

- sketch ready note spam (Linux, 945): `sketch ready` prints about 30 UNBOUND-INPUT note lines per variant. Parked (ADR 0276).
- Nx daemon tmp leak (Linux, 991): a daemon in another throwaway checkout still leaks /tmp/tmp-<pid>-* (nx@latest install, removed only on clean shutdown); scratch copies and e2e-check builds run with NX_DAEMON=false (9697e9e7c); the hourly timer catches the rest. Not measured live. Parked (ADR 0276).
- e2e-check.spec idle-limit test (Mac, 993 run): "a suite that goes silent is killed after the idle limit" failed 1x in one test:tools run, passed alone. Parked (ADR 0276).
