import { Component, ElementRef, input, model, output, viewChild, ViewEncapsulation } from '@angular/core';
import {
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  FORM_FIELD_IMPORTS,
  SELECT_IMPORTS,
  SWITCH_IMPORTS,
} from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { HoldTriggerComponent } from '../hold-trigger/hold-trigger.component';
import { SketchStatusBadgeComponent } from '../sketch-status-badge/sketch-status-badge.component';
import {
  SketchAgentRun,
  SketchHold,
  SketchIdle,
  SketchMergePort,
  SketchRound,
  SketchStatus,
  SketchWithdrawn,
} from '../sketches/sketches-sample';

export type SketchMergeHold = { reason: string; dirty?: string[] };

@Component({
  selector: 'ethlete-sketch-head',
  templateUrl: './sketch-head.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    FORM_FIELD_IMPORTS,
    SELECT_IMPORTS,
    SWITCH_IMPORTS,
    ProvideColorDirective,
    AgentLogoComponent,
    HoldTriggerComponent,
    SketchStatusBadgeComponent,
  ],
  host: {
    class: 'relative flex flex-col gap-space-2',
    'data-sk-head': '',
  },
})
export class SketchHeadComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  protected warningTheme = injectSemanticColorTheme('warning');
  protected successTheme = injectSemanticColorTheme('success');
  public heading = input('');
  public fresh = input(false);
  public status = input<SketchStatus>('waiting');
  public readyReason = input<string | null>(null);
  public hold = input.required<SketchHold>();
  public lastChange = input.required<SketchIdle>();
  public heldMerge = input<SketchMergeHold | null>(null);
  public autoMerge = input(false);
  public error = input<string | null>(null);
  public commentable = input(false);
  public discardable = input(true);
  public listError = input(false);
  public question = input('');
  public rounds = input<SketchRound[]>([]);
  public round = input('');
  public agent = input<SketchAgentRun | null>(null);
  public port = input<SketchMergePort | null>(null);
  public withdrawnCount = input(0);
  public reasonOpen = model(false);
  public commentMode = model(false);
  public withdrawn = model<SketchWithdrawn>('hidden');
  public roundChange = output<string>();
  public retry = output();
  public discard = output();
  public discardAnchor = viewChild('discardAnchor', { read: ElementRef<HTMLElement> });

  protected readonly LABELS = SKETCHES_LABELS;
  protected readonly SYSTEM_LABELS = SYSTEM_LABELS;

  protected selectRound(value: unknown) {
    if (typeof value === 'string') this.roundChange.emit(value);
  }
}
