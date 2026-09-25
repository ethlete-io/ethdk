import { Component, Directive, ElementRef, inject, Injectable, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createPipChromeAnimations,
  createPipChromeState,
  DEFAULT_STREAM_LABELS,
  injectPipManager,
  injectPipSlotPlaceholderConfig,
  KickPlayerSlotComponent,
  PIP_CHROME_REF_TOKEN,
  PIP_ENTRY_TOKEN,
  PIP_WINDOW_ASPECT_RATIO_TOKEN,
  PipBackDirective,
  PipBringBackDirective,
  PipCellDirective,
  PipChromeRef,
  PipCloseDirective,
  PipGridToggleDirective,
  PipPlayerComponent,
  PipSlotPlaceholderComponent,
  PipStageDirective,
  PipTitleBarTemplateDirective,
  PipWindowComponent,
  PipWindowParamsDirective,
  providePipSlotPlaceholderConfig,
  provideStreamConfig,
  provideStreamPip,
  STREAM_IMPORTS,
  STREAM_KICK_IMPORTS,
  STREAM_PIP_IMPORTS,
  StreamPipChromeComponent,
  TikTokPlayerSlotComponent,
  STREAM_TIKTOK_IMPORTS,
} from '../index';
import { Scenario, useScenario } from './harness';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

@Component({
  selector: 'et-scenario-match-center',
  imports: [STREAM_IMPORTS, STREAM_KICK_IMPORTS, STREAM_TIKTOK_IMPORTS],
  template: `
    <section class="main">
      <et-kick-player-slot [streamSlotOnPipBack]="focusMain" channel="arena" />
    </section>
    <section class="side">
      <et-kick-player-slot channel="studio" />
    </section>
    <section class="short">
      <et-tiktok-player-slot videoId="short-1" />
    </section>
  `,
})
class MatchCenterComponent {
  focused = signal(0);
  focusMain = () => this.focused.update((count) => count + 1);
  slots = viewChildren(KickPlayerSlotComponent);
  short = viewChild.required(TikTokPlayerSlotComponent);

  float(index: number) {
    this.slots()[index]?.slotDirective.slot.pipActivate();
  }
}

const floatAndSettle = async (s: Scenario, fixture: { componentInstance: MatchCenterComponent }, index: number) => {
  fixture.componentInstance.float(index);
  await s.settle();
};

class FinishingAnimation {
  onfinish: (() => void) | null = null;
  oncancel: (() => void) | null = null;
  playState: AnimationPlayState = 'running';

  constructor() {
    queueMicrotask(() => this.finish());
  }

  finish() {
    if (this.playState !== 'running') return;
    this.playState = 'finished';
    this.onfinish?.();
  }

  cancel() {
    if (this.playState !== 'running') return;
    this.playState = 'idle';
    this.oncancel?.();
  }
}

// jsdom has no Web Animations API, matchMedia or scrollIntoView; the PiP window needs all three.
const installBrowserStubs = () => {
  const scrolled: Element[] = [];

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({ media, matches: false }),
  });
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: () => new FinishingAnimation(),
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: Element) {
      scrolled.push(this);
    },
  });

  return {
    scrolled,
    restore: () => {
      Reflect.deleteProperty(window, 'matchMedia');
      Reflect.deleteProperty(Element.prototype, 'animate');
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    },
  };
};

let browser: ReturnType<typeof installBrowserStubs>;

beforeEach(() => (browser = installBrowserStubs()));
afterEach(() => browser.restore());

