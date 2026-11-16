---
status: accepted
built: 88492ba51
decided: 2026-11-16
source: doc-agent session 2026-11-16, morning round
---

# The alert dialog gets an extra content slot

fifagg showed the user's e-mail and name as a block in a confirm dialog; the SDK alert dialog has only a message text,
so it now sits in the message. Asked whether the alert dialog should get an optional slot under the message, with the
recommendation yes, the human answered "q2ok".

The SDK alert dialog gets an optional slot under the message that takes an app component or template.
