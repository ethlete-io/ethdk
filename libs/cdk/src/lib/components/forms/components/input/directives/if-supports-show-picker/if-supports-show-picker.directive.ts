import { Platform } from '@angular/cdk/platform';
import { Directive, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, tap } from 'rxjs';
import { INPUT_TOKEN } from '../../../../directives/input';

// Browser compatibility for the HTMLElement.showPicker method as of 14.02.2024
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/showPicker#browser_compatibility
const SHOW_PICKER_SUPPORT = {
  firefox: ['color', 'date', 'datetime-local', 'file'],
  safari: ['color', 'file', 'time'],
  firefoxAndroid: ['color', 'date', 'datetime-local', 'file', 'month', 'time', 'week'],
  safariIOS: ['file'],
};

@Directive({
  selector: '[etIfSupportsShowPicker]',
})
export class IfSupportsShowPickerDirective {
  readonly input = inject(INPUT_TOKEN);
  readonly platform = inject(Platform);
  readonly templateRef = inject(TemplateRef);
  readonly viewContainerRef = inject(ViewContainerRef);
  didCreateView = false;

  constructor() {
    this.input.nativeInputRef$
      .pipe(
        takeUntilDestroyed(),
        distinctUntilChanged(),
        tap((value) => {
          const inputElement = value?.element.nativeElement;

          if (inputElement && 'type' in inputElement) {
            const type = inputElement.type as string;

            if (this.currentPlatformSupportsShowPickerForInput(type) && !this.didCreateView) {
              this.viewContainerRef.createEmbeddedView(this.templateRef);
              this.didCreateView = true;
            } else if (this.didCreateView) {
              this.viewContainerRef.clear();
              this.didCreateView = false;
            }
          }
        }),
      )
      .subscribe();
  }

  getShowPickerSupportPlatformKey() {
    if (this.platform.ANDROID || this.platform.IOS) {
      // Mobile
      if (this.platform.FIREFOX) {
        return 'firefoxAndroid';
      } else if (this.platform.SAFARI) {
        return 'safariIOS';
      }
    } else {
      // Desktop
      if (this.platform.FIREFOX) {
        return 'firefox';
      } else if (this.platform.SAFARI) {
        return 'safari';
      }
    }
    return null;
  }

  currentPlatformSupportsShowPickerForInput(inputType: string) {
    const platform = this.getShowPickerSupportPlatformKey();

    if (!inputType) return false;
    if (!platform) return true;

    return SHOW_PICKER_SUPPORT[platform].includes(inputType);
  }
}
