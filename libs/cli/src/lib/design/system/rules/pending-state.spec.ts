import { describe, expect, it } from 'vitest';
import { asyncActionsOf, drawsPending } from './pending-state';

const host = {
  path: 'src/host/design.ts',
  text: `export const designServerRestart$ = (checkout: string) => invokeHost$<State>('design_server_restart', { checkout });`,
};

const watch = {
  path: 'src/app/code-watch.ts',
  text: `export const CODE_WATCH = () => {
  const requests$ = new Subject<void>();
  const act = (action: CodeAction) => {
    requests$.next();
  };

  return { act, restarts$: requests$.asObservable() };
};`,
};

const view = {
  path: 'src/app/view.component.ts',
  text: `@Component({
  selector: 'app-view',
  template: \`<app-shell (action)="runAction($event)" />\`,
})
export class ViewComponent {
  private panel = signal('open');

  constructor() {
    injectCodeWatch().restarts$.pipe(tap(() => this.restartServer())).subscribe();
  }

  protected runAction(action: Action) {
    if (action.kind === 'collapse') this.panel.set('hidden');
    if (action.kind === 'server') this.runServer(action.action);
  }

  protected runServer(action: string) {
    if (action === 'restart') this.restartServer();
  }

  public restartServer() {
    designServerRestart$(this.checkout).subscribe();
  }
}`,
};

const shell = {
  path: 'src/app/shell.component.html',
  text: `<app-title-bar (restart)="restartCode()" (collapse)="action.emit({ kind: 'collapse' })" (stop)="action.emit({ kind: 'server', action: 'restart' })" (about)="openAbout()" />`,
};

const shellClass = {
  path: 'src/app/shell.component.ts',
  text: `@Component({ selector: 'app-shell', templateUrl: './shell.component.html' })
export class ShellComponent {
  public action = output<Action>();
  private codeWatch = injectCodeWatch();

  protected restartCode() {
    this.codeWatch.act('restartServer');
  }

  protected openAbout() {
    this.overlay.open(AboutDialogComponent, { bindings: [outputBinding('ok', () => designServerRestart$('x'))] });
  }
}`,
};

const sources = [host, watch, view, shell, shellClass];

describe('asyncActionsOf', () => {
  it('traces a click through a service subject to a host invoke', () => {
    expect(asyncActionsOf({ actions: ['restart'], selector: 'app-title-bar', sources })).toEqual([
      {
        action: 'restart',
        path: ['(restart)', 'restartCode', 'act', 'restarts$', 'restartServer', 'designServerRestart$'],
      },
    ]);
  });

  it('follows a re-emitted output into the branch its literal picks', () => {
    expect(asyncActionsOf({ actions: ['stop', 'collapse'], selector: 'app-title-bar', sources })).toEqual([
      {
        action: 'stop',
        path: ['(stop)', '(action)', 'runAction', 'runServer', 'restartServer', 'designServerRestart$'],
      },
    ]);
  });

  it('stops at a handler that opens an overlay, which is its own feedback', () => {
    expect(asyncActionsOf({ actions: ['about'], selector: 'app-title-bar', sources })).toEqual([]);
  });

  it('ignores the output when it is bound on another tag', () => {
    expect(asyncActionsOf({ actions: ['restart'], selector: 'app-other', sources })).toEqual([]);
  });
});

describe('drawsPending', () => {
  it('sees a pending, busy or spinner state in the part source', () => {
    expect(drawsPending([`export const { states } = rows({ pending: { busy: true } });`])).toBe(true);
    expect(drawsPending([`button({ label: 'Neu starten', spinner: true })`])).toBe(true);
    expect(drawsPending([`button({ label: 'Neu starten' })`])).toBe(false);
  });
});
