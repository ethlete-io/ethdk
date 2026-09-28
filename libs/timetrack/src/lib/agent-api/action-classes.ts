import { AGENT_API_OP_CLASSES, AgentApiOp, OpClass } from './model';

/** The name the approval queue shows for everything auto mode asks for. No CLI may call itself this. */
export const AUTO_MODE_CLIENT = 'auto mode';

/** Loosest first. A setting may only move an action to the right. */
export const OP_CLASS_ORDER: readonly OpClass[] = ['read', 'local', 'external', 'human-only'];

/**
 * What auto mode writes on its own: `autoMode.apply` names a band or resolves a stand-in with the
 * issue the match found, and sets a stand-in's parent; `autoMode.create` files the ticket it drafted.
 */
export type AutoModeAction = 'autoMode.apply' | 'autoMode.create';

export const AUTO_MODE_ACTION_CLASSES: Record<AutoModeAction, OpClass> = {
  'autoMode.apply': 'local',
  'autoMode.create': 'external',
};

export type ClassedAction = AgentApiOp | AutoModeAction;

/** The actions the user moved to a stricter class than the table gives them. */
export type ActionClasses = Partial<Record<ClassedAction, OpClass>>;

const isAutoModeAction = (action: string): action is AutoModeAction => action in AUTO_MODE_ACTION_CLASSES;

const rankOf = (opClass: OpClass) => OP_CLASS_ORDER.indexOf(opClass);

export const stricterClass = (left: OpClass, right: OpClass) => (rankOf(left) >= rankOf(right) ? left : right);

export const tableClassOf = (action: ClassedAction): OpClass =>
  isAutoModeAction(action) ? AUTO_MODE_ACTION_CLASSES[action] : AGENT_API_OP_CLASSES[action];

/** The class an action has now: the table's, or the stricter one the user picked. */
export const actionClassOf = (action: ClassedAction, classes: ActionClasses): OpClass => {
  const picked = classes[action];

  return picked ? stricterClass(tableClassOf(action), picked) : tableClassOf(action);
};

/**
 * The classes the settings offer an action, table class first: only the ones that change what happens.
 * A CLI write waits in the queue as `local` and as `external` alike, so it offers only `human-only`
 * on top, which keeps it out of "Approve all". A read offers nothing.
 */
export const actionClassChoices = (action: ClassedAction): OpClass[] => {
  const table = tableClassOf(action);

  if (isAutoModeAction(action)) return OP_CLASS_ORDER.filter((opClass) => rankOf(opClass) >= rankOf(table));
  if (table === 'read' || table === 'human-only') return [];

  return [table, 'human-only'];
};

/** Every action the settings offer a choice for, auto mode's first. */
export const CLASSED_ACTIONS: readonly ClassedAction[] = [
  ...(Object.keys(AUTO_MODE_ACTION_CLASSES) as AutoModeAction[]),
  ...(Object.keys(AGENT_API_OP_CLASSES) as AgentApiOp[]),
].filter((action) => actionClassChoices(action).length > 0);

/** Sets an action's class. A class the action does not offer changes nothing; the table class clears it. */
export const withActionClass = (
  classes: ActionClasses,
  options: { action: ClassedAction; opClass: OpClass },
): ActionClasses => {
  const { action, opClass } = options;

  if (!actionClassChoices(action).includes(opClass)) return classes;

  const rest: ActionClasses = Object.fromEntries(Object.entries(classes).filter(([key]) => key !== action));

  return opClass === tableClassOf(action) ? rest : { ...rest, [action]: opClass };
};

/** Reads the stored classes, keeping only a known action set to a stricter class it offers. */
export const parseActionClasses = (value: unknown): ActionClasses => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return CLASSED_ACTIONS.reduce<ActionClasses>((classes, action) => {
    const opClass = OP_CLASS_ORDER.find((known) => known === raw[action]);

    return opClass ? withActionClass(classes, { action, opClass }) : classes;
  }, {});
};

/** Whether auto mode has anything left to do. With both its actions at `human-only`, it asks nothing. */
export const autoModeActs = (classes: ActionClasses) =>
  actionClassOf('autoMode.apply', classes) !== 'human-only' ||
  actionClassOf('autoMode.create', classes) !== 'human-only';
