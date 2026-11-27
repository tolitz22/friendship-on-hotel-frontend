import type { HousekeepingStatus, HousekeepingType, LiveHousekeepingTask } from '../../api/liveHousekeeping';
import { readableDate } from '../../lib/format';

export const taskNames: Record<HousekeepingType, string> = {
 checkout_clean: 'Checkout cleaning',
 stayover: 'Stayover service',
 inspection: 'Housekeeping inspection',
};

export const statusNames: Record<HousekeepingStatus, string> = {
 todo: 'To do',
 in_progress: 'In progress',
 done: 'Cleaning completed',
};

export function taskStage(task: LiveHousekeepingTask) {
 if (task.pendingInspection) return 'Inspection due';
 if (task.status === 'done') return 'Completed';
 return statusNames[task.status];
}

export function dueLabel(dueAt: string | null, hotelDate: string) {
 if (!dueAt) return 'No due time';
 // Due times are stored as hotel-local wall times.
 const time = /[T ](\d{2}):(\d{2})/.exec(dueAt);
 if (!time) return readableDate(dueAt);
 const hour = Number(time[1]);
 return (dueAt.slice(0, 10) === hotelDate ? 'Today' : readableDate(dueAt))
  + ' · ' + (hour % 12 || 12) + ':' + time[2] + (hour < 12 ? ' AM' : ' PM');
}
