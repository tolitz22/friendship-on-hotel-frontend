import {describe,expect,it} from 'vitest';
import {bookingDraftSchema,nightsBetween} from './bookingDraft';
import {addDays,hotelToday} from './calendarDate';
import {mockDataSource} from '../../api/mock/dataSource';

function validDraft(){
 const checkIn=addDays(hotelToday(),2);
 return {guestId:'g1',roomTypeId:'standard',checkIn,checkOut:addDays(checkIn,3),adults:2,children:0};
}
describe('mock reservation draft',()=>{
 it('accepts valid hotel-local stays',()=>{
  expect(bookingDraftSchema.safeParse(validDraft()).success).toBe(true);
 });
 it('rejects missing guest and room type',()=>{
  expect(bookingDraftSchema.safeParse({...validDraft(),guestId:'',roomTypeId:''}).success).toBe(false);
 });
 it('requires departure after arrival',()=>{
  const values=validDraft();
  expect(bookingDraftSchema.safeParse({...values,checkOut:values.checkIn}).success).toBe(false);
 });
 it('rejects stays in the past',()=>{
  expect(bookingDraftSchema.safeParse({...validDraft(),checkIn:'2020-01-01'}).success).toBe(false);
 });
 it('rejects invalid occupant numbers',()=>{
  expect(bookingDraftSchema.safeParse({...validDraft(),adults:0}).success).toBe(false);
  expect(bookingDraftSchema.safeParse({...validDraft(),children:-1}).success).toBe(false);
 });
 it('counts nights across calendar boundaries',()=>{
  expect(nightsBetween('2026-12-31','2027-01-02')).toBe(2);
 });
 it('returns typed mock room types and illustrative subtotal without mutation',async()=>{
  const options=await mockDataSource.getBookingOptions();
  expect(options.data.roomTypes.some(type=>type.id==='standard')).toBe(true);
  const values=validDraft();
  const quote=await mockDataSource.getBookingQuote(values);
  expect(quote.data.nights).toBe(3);
  expect(quote.data.roomSubtotal.amountMinor).toBe(750000);
  expect(quote.data.isIllustrative).toBe(true);
 });
});
