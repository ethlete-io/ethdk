# Handoff: coordinator, slices of the migration

## Running

- !11 (slice 1) and !12 (slice 2) waiting on pipelines.

## Next steps

1. !11 and !12: merge when green (only "E2E check" red -> label + new pipeline), remove their worktrees.
2. Spawn slice 3 (libs/shared) with the same brief, then slice 4 (libs/public).