describe('stream picture-in-picture scenarios', () => {
  const scenario = useScenario({
    providers: [
      ...provideStreamPip({
        pipChromeComponent: StreamPipChromeComponent,
        pipChrome: { controlsColor: 'neutral' },
        pipWindow: { minWidth: 200 },
      }),
      ...provideStreamConfig({ pipSlotPlaceholderComponent: PipSlotPlaceholderComponent }),
      ...providePipSlotPlaceholderConfig({ backButtonColor: 'primary' }),
    ],
  });

  it('floats a stream into the PiP window and brings it back from the slot placeholder', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCenterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const pip = s.run(() => injectPipManager());

    s.flush();

    const mainSlot = query('.main et-kick-player-slot', host);
    const iframe = query('iframe', mainSlot);

    expect(mainSlot.querySelector('.et-pip-slot-placeholder-overlay')).toBeNull();
    expect(document.querySelector('et-stream-pip-chrome')).toBeNull();

    await floatAndSettle(s, fixture, 0);

    expect(pip.pips().map((entry) => entry.playerId)).toEqual(['kick-arena']);
    expect(pip.pips()[0]?.aspectRatio).toBe(16 / 9);
    expect(pip.pipChromeComponent()).toBe(StreamPipChromeComponent);
    expect(pip.pipChromeConfig().controlsColor).toBe('neutral');

    const chrome = query('body > et-stream-pip-chrome');
    const pipPlayer = query('et-pip-player', chrome);

    expect(pipPlayer.dataset['pipPlayerId']).toBe('kick-arena');
    expect(pipPlayer.contains(iframe)).toBe(true);
    expect(pipPlayer.classList).toContain('et-pip-player--ready');

    const placeholder = query('.et-pip-slot-placeholder-overlay', mainSlot);

    expect(placeholder.textContent).toContain(DEFAULT_STREAM_LABELS.pipPlaceholderMessage);
    expect(s.run(() => injectPipSlotPlaceholderConfig()).backButtonColor).toBe('primary');

    const titleBar = query('.et-pip-window__title-bar', chrome);

    expect(titleBar.getAttribute('aria-label')).toBe(DEFAULT_STREAM_LABELS.pipMove);
    expect(query('.et-stream-pip-chrome__close', chrome).getAttribute('aria-label')).toBe(
      DEFAULT_STREAM_LABELS.pipClose,
    );

    query('button', placeholder).click();
    s.flush();

    expect(pip.pips()).toEqual([]);
    expect(mainSlot.contains(iframe)).toBe(true);
    expect(mainSlot.querySelector('.et-pip-slot-placeholder-overlay')).toBeNull();
    expect(document.querySelector('et-stream-pip-chrome')).toBeNull();
  });

  it('jumps back to the page from the PiP window and pulses the placeholder button', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCenterComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();
    await floatAndSettle(s, fixture, 0);

    const back = query('.et-stream-pip-chrome__back');

    expect(back.getAttribute('aria-label')).toBe(DEFAULT_STREAM_LABELS.pipFocus);

    back.click();
    await s.settle();

    const bringBack = query('.main .et-pip-slot-placeholder-overlay button', host);

    expect(fixture.componentInstance.focused()).toBe(1);
    expect(browser.scrolled).toEqual([bringBack]);
  });

  it('closes every floating stream from the window close button', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCenterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const pip = s.run(() => injectPipManager());

    s.flush();
    await floatAndSettle(s, fixture, 0);
    await floatAndSettle(s, fixture, 1);

    expect(pip.pips()).toHaveLength(2);

    query('.et-stream-pip-chrome__close').click();
    await s.settle();

    expect(pip.pips()).toEqual([]);
    expect(document.querySelector('et-stream-pip-chrome')).toBeNull();
    expect(query('.main', host).querySelector('iframe')).not.toBeNull();
    expect(query('.side', host).querySelector('iframe')).not.toBeNull();
  });

  it('switches between single and grid view when several streams float', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCenterComponent);
    const pip = s.run(() => injectPipManager());

    s.flush();
    await floatAndSettle(s, fixture, 0);

    const chrome = query('et-stream-pip-chrome');

    expect(chrome.querySelector('.et-stream-pip-chrome__view-btn')).toBeNull();

    await floatAndSettle(s, fixture, 1);
    fixture.componentInstance.short().slotDirective.slot.pipActivate();
    await s.settle();

    const toggle = query('.et-stream-pip-chrome__view-btn', chrome);
    const stage = query('.et-stream-pip-chrome__stage', chrome);
    const cells = () => Array.from(chrome.querySelectorAll<HTMLElement>('.et-stream-pip-chrome__cell'));

    expect(toggle.getAttribute('aria-label')).toBe('Grid view');
    expect(stage.style.getPropertyValue('--et-pip-grid-cols')).toBe('2');
    expect(stage.style.getPropertyValue('--et-pip-grid-rows')).toBe('2');
    expect(pip.featuredPipId()).toBe('kick-arena');
    expect(cells().map((cell) => cell.hasAttribute('inert'))).toEqual([false, true, true]);
    expect(pip.pips()[2]?.aspectRatio).toBe(9 / 16);

    toggle.click();
    await s.settle();

    expect(chrome.classList).toContain('et-stream-pip-chrome--grid');
    expect(toggle.getAttribute('aria-label')).toBe('Single view');
    expect(pip.featuredPipId()).toBeNull();
    expect(cells().map((cell) => cell.getAttribute('role'))).toEqual(['button', 'button', 'button']);

    const studio = cells()[1];

    studio?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await s.settle();

    expect(chrome.classList).not.toContain('et-stream-pip-chrome--grid');
    expect(pip.featuredPipId()).toBe('kick-studio');
    expect(studio?.classList).toContain('et-stream-pip-chrome__cell--featured');
    expect(chrome.querySelector('.et-stream-pip-chrome__back')).toBeNull();

    pip.pipDeactivate('kick-studio', { skipAnimation: true });
    pip.pipDeactivate('tiktok-short-1', { skipAnimation: true });
    await s.settle();

    expect(chrome.querySelector('.et-stream-pip-chrome__view-btn')).toBeNull();
    expect(pip.featuredPipId()).toBe('kick-arena');
  });

  it('tears the PiP window down with the app while a stream still floats', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCenterComponent);

    s.flush();
    await floatAndSettle(s, fixture, 0);

    expect(document.querySelector('body > et-stream-pip-chrome')).not.toBeNull();
  });

  it('moves and resizes the PiP window from the keyboard', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MatchCenterComponent);

    s.flush();
    await floatAndSettle(s, fixture, 0);

    const pipWindow = query('et-pip-window');
    const titleBar = query('.et-pip-window__title-bar', pipWindow);
    const before = pipWindow.style.translate;

    titleBar.focus();
    s.keydown('ArrowLeft', titleBar);
    s.flush();

    expect(pipWindow.classList).toContain('et-pip-window--positioned');
    expect(pipWindow.style.translate).not.toBe(before);

    const widthBefore = pipWindow.style.width;

    titleBar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    s.flush();

    expect(pipWindow.style.width).not.toBe(widthBefore);
  });
});

