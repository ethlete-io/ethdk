import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  inputBinding,
  output,
  outputBinding,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { anchoredDialogOverlayStrategy, injectOverlayManager } from '@ethlete/components';
import { catchError, EMPTY, Observable } from 'rxjs';
import { closeWindow$, minimizeWindow$, toggleMaximizeWindow$, WINDOW_CHROME } from '../../../host/window';
import { restartForUpdate$ } from '../../../host/update';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { UpdateDialogComponent } from '../../components/update-dialog/update-dialog.component';
import { injectUpdateCheck } from '../../update-check';
import { DesignServerAction, StudioMenuComponent } from '../studio-menu/studio-menu.component';
import { ShellMainComponent, ShellSection } from './shell-main.component';

export type ShellState = {
  product: string;
  products: string[];
  project: string;
  projects: string[];
  panel: 'open' | 'hidden';
  server?: 'running' | 'starting' | 'stopped';
  serverLog?: readonly string[];
};

export type ShellAction =
  | { kind: 'collapse' }
  | { kind: 'section'; section: ShellSection }
  | { kind: 'product'; name: string }
  | { kind: 'project'; name: string }
  | { kind: 'openProject' }
  | { kind: 'server'; action: DesignServerAction };

export const SHELL_SAMPLE: ShellState = {
  product: 'studio',
  products: ['studio', 'timetrack', 'docs'],
  project: 'ethlete-sdk',
  projects: ['ethlete-sdk', 'fut-frontend', 'design-playground'],
  panel: 'open',
};

@Component({
  selector: 'ethlete-shell-page',
  template: `
    <ethlete-shell-main
      [section]="section()"
      [product]="shell().product"
      [products]="shell().products"
      [project]="shell().project"
      [projects]="shell().projects"
      [panel]="shell().panel"
      [server]="screen()"
      [log]="shell().serverLog ?? []"
      [chrome]="chrome()"
      [update]="!!updateCheck.version()"
      (collapse)="action.emit({ kind: 'collapse' })"
      (sectionChange)="action.emit({ kind: 'section', section: $event })"
      (productChange)="action.emit({ kind: 'product', name: $event })"
      (projectChange)="action.emit({ kind: 'project', name: $event })"
      (openProject)="action.emit({ kind: 'openProject' })"
      (restartServer)="action.emit({ kind: 'server', action: 'restart' })"
      (updateRequest)="openUpdateDialog($event)"
      (minimizeRequest)="run(minimizeWindow$())"
      (maximizeRequest)="run(toggleMaximizeWindow$())"
      (closeRequest)="run(closeWindow$())"
      fill
    >
      <ethlete-studio-menu
        [(open)]="menuOpen"
        [server]="shell().server === 'stopped' ? 'stopped' : 'running'"
        (serverAction)="action.emit({ kind: 'server', action: $event })"
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
  private overlay = injectOverlayManager();
  protected updateCheck = injectUpdateCheck();
  protected chrome = inject(WINDOW_CHROME);

  public section = input<ShellSection>('System');

  public shell = input<ShellState>(SHELL_SAMPLE);

  public action = output<ShellAction>();

  protected minimizeWindow$ = minimizeWindow$;
  protected toggleMaximizeWindow$ = toggleMaximizeWindow$;
  protected closeWindow$ = closeWindow$;

  protected menuOpen = signal(false);
  protected screen = computed(() => {
    const server = this.shell().server;

    return server === 'stopped' || server === 'starting' ? server : null;
  });

  protected openUpdateDialog(event: MouseEvent) {
    const version = this.updateCheck.version();

    if (!version) return;

    this.overlay.open(UpdateDialogComponent, {
      origin: event,
      role: 'dialog',
      ariaLabel: STUDIO_LABELS.updateDialog.label,
      strategies: anchoredDialogOverlayStrategy(),
      bindings: [inputBinding('version', () => version), outputBinding('restart', () => this.run(restartForUpdate$()))],
    });
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
