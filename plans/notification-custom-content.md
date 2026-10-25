# Proposal: custom content for one notification

Status: noted on 2026-10-25. Not started. Waits for the user's go.

## The problem

A notification cannot show custom content. `NotificationConfig`
(`libs/components/src/lib/notification/notification-config.ts`) has only `title`, `message`, `actions`,
`duration`, `progress`, `id` and `icon`, and `et-notification` has no content slot.

The tomflix app needs to show badge medals in an unlock toast. As a workaround, it adds a second
`provideNotificationManager({ component })` on one component and passes the data through a root signal.
This causes two problems:

- The second stack overlaps the app-wide stack in the same corner.
- The custom toast gets no status accent.

Workaround code in tomflix: `libs/domain/tomflix/src/lib/achievements/achievement-toast.ts` and
`achievement-watcher.ts`.

## Recommendation

Add an optional `content` field to `NotificationConfig`: a component plus its inputs. `et-notification`
renders it inside the normal toast, in the normal stack, with the status accent. The setting stays
on each call, so no DI default or second manager is needed.

## Open questions

1. Component only, or also a `TemplateRef`? Recommendation: component plus inputs first. A template
   cannot cross a service call cleanly.
2. Where does the content go: below the message, or in place of it? Recommendation: below the message,
   so the title and the status accent stay.

## Follow-ups

Changeset, the notification docs guide in `apps/docs/components/`, and a story. When it ships, tell
tomflix to drop its second notification manager.
