import { Appointment } from '../../scheduler.types';

export const appointmentTouchesRange = (
  appointment: Pick<Appointment, 'start' | 'end'>,
  range: { start: Date; end: Date },
) => appointment.start <= range.end && (appointment.end > range.start || appointment.start >= range.start);
