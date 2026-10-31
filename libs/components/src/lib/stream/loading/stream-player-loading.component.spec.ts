import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../../test-helpers';
import { StreamPlayerLoadingComponent } from './stream-player-loading.component';

describe('StreamPlayerLoadingComponent', () => {
  let fixture: ComponentFixture<StreamPlayerLoadingComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StreamPlayerLoadingComponent],
    });
    fixture = TestBed.createComponent(StreamPlayerLoadingComponent);
    host = fixture.nativeElement;
  });

  it('renders spinner component', () => {
    fixture.detectChanges();
    const spinner = host.querySelector('et-spinner');
    expect(spinner).not.toBeNull();
  });

  it('wraps its whole stylesheet in the components cascade layer', () => {
    const css = readFileSync(
      fileURLToPath(import.meta.url).replace(/[^/]+$/, 'stream-player-loading.component.css'),
      'utf8',
    ).trim();
    let depth = 0;
    let layerCloseIndex = -1;

    for (let index = 0; index < css.length && layerCloseIndex < 0; index++) {
      if (css[index] === '{') depth++;
      if (css[index] === '}' && --depth === 0) layerCloseIndex = index;
    }

    expect(css.startsWith('@layer components {')).toBe(true);
    expect(layerCloseIndex).toBe(css.length - 1);
    expect(css).toContain('position: absolute');
  });
});
