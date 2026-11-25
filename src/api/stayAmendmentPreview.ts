import {z} from 'zod';
import {requestJson} from './http';
import {hotelPath,readSession} from './session';

export const amendmentPreviewSchema=z.object({
 id:z.string(),oldCheckIn:z.iso.date(),oldCheckOut:z.iso.date(),checkIn:z.iso.date(),checkOut:z.iso.date(),
 currency:z.string().regex(/^[A-Z]{3}$/),originalRoomSubtotalMinor:z.number().int(),
 proposedRoomSubtotalMinor:z.number().int(),differenceMinor:z.number().int(),
 nightlyRates:z.array(z.object({date:z.iso.date(),amountMinor:z.number().int(),source:z.string()})),
 closedPeriodAffected:z.boolean(),previewOnly:z.literal(true),saved:z.literal(false),
});
export type AmendmentPreview=z.infer<typeof amendmentPreviewSchema>;
export async function previewStayAmendment(hotelId:string,bookingId:string,checkIn:string,checkOut:string){
 if(readSession().hotelId!==hotelId)throw new Error('Select the original hotel before reviewing this booking.');
 const response=await requestJson<{data:unknown}>(hotelPath('/bookings/'+bookingId+'/dates/preview'),{method:'POST',body:{checkIn,checkOut}});
 const data=amendmentPreviewSchema.parse(response.data);
 if(readSession().hotelId!==hotelId||data.id!==bookingId||data.checkIn!==checkIn||data.checkOut!==checkOut)
  throw new Error('The booking context changed. Review the dates again.');
 return data;
}
