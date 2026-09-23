import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Design tool · call 4',
  headline: 'What may the integrated CLI do?',
  intro:
    'A Tauri shell can run local tools, read workspace state, and host Codex or Claude. The boundary determines whether that power speeds up decisions or makes the app an opaque operator.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'The agent boundary',
      note: 'The agent drafts calls and precise action lists, while every workspace write or system command waits for explicit approval. Autopilot discovers problems too late; a raw command deck leaves coordination manual.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Draft, then approve',
      claim:
        'The agent researches, draws options, and stages a precise action list; the reviewer approves each state-changing run.',
      cost: 'One approval remains before a write or command, even for trusted work.',
      verdict: 'chosen',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Autonomous lane',
      claim:
        'The agent can create calls, run checks, and update the workspace continuously; the reviewer reviews its completed work.',
      cost: 'Fastest throughput, but mistakes and noisy changes are discovered after the fact.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Native command deck',
      claim: 'The app exposes system commands and terminals while the human runs every action directly.',
      cost: 'It gains native access but leaves the reviewer doing the coordination work.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
  ],
});
