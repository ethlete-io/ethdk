import { ListedFlow } from '../../host/design-flows';
import { ListedNote } from '../../host/design-notes';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { flowNotesOf, partNotesOf } from './note-places';

const note = (id: string, state: string, point?: { x: number; y: number }): ListedNote => ({
  id,
  part: 'pages/library',
  state,
  text: `text ${id}`,
  file: `notes/${id}.json`,
  stale: null,
  ...(point ? { point } : {}),
});

const frame = (id: string, place: CanvasFrame['place']): CanvasFrame => ({
  id,
  src: 'about:blank',
  label: id,
  ...(place ? { place } : {}),
});

describe('partNotesOf', () => {
  it('puts a note on every frame of its state at rest, at every size, and not on interactions or sketches', () => {
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

    expect(partNotesOf(frames, [note('a', 'empty', { x: 40, y: 120 }), note('b', 'three')])).toEqual([
      { id: 'a', text: 'text a', frameId: 'phone', point: { x: 40, y: 120 } },
      { id: 'a', text: 'text a', frameId: 'desktop', point: { x: 40, y: 120 } },
      { id: 'b', text: 'text b', frameId: 'three' },
    ]);
  });
});

describe('flowNotesOf', () => {
  it('puts each note on its state frame in the flow, and the free notes as headings', () => {
    const flow: ListedFlow = {
      name: 'sign-in',
      file: 'flows/sign-in.json',
      frames: [
        { part: 'pages/library', state: 'empty' },
        { part: 'pages/sign-in', state: 'default' },
      ],
      lines: [],
      notes: [
        { id: 'heading', text: 'Library before sign-in', at: { x: 0, y: -160 } },
        { id: 'loose', text: 'Placed by Studio' },
      ],
      problems: [],
    };

    expect(flowNotesOf(flow, [note('a', 'empty', { x: 40, y: 120 }), note('b', 'three')])).toEqual([
      { id: 'a', text: 'text a', frameId: 'pages/library empty', point: { x: 40, y: 120 } },
      { id: 'heading', text: 'Library before sign-in', heading: true, at: { x: 0, y: -160 } },
      { id: 'loose', text: 'Placed by Studio', heading: true },
    ]);
  });
});
