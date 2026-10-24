import { DOCUMENT, afterRenderEffect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectRenderer } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { SelectDirective } from './headless';

const PLACEHOLDER_WIDTH_PROPERTY = '--_et-select-search-placeholder-width';

export const injectSearchPlaceholderWidth = (select: SelectDirective) => {
  const renderer = injectRenderer();
  const document = inject(DOCUMENT);
  const fontsLoaded = signal(0);
  let measuredInput: HTMLInputElement | null = null;
  let measuredText: string | null = null;
  let measuredFontsVersion = -1;

  if (document.fonts) {
    fromEvent(document.fonts, 'loadingdone')
      .pipe(
        tap(() => fontsLoaded.update((count) => count + 1)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  const measureEm = (input: HTMLInputElement, text: string) => {
    const style = getComputedStyle(input);
    const sizer = renderer.createElement('span');

    renderer.setTextContent(sizer, text);
    renderer.setStyle(sizer, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      pointerEvents: 'none',
      font: style.font,
      letterSpacing: style.letterSpacing,
    });
    renderer.appendChild(document.body, sizer);

    const width = sizer.getBoundingClientRect().width;

    renderer.removeChild(document.body, sizer);

    const fontSize = parseFloat(style.fontSize);

    if (!width || !fontSize) return null;

    return `${Math.ceil(((width + 2) / fontSize) * 100) / 100}em`;
  };

  afterRenderEffect(() => {
    const input = select.registeredSearch()?.elementRef.nativeElement ?? null;
    const fontsVersion = fontsLoaded();

    select.hasValue();
    select.placeholder();

    if (!input) return;

    const text = input.placeholder;

    if (input === measuredInput && text === measuredText && fontsVersion === measuredFontsVersion) return;

    measuredInput = input;
    measuredText = text;
    measuredFontsVersion = fontsVersion;

    renderer.setCssProperty(input, PLACEHOLDER_WIDTH_PROPERTY, text ? measureEm(input, text) : null);
  });
};
