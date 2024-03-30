import { ElementRef, TemplateRef, inject } from '@angular/core';

export const injectHostElement = <T = HTMLElement>() => inject<ElementRef<T>>(ElementRef).nativeElement;

export const injectTemplateRef = <C = unknown>() => inject<TemplateRef<C>>(TemplateRef);
