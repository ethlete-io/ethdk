# Proposal: custom content for one notification

Status: approved and implemented on 2026-10-25; release pending.

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

## Decisions

1. Component plus inputs; no `TemplateRef`.
2. Below the message, preserving the title and status accent.

## Follow-ups

Changeset, notification guide with a live example, story and regression tests are included. When it ships,
tell tomflix to drop its second notification manager.
