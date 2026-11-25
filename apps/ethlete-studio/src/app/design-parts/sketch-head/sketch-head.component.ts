import { Component, computed, ElementRef, input, model, output, viewChild, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS, CHOICE_FIELD_IMPORTS, MENU_IMPORTS, SWITCH_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective, injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { HoldTriggerComponent } from '../hold-trigger/hold-trigger.component';
import { SketchStatusBadgeComponent } from '../sketch-status-badge/sketch-status-badge.component';
import {
  SketchAgentRun,
  SketchHold,
  SketchMergePort,
  SketchRound,
  SketchStatus,
  SketchWithdrawn,
} from '../sketches/sketches-sample';

@Component({
  selector: 'ethlete-sketch-head',
  templateUrl: './sketch-head.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    MENU_IMPORTS,
    SWITCH_IMPORTS,
    ProvideColorDirective,
    AgentLogoComponent,
    HoldTriggerComponent,
    SketchStatusBadgeComponent,
  ],
  hostDirectives: [AutoSurfaceDirective],
  host: {
    class: 'flex flex-col items-center gap-space-2',
  },
})
export class SketchHeadComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  protected warningTheme = injectSemanticColorTheme('warning');
  protected successTheme = injectSemanticColorTheme('success');
  public status = input<SketchStatus>('waiting');
  public readyReason = input<string | null>(null);
  public hold = input.required<SketchHold>();
  public autoMerge = input(false);
  public error = input<string | null>(null);
  public commentable = input(false);
  public discardable = input(true);
  public busy = input(false);
  public listError = input(false);
  public rounds = input<SketchRound[]>([]);
  public round = input('');
  public agent = input<SketchAgentRun | null>(null);
  public port = input<SketchMergePort | null>(null);
  public withdrawnCount = input(0);
  public reasonOpen = model(false);
  public roundsOpen = model(false);
  public commentMode = model(false);
  public withdrawn = model<SketchWithdrawn>('hidden');
  public roundChange = output<string>();
  public retry = output();
  public discard = output();
  public discardAnchor = viewChild('discardAnchor', { read: ElementRef<HTMLElement> });

  protected readonly LABELS = SKETCHES_LABELS;
  protected readonly SYSTEM_LABELS = SYSTEM_LABELS;

  protected hasLead = computed(
    () =>
      ['paused', 'waiting', 'failed', 'drawing'].includes(this.status()) ||
      this.autoMerge() ||
      this.agent() !== null ||
      this.port() !== null ||
      this.withdrawnCount() > 0,
  );

  protected selectRound(value: unknown) {
    if (typeof value === 'string' && value !== this.round()) this.roundChange.emit(value);
  }
}
