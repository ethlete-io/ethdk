# Needed

- Migrate flow

  - Migrate query client to query client config
  - Migrate old query creators to new style
  - Add interop to be able to use the migrated creators in the old style
    - myQuery.createSignal() -> legacyInteropQueryCreator(myQuery).createSignal()
    - OR
    - add interop query creators next to the migrated ones and use them in apps instead of the migrated ones
  - Storybook Docs

# Optional

- Maybe Migrate

  - Migrate auth provider?
  - Provide query client and auth provider it in the app config?

- Devtools