@Injectable({ providedIn: 'root' })
class ChromeRegistry {
  chromes: BrandedPipChromeComponent[] = [];
}

@Directive({ selector: '[etScenarioPipCaption]', host: { '[attr.data-caption]': 'entry().playerId' } })
class PipCaptionDirective {
  entry = inject(PIP_ENTRY_TOKEN);
}

@Component({
  selector: 'et-scenario-pip-chrome',
  imports: [STREAM_PIP_IMPORTS, PipCellDirective, PipStageDirective, PipTitleBarTemplateDirective, PipCaptionDirective],
  providers: [
    { provide: PIP_CHROME_REF_TOKEN, useExisting: BrandedPipChromeComponent },
    {
      provide: PIP_WINDOW_ASPECT_RATIO_TOKEN,
      useFactory: () => inject(BrandedPipChromeComponent).state.windowAspectRatio,
    },
  ],
  template: `
    <et-pip-window>
      <ng-template etPipTitleBar>
        <span class="title">{{ state.featuredPip()?.playerId }}</span>
        <button class="grid" etPipGridToggle type="button">grid</button>
        <button class="back" etPipBack type="button">back</button>
        <button class="close-all" etPipClose type="button">close</button>
      </ng-template>

      <div etPipStage>
        @for (cell of state.cells(); track cell.playerId) {
          <div [etPipCell]="cell">
            <et-pip-player etScenarioPipCaption />
            <button [entry]="cell.pip" class="close-one" etPipClose type="button">x</button>
          </div>
        }
      </div>
    </et-pip-window>
  `,
})
class BrandedPipChromeComponent implements PipChromeRef {
  state = createPipChromeState();
  pipWindow = viewChild(PipWindowComponent);
  stage = viewChild(PipStageDirective, { read: ElementRef<HTMLElement> });
  animations = createPipChromeAnimations(this.state, {
    stageRef: this.stage,
    gridBtnRef: viewChild(PipGridToggleDirective, { read: ElementRef<HTMLElement> }),
    pipWindowRef: this.pipWindow,
  });
  params = viewChild(PipWindowParamsDirective);
  captions = viewChildren(PipCaptionDirective);
  players = viewChildren(PipPlayerComponent);
  closeButtons = viewChildren(PipCloseDirective);

