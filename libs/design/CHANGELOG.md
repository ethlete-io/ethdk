# @ethlete/design

## 0.0.1-next.0

### Patch Changes

- A sketch listing waits briefly for a picture whose draw is already running, so the frame of that state is no longer left out.
- Move the helpers cli and design share into the private `libs/cli-core` lib; the published `@ethlete/cli` keeps the same file layout.
- Move the design tool into the private `libs/design` lib; the published `@ethlete/cli` keeps the same file layout.
