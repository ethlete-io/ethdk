import { ListedNote } from '../../host/design-notes';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { partNotesOf } from './note-places';

const note = (id: string, state: string, point?: { x: number; y: number }, size?: string): ListedNote => ({
  id,
  part: 'pages/library',
  state,
  text: `text ${id}`,
  file: `notes/${id}.json`,
  stale: null,
  ...(point ? { point } : {}),
  ...(size ? { size } : {}),
});

const frame = (id: string, place: CanvasFrame['place']): CanvasFrame => ({
  id,
  src: 'about:blank',
  label: id,
  ...(place ? { place } : {}),
});

describe('partNotesOf', () => {
  it('puts a note on every frame of its state at rest, a pointed one only at its size, not on interactions or sketches', () => {
    const frames = [
      frame('phone', { part: 'pages/library', state: 'empty', size: 'phone' }),
      frame('desktop', { part: 'pages/library', state: 'empty', size: 'desktop', interaction: 'rest' }),
      frame('hover', { part: 'pages/library', state: 'empty', size: 'phone', interaction: 'hover' }),
      frame('variant', {
        part: 'pages/library',
        state: 'empty',
        size: 'phone',
        sketch: { target: 'pages/library', variant: 'a' },
      }),
      frame('three', { part: 'pages/library', state: 'three', size: 'phone' }),
      frame('other', { part: 'pages/home', state: 'empty', size: 'phone' }),
      frame('placeless', undefined),
    ];

    expect(
      partNotesOf(frames, [note('a', 'empty', { x: 40, y: 120 }, 'phone'), note('b', 'three'), note('c', 'empty')]),
    ).toEqual([
      { id: 'a', text: 'text a', frameId: 'phone', point: { x: 40, y: 120 } },
      { id: 'b', text: 'text b', frameId: 'three' },
      { id: 'c', text: 'text c', frameId: 'phone' },
      { id: 'c', text: 'text c', frameId: 'desktop' },
    ]);
  });
});
