import {z} from 'zod';
import {hotelToday,parseDay} from './calendarDate';

export const bookingDraftSchema=z.object({
 guestId:z.string().min(1,'Select a guest.'),
 roomTypeId:z.string().min(1,'Select a room type.'),
 checkIn:z.iso.date('Choose a valid check-in date.'),
 checkOut:z.iso.date('Choose a valid check-out date.'),
 adults:z.number().int().min(1,'At least one adult is required.').max(8,'Maximum eight adults in this demo.'),
 children:z.number().int().min(0).max(8,'Maximum eight children in this demo.')
}).superRefine((draft,ctx)=>{
 if(draft.checkOut<=draft.checkIn)ctx.addIssue({code:'custom',path:['checkOut'],message:'Check-out must be after check-in.'});
 if(draft.checkIn<hotelToday())ctx.addIssue({code:'custom',path:['checkIn'],message:'Check-in cannot be in the past.'});
 if(draft.checkOut>draft.checkIn&&nightsBetween(draft.checkIn,draft.checkOut)>30)ctx.addIssue({code:'custom',path:['checkOut'],message:'Demo stays cannot exceed 30 nights.'});
});
export type BookingDraft=z.infer<typeof bookingDraftSchema>;
export function nightsBetween(checkIn:string,checkOut:string):number {
 return Math.round((parseDay(checkOut).getTime()-parseDay(checkIn).getTime())/86400000);
}
export function draftReady(value:unknown):value is BookingDraft{return bookingDraftSchema.safeParse(value).success;}
