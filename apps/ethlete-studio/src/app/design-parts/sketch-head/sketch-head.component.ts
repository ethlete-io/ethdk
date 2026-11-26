import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { BUTTON_IMPORTS, CHOICE_FIELD_IMPORTS, MENU_IMPORTS, SWITCH_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective, injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { SketchStatusBadgeComponent } from '../sketch-status-badge/sketch-status-badge.component';
import { SketchBadgeStatus } from '../../icons/sketch-status-icons';
import { SketchHold, SketchRound, SketchStatus, SketchWithdrawn } from '../sketches/sketches-sample';

@Component({
  selector: 'ethlete-sketch-head',
  templateUrl: './sketch-head.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    MENU_IMPORTS,
    SWITCH_IMPORTS,
    ProvideColorDirective,
    SketchStatusBadgeComponent,
  ],
  hostDirectives: [AutoSurfaceDirective],
  host: {
    class: 'flex flex-col items-center gap-space-2',
  },
})
export class SketchHeadComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public status = input<SketchStatus | null>('waiting');
  public hold = input<SketchHold | null>(null);
  public autoMerge = input(false);
  public subSketch = input(false);
  public approved = input(false);
  public subSketchesOpen = input(false);
  public error = input<string | null>(null);
  public commentable = input(false, { transform: booleanAttribute });
  public discardable = input(true, { transform: booleanAttribute });
  public busy = input(false);
  public listError = input(false);
  public rounds = input<SketchRound[]>([]);
  public round = input('');
  public withdrawnCount = input(0);
  public reasonOpen = model(false);
  public roundsOpen = model(false);
  public commentMode = model(false);
  public withdrawn = model<SketchWithdrawn>('hidden');
  public roundChange = output<string>();
  public retry = output();
  public discard = output();
  public discardAnchor = viewChild('discardAnchor', { read: ElementRef<HTMLElement> });
  public toolbar = viewChild('toolbar', { read: ElementRef<HTMLElement> });

  protected readonly LABELS = SKETCHES_LABELS;
  protected readonly SYSTEM_LABELS = SYSTEM_LABELS;

  private waitingBadge = computed<SketchBadgeStatus>(() => {
    if (this.busy()) return 'merging';
    if (this.subSketchesOpen()) return 'awaitingSubParts';
    if (this.autoMerge()) return 'autoMerge';
    if (!this.subSketch()) return 'waiting';

    return this.approved() ? 'approved' : 'awaitingApproval';
  });

  protected badge = computed<SketchBadgeStatus | null>(() => {
    const status = this.status();

    if (status === 'paused' || status === 'failed') return status;
    if (status === 'waiting') return this.waitingBadge();
    if (this.autoMerge()) return 'autoMerge';

    return status === 'drawing' ? 'drawing' : null;
  });

  protected holdNote = computed(() => {
    const hold = this.hold();

    return hold ? `${SKETCHES_LABELS.holdUntil(hold.until)} · ${hold.since}` : null;
  });

  protected hasLead = computed(() => this.badge() !== null || this.withdrawnCount() > 0);

  protected selectRound(value: unknown) {
    if (typeof value === 'string' && value !== this.round()) this.roundChange.emit(value);
  }
}
