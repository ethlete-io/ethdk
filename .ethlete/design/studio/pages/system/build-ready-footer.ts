import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { control } from '@ethlete/components/design/control';
import { html, withAction } from '@design-system';
import badge from '@system/components/badge';
import button from '@system/components/button';
import { disclosure } from '@system/components/disclosure';
import disclosureStyles from '@system/components/disclosure.css?inline';
import { blockerGroupsOf, blockerIcon, developerLabel, statusLabel, type BuildReady } from './shared/build-ready';
import { BUILD_READY_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

const check = SDK_ICONS.find((each) => each.name === 'et-check');

const statusBadge = async (status: BuildReady) => {
  const drawn = await badge.render({
    badges: [
      {
        label: statusLabel(status),
        variant: status.state === 'checking' ? 'outline' : 'tonal',
        size: 'sm',
        icon: status.state === 'ready' ? check : undefined,
      },
    ],
  });
  return {
    body:
      status.state === 'blocked'
        ? html`<span class="flex" data-et-semantic-color="warning">${drawn.body}</span>`
        : html`<span class="flex">${drawn.body}</span>`,
    styles: drawn.styles,
  };
};

const developerBadge = async (reasons: string[], icon?: string) => {
  const drawn = await badge.render({ badges: [{ label: developerLabel, variant: 'outline', size: 'sm' }] });
  return {
    body: html`<span class="flex" title="${reasons.join('; ')}">${icon ?? ''}${drawn.body}</span>`,
    styles: drawn.styles,
  };
};

const blockerList = async (status: BuildReady) => {
  if (status.state !== 'blocked') return { body: '', styles: '' };

  const groups = blockerGroupsOf(status.blockers)
    .map(
      ({ title, icon, blockers }) =>
        html`<li>
          <h3 class="m-0 px-space-2 pt-space-1 text-ui-xs font-ui-strong text-et-surface-text-muted">${title}</h3>
          <ul class="m-0 p-0 list-none">
            ${blockers
              .map(
                ({ text }) =>
                  html`<li class="flex items-center gap-space-2 px-space-2 py-space-1">
                    ${blockerIcon(icon)}<span class="min-w-0 flex-1 text-et-surface-text">${text}</span>
                  </li>`,
              )
              .join('')}
          </ul>
        </li>`,
    )
    .join('');

  return {
    body: html`<ul class="m-0 p-0 pb-space-1 list-none">
      ${groups}
    </ul>`,
    styles: '',
  };
};

const openEditSketch = async (status: BuildReady) => {
  if (status.state !== 'blocked' || !status.blockers.some(({ kind }) => kind === 'direct-edit')) {
    return { body: '', styles: '' };
  }
  const open = await button.render({ label: BUILD_READY_LABELS.openEditSketch, variant: 'outline', size: 'xs' });
  return { body: control(withAction(open.body, 'emit:openEditSketch'), 'open-edit-sketch'), styles: open.styles };
};

export const buildReadyView = async (status: BuildReady, open: boolean, developer?: string[]) => {
  const state = await statusBadge(status);
  const list = await blockerList(status);
  const edit = await openEditSketch(status);
  const mark = developer ? await developerBadge(developer) : undefined;
  const reasons =
    status.state === 'blocked'
      ? disclosure({
          label: BUILD_READY_LABELS.reasons,
          body: list.body,
          open,
          size: 'sm',
          action: open ? 'part' : 'blockers-open',
        })
      : '';

  return {
    before: '',
    footer: html`<footer class="border-t border-(--et-surface-border) px-space-3 py-space-2">
      <div class="flex items-center gap-space-2">
        ${state.body}${mark?.body ?? ''}
        <span class="ms-auto"></span>
        ${edit.body}${status.state === 'blocked' && !open ? reasons : ''}
      </div>
      ${status.state === 'blocked' && open ? html`<div class="-mx-space-2 mt-space-1">${reasons}</div>` : ''}
    </footer>`,
    styles: state.styles + (mark?.styles ?? '') + list.styles + edit.styles + disclosureStyles,
  };
};
