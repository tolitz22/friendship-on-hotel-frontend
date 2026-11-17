import {z} from 'zod';
import {requestJson} from './http';
import {hotelPath,readSession} from './session';
import {validLiveStay} from './liveReservations';
import type {LiveStay} from './liveReservations';

const id=z.string().regex(/^[1-9]\d*$/);
const responseSchema=z.object({data:z.object({
 id,reference:z.string().min(1),hotelId:id,guestId:id,roomTypeId:id,
 assignedRoomId:id.nullable(),checkIn:z.iso.date(),checkOut:z.iso.date(),
 status:z.literal('confirmed'),idempotentReplay:z.boolean(),
})});
export type ConfirmedBooking=z.infer<typeof responseSchema>['data'];
export type BookingSelection=LiveStay&{guestId:string;ratePlanId:string};
export type BookingSubmission={hotelId:string;key:string;selection:BookingSelection};
export type BookingPayload={
 idempotencyKey:string;guestId:number;roomTypeId:number;ratePlanId:number;
 checkIn:string;checkOut:string;
};

function numericId(value:string):number{
 if(!id.safeParse(value).success)throw new Error('Select a valid hotel, guest, room type and rate.');
 const number=Number(value);
 if(!Number.isSafeInteger(number)||number<=0)throw new Error('Booking identifier exceeds the supported integer range.');
 return number;
}

export function buildBookingPayload(submission:BookingSubmission):BookingPayload{
 const {selection,key}=submission;
 numericId(submission.hotelId);
 if(!validLiveStay(selection))throw new Error('Choose a valid stay from 1 to 31 nights.');
 if(key.length<8||key.length>100)throw new Error('Invalid booking request key.');
 return {
  idempotencyKey:key,
  guestId:numericId(selection.guestId),
  roomTypeId:numericId(selection.roomTypeId),
  ratePlanId:numericId(selection.ratePlanId),
  checkIn:selection.checkIn,
  checkOut:selection.checkOut,
 };
}

export function parseBookingResult(body:unknown,submission:BookingSubmission):ConfirmedBooking{
 const booking=responseSchema.parse(body).data;
 const {selection}=submission;
 if(booking.hotelId!==submission.hotelId||booking.guestId!==selection.guestId
  ||booking.roomTypeId!==selection.roomTypeId||booking.checkIn!==selection.checkIn
  ||booking.checkOut!==selection.checkOut){
  throw new Error('Booking response does not match the submitted property, guest or stay. Verify in the hotel records.');
 }
 return booking;
}

/** Authenticated admin endpoint; status/replay and hotel scope are verified. */
export async function createLiveBooking(submission:BookingSubmission):Promise<ConfirmedBooking>{
 const payload=buildBookingPayload(submission);
 if(readSession().hotelId!==submission.hotelId){
  throw new Error('The selected hotel changed. Reconcile this booking before continuing.');
 }
 const result=await requestJson<unknown>(hotelPath('/bookings'),{method:'POST',body:payload});
 return parseBookingResult(result,submission);
}

export function makeBookingSubmission(hotelId:string,selection:BookingSelection,key:string):BookingSubmission{
 return {hotelId,selection:{...selection},key};
}
