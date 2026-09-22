import { css, drawing, html } from '@design-explore';
import { KERBE_BAND_STYLES, kerbeBand } from '../../shared/kerbe-band.component';
import { KERBE_FRAME_STYLES, kerbeFrame } from '../../shared/kerbe-frame';
import { BANDS, LANE_REM } from './fixture';

export default drawing({
  body: kerbeFrame({
    widthRem: LANE_REM,
    gapRem: 1.6,
    body: html`${BANDS.map((band) => kerbeBand({ band, shrink: 'timed', treatment: 'inlay' }))}`,
  }),
  styles: css`
    ${KERBE_FRAME_STYLES}
    ${KERBE_BAND_STYLES}
  `,
});
