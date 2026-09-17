import { createComponent } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { calls } from 'virtual:design-explore';
import { providers, Wrapper } from 'virtual:design-explore/env';

const params = new URLSearchParams(location.search);
const slug = params.get('call') ?? '';
const key = params.get('option') ?? '';

const root = document.querySelector('#root') as HTMLElement;

const fail = (message: string) => {
  root.textContent = message;
  root.setAttribute('style', 'padding:16px;font:14px monospace;color:#f0a0a0;background:#1a1414');
};

const call = calls[slug];
if (!call) fail(`design-explore: no call "${slug}"`);
else {
  const option = (await call()).default.options.find((o) => o.key === key);
  if (!option) fail(`design-explore: call "${slug}" has no option "${key}"`);
  else {
    const loaded = (await option.load()).default;

    if (typeof loaded === 'function') {
      const app = await createApplication({ providers });
      const drawn = createComponent(loaded, { environmentInjector: app.injector });

      if (Wrapper) {
        const wrapper = createComponent(Wrapper, {
          environmentInjector: app.injector,
          hostElement: root,
          projectableNodes: [[drawn.location.nativeElement]],
        });
        app.attachView(wrapper.hostView);
      } else {
        root.append(drawn.location.nativeElement);
      }

      app.attachView(drawn.hostView);
      app.tick();
    } else {
      const style = document.createElement('style');

      style.textContent = loaded.styles;
      document.head.append(style);
      root.innerHTML = loaded.body;
    }
  }
}

const report = () => {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
  parent.postMessage({ type: 'design-explore:height', option: key, height }, '*');
};

new ResizeObserver(report).observe(document.documentElement);
report();
