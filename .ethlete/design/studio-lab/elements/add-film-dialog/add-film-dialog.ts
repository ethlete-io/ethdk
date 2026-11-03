import { definePart, drawing } from '@design-system';
import button from '@system/components/button';

export default definePart({
  note: 'The add-a-film dialog. It has no URL of its own, so the library shows it in an "add open" state.',
  states: { rest: {} },
  render: async () => {
    const save = await button.render({ label: 'Save film', variant: 'solid' });

    return drawing({
      body: `<div class="lab-add flex flex-col" role="dialog" aria-label="Add a film"><h2 class="m-0">Add a film</h2><label class="flex flex-col">Title<input value="Night Train"></label><label class="flex flex-col">Year<input value="1998"></label>${save.body}</div>`,
      styles: `${save.styles}
        .lab-add { gap: 12px; width: 320px; padding: 24px; border-radius: 12px; background: var(--lab-surface); color: var(--lab-ink); font-family: sans-serif; }
        .lab-add h2 { font-size: 20px; }
        .lab-add label { gap: 4px; font-size: 13px; }
        .lab-add input { padding: 8px; border: 1px solid var(--lab-ink); border-radius: 6px; font: inherit; }
      `,
    });
  },
});
