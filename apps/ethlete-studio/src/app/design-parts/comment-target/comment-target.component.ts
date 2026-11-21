import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { SYSTEM_LABELS } from '../../i18n/system-labels';

@Component({
  selector: 'ethlete-comment-target',
  template: '',
  encapsulation: ViewEncapsulation.None,
  host: {
    class:
      'block cursor-crosshair outline-none [transition:var(--transition-state)] bg-(--et-theme-color-primary-solid)/6 hover:bg-(--et-theme-color-primary-solid)/10 active:bg-(--et-theme-color-primary-solid)/14 focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus-ring)]',
    role: 'button',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    '(click)': 'comment.emit($event)',
    '(keydown.enter)': 'comment.emit($event)',
    '(keydown.space)': '$event.preventDefault(); comment.emit($event)',
  },
})
export class CommentTargetComponent {
  public frame = input<string>('');

  public comment = output<Event>();

  protected label = computed(() => SYSTEM_LABELS.commentOn(this.frame()));
}
