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
  note: "The SDK query error (et-query-error), drawn by its mock from @ethlete/components/design, framed as its story does (max 520px, surface fill, 14px text). It is an et-banner of type error with a role=alert host: a 12px-rounded box tinted with 8% of the theme primary and edged with 1px of 24% primary, the 20px triangle icon in ink, an h3 title (14px, weight 600, full surface text), the message as a 14px muted paragraph or, for violations, a disc list, and a filled md et-button Retry when the retry policy allows one. The colour is the app's type error theme (danger here); the color input overrides it (brand-* states, as for a failure that should not read as alarming). States: message (403), violations (422 Symfony list), class-validator (400 list), retryable (503, retry), empty-body (500, status-table message with code, no retry: 500 is not retried by default), echoes-title (404, message replaced by the status text), network (status 0, connection failure, retry), always-allow-retry (404 with alwaysAllowRetry), long-message (wrapping text with an unbroken value), custom-slots (etQueryErrorTitle and etQueryErrorActions: sm button + a story link), retry-hover, retry-active, retry-focus-visible, slot-retry-focus-visible, brand-color, brand-retry-hover, brand-retry-focus-visible.",
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
  widths: [480],
  controls: {
    retry: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="query-error-frame">${render(props)}</div>`,
      styles: [queryErrorStyles, frame].join('\n'),
    }),
});
