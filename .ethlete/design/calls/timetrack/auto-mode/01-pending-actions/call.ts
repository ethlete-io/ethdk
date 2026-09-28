import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Auto mode · call 1',
  headline: 'Where the day shows an action that waits for your approval',
  intro:
    'Today every queued write opens “Waiting for your approval”: a modal with each request’s raw JSON, Reject and Approve per item, and “Approve all (2)”. It says what an op is, not what it would do to the day. Each variant draws the same afternoon, 01:30 – 05:00 PM at 8rem per hour, now 04:10 PM, with three items waiting: auto mode’s jira.create for the 45m unnamed code band, a Claude Code worklog.add of 15m on FIP-3006, and a Claude Code tempo.sync for Fri 25 Sep that has no band here and is approved one by one.',
  frameWidth: 860,
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      name: 'A · Preview on the band',
      claim:
        'Each action draws its result where it lands: the band turns into the row it would become, dashed in the accent, with one line saying who asks and ✓ / ✕; the action with no band waits in a header pill, so the day itself is the preview.',
      cost: 'The previewed band hides what is there today, a 15m or shorter band has room for a verb and two buttons only, and the header pill is a second home for the same kind of item.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      name: 'B · An auto-mode lane',
      claim:
        'A narrow lane at the right edge holds one card per action at its time, with a readable diff (ticket, summary, span), “Show details” for the full text and ✓ / ✕, and an accent edge on the band it touches; the no-band action sits at the lane’s top.',
      cost: 'The lane takes 24rem from the day for as long as anything waits, and cards taller than their span drift off it and stack, so a busy hour needs the edge marks to tell which band a card means.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      name: 'C · A header queue with a linked highlight',
      claim:
        'A compact list under the day header replaces the modal, one readable line per action with ✓ / ✕ and “Approve all (2)”; hovering or focusing a line outlines its band and fades the rest, and each affected band carries an accent dot.',
      cost: 'The result is never drawn, only named, and the list pushes the timeline down by one line per waiting item; the link to a band works only while a pointer or focus is on the line.',
      load: () => import('./variant-c'),
    },
  ],
});
