import { definePart, drawing } from '@design-system';
import button from '@system/components/button';

type Props = { error: boolean };

export default definePart<Props>({
  note: 'The login dialog. It has no URL of its own, so a page shows it in a "login open" state.',
  states: { rest: { error: false }, error: { error: true } },
  render: async ({ error }) => {
    const submit = await button.render({ label: 'Log in', variant: 'solid' });

    return drawing({
      body: `<div class="lab-login flex flex-col" role="dialog" aria-label="Log in"><h2 class="m-0">Log in</h2><label class="flex flex-col">Email<input value="ada@filmbox.test"></label><label class="flex flex-col">Password<input type="password" value="••••••"></label>${
        error ? '<p class="lab-login-error m-0">That password does not match.</p>' : ''
      }${submit.body}</div>`,
      styles: `${submit.styles}
        .lab-login { gap: 12px; width: 320px; padding: 24px; border-radius: 12px; background: var(--lab-surface); color: var(--lab-ink); font-family: sans-serif; }
        .lab-login h2 { font-size: 20px; }
        .lab-login label { gap: 4px; font-size: 13px; }
        .lab-login input { padding: 8px; border: 1px solid var(--lab-ink); border-radius: 6px; font: inherit; }
        .lab-login-error { color: var(--lab-accent); font-size: 13px; }
      `,
    });
  },
});