  constructor() {
    inject(ChromeRegistry).chromes.push(this);
  }
}

@Component({
  selector: 'et-scenario-broken-pip-chrome',
  template: '',
})
class BrokenPipChromeComponent {}

@Component({
  selector: 'et-scenario-bring-back',
  imports: [KickPlayerSlotComponent, PipBringBackDirective, PipBackDirective],
  template: `
    <et-kick-player-slot channel="arena">
      <button class="inline-back" etPipBringBack type="button">back</button>
    </et-kick-player-slot>
    <et-kick-player-slot [streamSlotOnPipBack]="count" channel="studio" />
  `,
})
class BringBackComponent {
  backs = signal(0);
  count = () => this.backs.update((value) => value + 1);
  slots = viewChildren(KickPlayerSlotComponent);
}

describe('stream picture-in-picture with an app-built chrome', () => {
  const scenario = useScenario({
    providers: [...provideStreamPip({ pipChromeComponent: BrandedPipChromeComponent })],
  });

  it('renders its own PiP window from the headless chrome state and controls', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BringBackComponent);
    const host = fixture.nativeElement as HTMLElement;
    const pip = s.run(() => injectPipManager());

    s.flush();

    const [arena, studio] = fixture.componentInstance.slots();

    arena?.slotDirective.slot.pipActivate();
    studio?.slotDirective.slot.pipActivate();
    await s.settle();

    const chrome = query('body > et-scenario-pip-chrome');

    expect(pip.pipChromeComponent()).toBe(BrandedPipChromeComponent);
    expect(query('.title', chrome).textContent).toBe('kick-arena');
    expect(Array.from(chrome.querySelectorAll('[data-caption]')).map((el) => el.getAttribute('data-caption'))).toEqual([
      'kick-arena',
      'kick-studio',
    ]);
    expect(query('et-pip-window', chrome).style.getPropertyValue('--et-pip-content-ratio')).toBe(String(16 / 9));

    const [branded] = TestBed.inject(ChromeRegistry).chromes;

    expect(branded?.params()?.minWidth()).toBe(160);
    expect(branded?.players()).toHaveLength(2);
    expect(branded?.closeButtons()).toHaveLength(3);
    expect(branded?.state.hasMultiplePips()).toBe(true);

    query('.grid', chrome).click();
    await s.settle();
    expect(pip.featuredPipId()).toBeNull();

    query('.close-one', chrome).click();
    await s.settle();

    expect(pip.pips().map((entry) => entry.playerId)).toEqual(['kick-studio']);
    expect(query('et-kick-player-slot', host).querySelector('iframe')).not.toBeNull();

    query('.back', chrome).click();
    expect(fixture.componentInstance.backs()).toBe(1);

    arena?.slotDirective.slot.pipActivate();
    await s.settle();

    query('.inline-back', host).click();
    await s.settle();

    expect(pip.pips().map((entry) => entry.playerId)).toEqual(['kick-studio']);

    studio?.slotDirective.slot.pipDeactivate();
    await s.settle();

    expect(pip.pips()).toEqual([]);
    expect(document.querySelector('et-scenario-pip-chrome')).toBeNull();
  });
});

describe('stream picture-in-picture with a chrome that forgets its ref', () => {
  const scenario = useScenario({
    providers: [...provideStreamPip({ pipChromeComponent: BrokenPipChromeComponent })],
  });

  it('reports a chrome component without PIP_CHROME_REF_TOKEN', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BringBackComponent);

    s.flush();
    fixture.componentInstance.slots()[0]?.slotDirective.slot.pipActivate();

    expect(() => s.tick()).toThrow('PIP_CHROME_REF_TOKEN');
  });
});
