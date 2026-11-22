---
status: accepted
open: B666
decided: 2026-11-22
source: doc-agent session 2026-11-22 (evening), B666
---

# Windows and macOS signing is set up in one batch

The Windows CEF release (ADR 0400) builds an unsigned installer, although ADR 0389 says it ships signed. The macOS
bundle has a self-signed identity and is not notarized. The doc agent recommended Azure Trusted Signing for Windows: a
cloud service, no USB token, a small monthly cost. The human (German, verbatim): "q2ok aber das kommt dann in einem
rutsch wie auch bei apple".

Windows signs with Azure Trusted Signing. Its setup and the Apple signing are done together in one batch with the human,
not one platform at a time.
