export type AgentBoundary = 'approve' | 'auto' | 'deck';
import { css, drawing, html } from '@design-explore';

export const agentBoundary = ({ mode }: { mode: AgentBoundary }) => {
  const title = mode === 'auto' ? 'Agent run' : 'Review change';
  const copy =
    mode === 'deck' ? 'A native workbench keeps the decision visible.' : 'The agent proposes a bounded change.';
  const action = mode === 'auto' ? 'Run automatically' : 'Approve run';
  const sideTitle = mode === 'deck' ? 'Workbench' : 'Guardrail';
  const sideCopy = 'The reviewer remains in control.';
  const button = mode === 'auto' ? 'Pause' : 'Review';
  const foot = 'One deliberate next step.';

  return drawing({
    body: html`<div class="agent">
      <header><b>DESIGN REVIEW</b><span>workspace: ethlete-sdk</span><small>native · connected</small></header>
      <main class="${mode === 'deck' && 'deck'}">
        <section class="conversation">
          <span>AGENT</span>
          <h1>${title}</h1>
          <p>${copy}</p>
          <div class="steps">
            <b>✓ Read active call and decision history</b><b>✓ Draft comparison options</b
            ><b class="${mode !== 'auto' && 'pending'}">${action}</b>
          </div>
        </section>
        <aside>
          <span>${mode === 'deck' ? 'COMMAND DECK' : 'PROPOSED ACTIONS'}</span><b>${sideTitle}</b>
          <p>${sideCopy}</p>
          <button>${button}</button><small>${foot}</small>
        </aside>
      </main>
    </div>`,
    styles: css`
      .agent {
        min-height: 620px;
        background: #171717;
        color: #ddd7ca;
        font:
          13px/1.45 ui-monospace,
          SFMono-Regular,
          monospace;
      }
      .agent header {
        display: flex;
        gap: 20px;
        padding: 16px 22px;
        border-bottom: 1px solid #3c3932;
      }
      .agent header b {
        letter-spacing: 0.12em;
      }
      .agent header span {
        color: #aaa396;
      }
      .agent header small {
        margin-left: auto;
        color: #8ed2bb;
      }
      .agent main {
        display: grid;
        grid-template-columns: 1fr 290px;
        min-height: 570px;
      }
      .conversation {
        padding: 42px;
      }
      .conversation > span,
      .agent aside > span {
        color: #8ed2bb;
        font-size: 10px;
        letter-spacing: 0.12em;
      }
      .conversation h1 {
        margin: 10px 0;
        color: #f0eadf;
        font: 500 25px/1.2 system-ui;
      }
      .conversation p {
        max-width: 590px;
        color: #aaa396;
        font: 15px/1.6 system-ui;
      }
      .steps {
        display: grid;
        gap: 1px;
        margin-top: 38px;
        border: 1px solid #454039;
      }
      .steps b {
        padding: 13px 15px;
        background: #211f1b;
        font-weight: 400;
      }
      .steps .pending {
        color: #f0d18a;
      }
      .agent aside {
        display: flex;
        flex-direction: column;
        gap: 15px;
        padding: 28px 20px;
        border-left: 1px solid #454039;
        background: #1d241e;
      }
      .agent aside > b {
        color: #f0eadf;
        font: 500 18px system-ui;
      }
      .agent aside p {
        color: #aaa396;
      }
      .agent button {
        padding: 10px;
        border: 1px solid #6e887b;
        background: #8ed2bb;
        color: #17211b;
        font: inherit;
      }
      .agent aside small {
        margin-top: auto;
        color: #827c70;
      }
      .deck aside {
        background: #211f1b;
      }
      .deck aside button {
        background: #29362e;
        color: #b5dfcd;
      }
    `,
  });
};
