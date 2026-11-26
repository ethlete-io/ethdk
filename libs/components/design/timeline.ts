import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import timelineItemBase from '../src/lib/timeline/timeline-item.component.css?inline';
import timelineBase from '../src/lib/timeline/timeline.component.css?inline';

export type TimelineMockItem = {
  /** The item's body HTML, projected after the time. */
  content: string;
  /** The `[etTimelineTime]` text above the content. Left out, the item has no time. */
  time?: string;
  /** The `[etTimelineMarker]` HTML, e.g. an `iconMarkup()`. Left out, the item draws the default dot. */
  marker?: string;
  /** The color theme name the item's `color` input scopes. Left out, the item takes the theme around it. */
  color?: string;
  /** Extra attributes on the item, e.g. design markers. */
  attributes?: string;
};

export type TimelineMockOptions = {
  items: TimelineMockItem[];
  /** Extra attributes on the timeline, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `timeline()` draws with: the real timeline, timeline-item and icon CSS. */
export const timelineStyles = /* @__PURE__ */ [iconBase, timelineBase, timelineItemBase].join('\n');

const item = ({ content, time, marker, color, attributes }: TimelineMockItem) => {
  const hostAttributes = [
    attributes,
    `class="et-color--${color ?? 'inherited'} et-timeline-item"`,
    'role="listitem"',
  ].filter(Boolean);
  const markerSlot = marker ? marker.replace(/^<(\w+)/, '<$1 etTimelineMarker=""') : '';
  const timeSlot = time ? `<span etTimelineTime="">${time}</span>` : '';

  return (
    `<et-timeline-item ${hostAttributes.join(' ')}>` +
    `<span class="et-timeline-item-rail"><span class="et-timeline-item-marker">${markerSlot}</span></span>` +
    `<div class="et-timeline-item-content">${timeSlot}${content}</div>` +
    `</et-timeline-item>`
  );
};

/**
 * Draws `<et-timeline>` with one `<et-timeline-item>` per item as HTML: the rail with its connector, the default
 * dot or a projected marker, and the time above the content.
 */
export const timeline = (options: TimelineMockOptions) => {
  const attributes = [options.attributes, 'class="et-timeline"', 'role="list"'].filter(Boolean);

  return `<et-timeline ${attributes.join(' ')}>${options.items.map(item).join('')}</et-timeline>`;
};
