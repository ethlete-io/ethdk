---
'@ethlete/components': minor
---

Rich text editor: `provideRichTextEditorImageTool({ upload })` embeds images as `![alt](url)` - pick,
paste or drop a file, uploaded by your handler (a promise/observable, or a `createDropzoneUpload`
config for real progress), with a placeholder that never touches the value and a popover for alt text.

- Tool definitions gained `paste`, `drop` and `click` content hooks.
- Without the tool, pasted/dropped image files are refused instead of becoming `blob:` URLs in the value.
