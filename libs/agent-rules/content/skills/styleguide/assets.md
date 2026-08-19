# Assets

Read this file when deciding whether an asset belongs to production, local serve, a
specific app, Storybook, or shared output.

Keep assets in the workspace assets library and separate them by consumer and purpose:

```plaintext
assets/
├── my-app/
│   ├── build/
│   ├── serve/
│   └── storybook/
├── other-app/
│   ├── build/
│   ├── serve/
│   └── storybook/
└── shared/
    ├── build/
    ├── serve/
    └── storybook/
```

- `build/` contains production assets.
- `serve/` contains development-only placeholders or fixtures.
- `storybook/` contains assets used only by stories.
- `shared/` contains assets genuinely used by more than one app.
- Preserve the intended public URL through the project's `assets` configuration. Do not
  expose a `build` directory segment in the final URL.

```json
{
  "assets": [
    {
      "input": "libs/assets/src/my-app/build",
      "glob": "**/*",
      "output": "assets"
    },
    {
      "input": "libs/assets/src/my-app/serve",
      "glob": "**/*",
      "output": "assets/serve"
    },
    {
      "input": "libs/assets/src/shared/build",
      "glob": "**/*",
      "output": "assets/shared"
    }
  ]
}
```

Add only build assets to a production configuration. Add serve and Storybook assets
only to the configurations that need them.
