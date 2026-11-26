import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

export type TauriReportFile = {
  /** Asks where to save the text and writes it there. Answers the chosen path, or `null` when the dialog was dismissed. */
  save$(options: { suggestedName: string; text: string }): Observable<string | null>;
};

export const createTauriReportFile = (): TauriReportFile => ({
  save$: ({ suggestedName, text }) => invokeHost$<string | null>('save_report_file', { suggestedName, text }),
});
