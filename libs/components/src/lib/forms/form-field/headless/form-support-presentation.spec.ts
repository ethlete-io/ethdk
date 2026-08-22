import {
  INITIAL_SUPPORT_PRESENTATION_STATE,
  reduceSupportPresentation,
  SUPPORT_CONTENT_STATE,
  SUPPORT_TRANSITION_DIRECTION,
  SupportContentState,
  SupportPresentationState,
} from './support-presentation';

const FROM_ERROR = [{ kind: 'from-error' }];
const FROM_WARNING = [{ kind: 'from-warning' }];
const TO_ERRORS = [{ kind: 'to-error' }];
const TO_WARNINGS = [{ kind: 'to-warning' }];

const settledAt = (state: SupportContentState): SupportPresentationState => ({
  renderedState: state,
  leavingState: SUPPORT_CONTENT_STATE.NONE,
  renderedErrors: state === SUPPORT_CONTENT_STATE.ERROR ? FROM_ERROR : [],
  renderedWarnings: state === SUPPORT_CONTENT_STATE.WARNING ? FROM_WARNING : [],
  directions: { ...INITIAL_SUPPORT_PRESENTATION_STATE.directions },
});

const reduce = (from: SupportContentState, to: SupportContentState) =>
  reduceSupportPresentation({
    presentation: settledAt(from),
    semanticSupportState: to,
    errors: TO_ERRORS,
    warnings: TO_WARNINGS,
  });

const { NONE, HINT, WARNING, ERROR } = SUPPORT_CONTENT_STATE;
const { FROM_ABOVE, FROM_BELOW, TO_ABOVE, TO_BELOW } = SUPPORT_TRANSITION_DIRECTION;

describe('reduceSupportPresentation', () => {
  it('none -> hint enters from its home side and clears both message lists', () => {
    expect(reduce(NONE, HINT)).toEqual({
      renderedState: 'hint',
      leavingState: 'none',
      renderedErrors: [],
      renderedWarnings: [],
      directions: { hint: FROM_ABOVE, warning: FROM_BELOW, error: FROM_BELOW },
    });
  });

  it('none -> warning enters from its home side and takes the new warnings', () => {
    expect(reduce(NONE, WARNING)).toEqual({
      renderedState: 'warning',
      leavingState: 'none',
      renderedErrors: [],
      renderedWarnings: TO_WARNINGS,
      directions: { hint: FROM_ABOVE, warning: FROM_BELOW, error: FROM_BELOW },
    });
  });

  it('none -> error enters from its home side and takes the new errors', () => {
    expect(reduce(NONE, ERROR)).toEqual({
      renderedState: 'error',
      leavingState: 'none',
      renderedErrors: TO_ERRORS,
      renderedWarnings: [],
      directions: { hint: FROM_ABOVE, warning: FROM_BELOW, error: FROM_BELOW },
    });
  });

  it('hint -> none leaves hint to its home side and clears both message lists', () => {
    expect(reduce(HINT, NONE)).toEqual({
      renderedState: 'none',
      leavingState: 'hint',
      renderedErrors: [],
      renderedWarnings: [],
      directions: { hint: TO_ABOVE, warning: FROM_BELOW, error: FROM_BELOW },
    });
  });

  it('hint -> warning: the more severe warning enters from below, hint is pushed up', () => {
    expect(reduce(HINT, WARNING)).toEqual({
      renderedState: 'warning',
      leavingState: 'hint',
      renderedErrors: [],
      renderedWarnings: TO_WARNINGS,
      directions: { hint: TO_ABOVE, warning: FROM_BELOW, error: FROM_BELOW },
    });
  });

  it('hint -> error: the more severe error enters from below, hint is pushed up', () => {
    expect(reduce(HINT, ERROR)).toEqual({
      renderedState: 'error',
      leavingState: 'hint',
      renderedErrors: TO_ERRORS,
      renderedWarnings: [],
      directions: { hint: TO_ABOVE, warning: FROM_BELOW, error: FROM_BELOW },
    });
  });

  it('warning -> none leaves warning to its home side and retains the leaving warnings', () => {
    expect(reduce(WARNING, NONE)).toEqual({
      renderedState: 'none',
      leavingState: 'warning',
      renderedErrors: [],
      renderedWarnings: FROM_WARNING,
      directions: { hint: FROM_ABOVE, warning: TO_BELOW, error: FROM_BELOW },
    });
  });

  it('warning -> hint: the less severe hint enters from above, warning sinks below and is retained', () => {
    expect(reduce(WARNING, HINT)).toEqual({
      renderedState: 'hint',
      leavingState: 'warning',
      renderedErrors: [],
      renderedWarnings: FROM_WARNING,
      directions: { hint: FROM_ABOVE, warning: TO_BELOW, error: FROM_BELOW },
    });
  });

  it('warning -> error: the more severe error enters from below, warning is pushed up but retained', () => {
    expect(reduce(WARNING, ERROR)).toEqual({
      renderedState: 'error',
      leavingState: 'warning',
      renderedErrors: TO_ERRORS,
      renderedWarnings: FROM_WARNING,
      directions: { hint: FROM_ABOVE, warning: TO_ABOVE, error: FROM_BELOW },
    });
  });

  it('error -> none leaves error to its home side and retains the leaving errors', () => {
    expect(reduce(ERROR, NONE)).toEqual({
      renderedState: 'none',
      leavingState: 'error',
      renderedErrors: FROM_ERROR,
      renderedWarnings: [],
      directions: { hint: FROM_ABOVE, warning: FROM_BELOW, error: TO_BELOW },
    });
  });

  it('error -> hint: the less severe hint enters from above, error sinks below and is retained', () => {
    expect(reduce(ERROR, HINT)).toEqual({
      renderedState: 'hint',
      leavingState: 'error',
      renderedErrors: FROM_ERROR,
      renderedWarnings: [],
      directions: { hint: FROM_ABOVE, warning: FROM_BELOW, error: TO_BELOW },
    });
  });

  it('error -> warning: the less severe warning enters from above, error sinks below and is retained', () => {
    expect(reduce(ERROR, WARNING)).toEqual({
      renderedState: 'warning',
      leavingState: 'error',
      renderedErrors: FROM_ERROR,
      renderedWarnings: TO_WARNINGS,
      directions: { hint: FROM_ABOVE, warning: FROM_ABOVE, error: TO_BELOW },
    });
  });
});
