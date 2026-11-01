import { Inventory, InventoryRefusal } from '../../host/design-inventory';
import { approvalLabelOf, refusalMessageOf } from './inventory';

const inventory = (state: Inventory['state']): Inventory => ({
  part: 'pages/merge',
  hash: 'h1',
  ids: [],
  findings: 0,
  approval: null,
  state,
  reason: null,
  frames: [],
});

describe('inventory labels', () => {
  it('names what reopened an approval', () => {
    expect(approvalLabelOf(inventory({ state: 'none' }))).toBe('Noch nicht freigegeben');
    expect(approvalLabelOf(inventory({ state: 'reopened', added: ['a'], removed: ['b'], changed: true }))).toBe(
      'Wieder offen: hinzugefügt a; entfernt b; der Teil hat sich geändert',
    );
  });

  it('tells a 409 from a 422', () => {
    expect(refusalMessageOf(new InventoryRefusal(409, 'x'))).toContain('Die Seite hat sich geändert');
    expect(refusalMessageOf(new InventoryRefusal(422, 'x'))).toContain('rote und gelbe');
  });
});
