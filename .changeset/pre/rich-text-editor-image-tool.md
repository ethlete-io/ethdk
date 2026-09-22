---
'@ethlete/components': minor
---

Rich text editor: `provideRichTextEditorImageTool({ upload })` embeds images as `![alt](url)` - pick,
paste or drop a file, uploaded by your handler (a promise, an observable, or a `createDropzoneUpload`
config for real progress), with a placeholder that never touches the value and a popover for alt text.
Tool definitions gained `paste`, `drop` and `click` content hooks; without the tool, pasted image
files are refused rather than becoming `blob:` URLs in the value.
