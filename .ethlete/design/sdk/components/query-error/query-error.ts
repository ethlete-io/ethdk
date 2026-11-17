import { button } from '@ethlete/components/design/button';
import { queryError, queryErrorStyles } from '@ethlete/components/design/query-error';
import { definePart, drawing } from '@design-system';
import frame from './query-error.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Shape = 'message' | 'violations' | 'classValidator' | 'retryable' | 'empty' | 'echoesTitle' | 'network' | 'long';

type Props = {
  shape: Shape;
  alwaysAllowRetry?: boolean;
  slots?: boolean;
  color?: string;
  retry?: Interaction;
};

const SHAPES: Record<Shape, { status: number; title: string; messages: string[]; canRetry: boolean }> = {
  message: { status: 403, title: 'Forbidden', messages: ['You do not have access to this team.'], canRetry: false },
  violations: {
    status: 422,
    title: 'Unprocessable entity',
    messages: ['A name is required.', 'The email address is not valid.', 'The start date must be before the end date.'],
    canRetry: false,
  },
  classValidator: {
    status: 400,
    title: 'Bad request',
    messages: ['name should not be empty', 'email must be an email'],
    canRetry: false,
  },
  retryable: {
    status: 503,
    title: 'Service unavailable',
    messages: ['The service is briefly unavailable.'],
    canRetry: true,
  },
  empty: {
    status: 500,
    title: 'Internal server error',
    messages: ['Something went wrong on our end. Please try again later. (Code: 500)'],
    canRetry: false,
  },
  echoesTitle: {
    status: 404,
    title: 'Not found',
    messages: ['The requested resource was not found. (Code: 404)'],
    canRetry: false,
  },
  network: {
    status: 0,
    title: 'Something went wrong',
    messages: ['Something went wrong. Check your internet connection and try again later. (Code: 0)'],
    canRetry: true,
  },
  long: {
    status: 409,
    title: 'Conflict',
    messages: [
      'The fixture for matchday 14 was moved by another organiser while you were editing it, so your changes to the kick-off time, the venue and the referee assignment could not be saved. Reload the fixture and quote request league.example.com/fixtures/2026_matchday_14_home_visitors_edit_request_8f3a9c2e7b1d',
    ],
    canRetry: false,
  },
};

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const slotActions = (interaction?: Interaction) =>
  button({ label: 'Try again', size: 'sm' }).replace('<button ', `<button ${mark('retry', interaction)} `) +
  '<a class="query-error-support" href="#">Contact support</a>';

const render = ({ shape, alwaysAllowRetry, slots, color = 'danger', retry }: Props) => {
  const { status, title, messages, canRetry } = SHAPES[shape];

  return queryError({
    status,
    title: slots && status === 403 ? 'This team is private' : title,
    messages,
    color,
    retry: !slots && (canRetry || alwaysAllowRetry) ? 'Retry' : undefined,
    retryAttributes: mark('retry', retry),
    actions: slots ? slotActions(retry) : undefined,
  });
};

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    message: { shape: 'message' },
    violations: { shape: 'violations' },
    'class-validator': { shape: 'classValidator' },
    retryable: { shape: 'retryable' },
    'empty-body': { shape: 'empty' },
    'echoes-title': { shape: 'echoesTitle' },
    network: { shape: 'network' },
    'always-allow-retry': { shape: 'echoesTitle', alwaysAllowRetry: true },
    'long-message': { shape: 'long' },
    'custom-slots': { shape: 'message', slots: true },
    'retry-hover': { shape: 'retryable', retry: 'hover' },
    'retry-active': { shape: 'retryable', retry: 'active' },
    'retry-focus-visible': { shape: 'retryable', retry: 'focus-visible' },
    'slot-retry-focus-visible': { shape: 'message', slots: true, retry: 'focus-visible' },
    'brand-color': { shape: 'retryable', color: 'brand' },
    'brand-retry-hover': { shape: 'retryable', color: 'brand', retry: 'hover' },
    'brand-retry-focus-visible': { shape: 'retryable', color: 'brand', retry: 'focus-visible' },
  },
  describe: {
    message: 'A 403 Forbidden with one message and no retry; check the danger title, status and message.',
    violations: 'A 422 with three violation messages; check that each message shows as its own line.',
    'class-validator': 'A 400 with two class-validator messages; check that both show as separate lines.',
    retryable: 'A 503 that can retry; check that the Retry button shows under the message.',
    'empty-body': 'A 500 with the fallback message; check that the generic text and code show.',
    'echoes-title': 'A 404 whose message echoes the title; check that the title and message both read cleanly.',
    network: 'A network error with status 0 and Retry; check the connection message and the Retry button.',
    'always-allow-retry': 'The 404 with retry forced on; check that Retry shows though the error cannot retry.',
    'long-message':
      'A 409 with a long message and a long URL; check that the text wraps and the URL breaks in the box.',
    'custom-slots':
      'The 403 with custom Try again and Contact support actions; check that both show in place of Retry.',
    'retry-hover': 'The 503 with Retry hovered; check that only Retry takes the hover look.',
    'retry-active': 'The 503 with Retry pressed; check that the pressed look is deeper than hover.',
    'retry-focus-visible': 'The 503 with Retry focused by keyboard; check that the focus ring wraps Retry.',
    'slot-retry-focus-visible':
      'The custom Try again button focused; check that the focus ring wraps the slotted button.',
    'brand-color': 'The 503 in brand instead of danger; check that title and Retry take the brand color.',
    'brand-retry-hover': 'The brand 503 with Retry hovered; check that the hover look uses the brand color.',
    'brand-retry-focus-visible': 'The brand 503 with Retry focused; check that the focus ring uses the brand color.',
  },
  widths: [480],
  controls: {
    retry: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="query-error-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [queryErrorStyles, frame].join('\n'),
    }),
});
