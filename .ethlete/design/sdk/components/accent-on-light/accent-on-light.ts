import { definePart, drawing } from '@design-system';
import { controls } from './shared/controls';
import styles from './accent-on-light.css?inline';

export default definePart({
  note: 'The brand mint on light controls: checkbox checked, mixed and off, switch on, a radio group, a segmented button group and a choice-field card, drawn by the real components under one accent rule.',
  madeBy: ['claude-opus-5-5'],
  states: { default: {} },
  describe: {
    default:
      'Checkbox, switch, radio group, segmented buttons and a choice card in the brand mint on light; check that every checked mark stays visible against the light page.',
  },
  render: async () => drawing({ body: await controls(), styles }),
});
