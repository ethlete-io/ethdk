import { addDays, addHours, startOfDay } from 'date-fns';
import { Appointment } from '../scheduler.types';

export const PAGE_DAYS = 21;
export const TOTAL_DAYS = 105;

const TITLES = ['Daily standup', 'Client call', 'Sprint planning', 'Design sync', 'Retro', '1:1 with manager'];
const COLOR_TOKENS = ['brand', 'success', 'warning', 'danger'];

const titleAt = (index: number) => TITLES[index % TITLES.length] ?? 'Meeting';
const colorAt = (index: number) => COLOR_TOKENS[index % COLOR_TOKENS.length] ?? 'brand';

/** A stand-in for a paged appointment endpoint: the same days always yield the same appointments. */
export const generateAgendaAppointments = (from: Date, dayCount: number): Appointment[] => {
  const appointments: Appointment[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const day = addDays(from, dayIndex);

    if (dayIndex % 3 === 0) {
      appointments.push({
        id: `day-${dayIndex}-morning`,
        parentId: null,
        title: titleAt(dayIndex),
        start: addHours(day, 9),
        end: addHours(day, 9.5),
        colorToken: colorAt(dayIndex),
      });
    }

    if (dayIndex % 4 === 1) {
      appointments.push({
        id: `day-${dayIndex}-afternoon`,
        parentId: null,
        title: titleAt(dayIndex + 2),
        start: addHours(day, 14),
        end: addHours(day, 15.5),
        location: 'Main conference room',
        colorToken: colorAt(dayIndex + 1),
      });
    }

    if (dayIndex % 14 === 7) {
      appointments.push({
        id: `day-${dayIndex}-offsite`,
        parentId: null,
        title: 'Team offsite',
        start: startOfDay(day),
        end: addDays(startOfDay(day), 2),
        allDay: true,
        colorToken: 'warning',
      });
    }
  }

  return appointments;
};
