import { definePart, drawing, html } from '@design-system';

type Props = { question: string };

const QUESTION = 'Wo soll der Reset-Knopf der Zoom-Pille stehen?';

export const sketchQuestion = ({
  question,
  class: extra = '',
  attrs = '',
}: {
  question: string;
  class?: string;
  attrs?: string;
}) =>
  html`<p class="m-0 truncate text-ui-md font-ui-medium text-et-surface ${extra}" ${attrs} data-sk-question>
    ${question}
  </p>`;

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-question/sketch-question.component.ts',
  note: 'The open question of a sketch round as one line of medium text above the round picker of the Sketches page. A question longer than the line ends in an ellipsis. The page places it; it draws no frame of its own.',
  madeBy: ['claude-opus-5-5'],
  widths: [640],
  states: {
    question: { question: QUESTION },
    long: {
      question: `${QUESTION} Und soll Einpassen neben ihm bleiben, wenn die Pille schmaler wird als die Zoomstufe mit ihrem Prozentzeichen?`,
    },
  },
  describe: {
    question: 'An open round question; check the one medium line in the surface text colour.',
    long: 'A question longer than 640 px; check that it stays on one line and ends in an ellipsis.',
  },
  controls: {},
  render: ({ question }: Props) => drawing({ body: sketchQuestion({ question }) }),
});
