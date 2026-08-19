# Storybook structure

Read this file when placing a `*.stories.ts` file or code used only to render stories.

- Keep the `*.stories.ts` file beside the component it documents.
- Put private host components, dummy data, and story-only helpers in `storybook/`.
- Never export Storybook-only code from the component's public barrel.
- A private `storybook/index.ts` may simplify imports into the adjacent story, but no
  production source may import it.

```plaintext
settings-form/
├── storybook/
│   ├── settings-form-storybook.component.ts
│   ├── settings-form-storybook.component.html
│   ├── settings-form-dummy-data.ts
│   └── index.ts
├── settings-form.component.ts
├── settings-form.component.html
├── settings-form.component.stories.ts
└── index.ts
```

The story file stays at the component root; only its private support code goes into
`storybook/`.
