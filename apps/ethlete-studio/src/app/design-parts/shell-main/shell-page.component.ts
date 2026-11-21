import { Component, computed, DestroyRef, inject, input, output, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, Observable } from 'rxjs';
import { closeWindow$, minimizeWindow$, toggleMaximizeWindow$, WINDOW_CHROME } from '../../../host/window';
import { openHelp$ } from '../../../host/about';
import { injectUpdateCheck } from '../../update-check';
import { rememberView, rememberedView } from '../../studio-view/remembered';
import { DesignServerAction, DesignServerStatus, StudioMenuComponent } from '../studio-menu/studio-menu.component';
import { ServerCrash, ShellMainComponent, ShellSection, StartPhase } from './shell-main.component';
import { clampSideWidth, SIDE_WIDTH } from './side-width';

export type ShellState = {
  product: string;
  products: string[];
  logos?: Record<string, string | null | undefined>;
  project: string;
  projects: string[];
  panel: 'open' | 'hidden';
  server?: 'running' | 'starting' | 'unanswered' | 'stopped' | 'crashed';
  serverStale?: boolean;
  serverUrl?: string;
  serverLog?: readonly string[];
  startPhase?: { phase: StartPhase; phaseMs: number } | null;
  serverCrash?: ServerCrash | null;
  busy?: boolean;
};

export type ShellAction =
  | { kind: 'collapse' }
  | { kind: 'section'; section: ShellSection }
  | { kind: 'product'; name: string }
  | { kind: 'project'; name: string }
  | { kind: 'openProject' }
  | { kind: 'scan' }
  | { kind: 'remove-project' }
  | { kind: 'reload' }
  | { kind: 'menuOpened' }
  | { kind: 'server'; action: DesignServerAction };

export const SHELL_SAMPLE: ShellState = {
  product: 'studio',
  products: ['studio', 'studio-lab', 'sdk', 'timetrack', 'docs'],
  project: 'ethlete-sdk',
  projects: ['ethlete-sdk', 'fut-frontend', 'design-playground'],
  panel: 'open',
};

@Component({
  selector: 'ethlete-shell-page',
  template: `
    <ethlete-shell-main
      [(systemPicker)]="systemPicker"
      [section]="section()"
      [product]="shell().product"
      [products]="shell().products"
      [logos]="shell().logos ?? {}"
      [panel]="shell().panel"
      [server]="screen()"
      [phase]="shell().startPhase?.phase ?? 'starting'"
      [phaseMs]="shell().startPhase?.phaseMs ?? 0"
      [log]="shell().serverLog ?? []"
      [serverUrl]="shell().serverUrl ?? ''"
      [crash]="shell().serverCrash ?? null"
      [chrome]="chrome()"
      [update]="!!updateCheck.version()"
      [sideWidth]="sideWidth()"
      (sideWidthChange)="setSideWidth($event)"
      (collapse)="action.emit({ kind: 'collapse' })"
      (sectionChange)="action.emit({ kind: 'section', section: $event })"
      (productChange)="action.emit({ kind: 'product', name: $event })"
      (restartServer)="action.emit({ kind: 'server', action: 'restart' })"
      (minimizeRequest)="run(minimizeWindow$())"
      (maximizeRequest)="run(toggleMaximizeWindow$())"
      (closeRequest)="run(closeWindow$())"
      fill
    >
      <ethlete-studio-menu
        [open]="menuOpen()"
        [server]="menuServer()"
        [project]="shell().project"
        [projects]="shell().projects"
        [busy]="!!shell().busy"
        (openChange)="setMenuOpen($event)"
        (projectChange)="action.emit({ kind: 'project', name: $event })"
        (openProject)="action.emit({ kind: 'openProject' })"
        (serverAction)="action.emit({ kind: 'server', action: $event })"
        (reload)="action.emit({ kind: 'reload' })"
        (scanProjects)="action.emit({ kind: 'scan' })"
        (removeProject)="action.emit({ kind: 'remove-project' })"
        (openHelp)="openHelp()"
        shellMainStudio
        bare
      />
      <ng-container ngProjectAs="[shellMainSide]"><ng-content select="[shellMainSide]" /></ng-container>
      <ng-content />
    </ethlete-shell-main>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShellMainComponent, StudioMenuComponent],
  host: { class: 'block size-full' },
})
export class ShellPageComponent {
  private destroyRef = inject(DestroyRef);
  protected updateCheck = injectUpdateCheck();
  protected chrome = inject(WINDOW_CHROME);

  public section = input<ShellSection>('System');

  public shell = input<ShellState>(SHELL_SAMPLE);

  public action = output<ShellAction>();

  protected minimizeWindow$ = minimizeWindow$;
  protected toggleMaximizeWindow$ = toggleMaximizeWindow$;
  protected closeWindow$ = closeWindow$;

  protected menuOpen = signal(false);
  protected systemPicker = signal<'open' | 'closed'>('closed');
  protected sideWidth = signal(clampSideWidth(rememberedView().sideWidth ?? SIDE_WIDTH.rest));
  protected menuServer = computed<DesignServerStatus>(() => {
    const { server, serverStale } = this.shell();

    if (server === 'stopped' || server === 'crashed') return 'stopped';

    return serverStale ? 'stale' : 'running';
  });

  protected screen = computed(() => {
    const server = this.shell().server;

    return server === 'running' ? null : (server ?? null);
  });
  protected setMenuOpen(open: boolean) {
    this.menuOpen.set(open);

    if (open) this.action.emit({ kind: 'menuOpened' });
  }

  protected setSideWidth(width: number) {
    this.sideWidth.set(width);
    rememberView({ sideWidth: width });
  }

  protected openHelp() {
    this.run(openHelp$());
  }

  protected run(action$: Observable<void>) {
    action$
      .pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a failed window control or refused restart has nothing to recover or show
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
