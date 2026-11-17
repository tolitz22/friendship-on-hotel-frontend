import {describe,expect,it} from 'vitest';
import {parseGuestStayHistory} from './guestStayHistory';

const data={
 data:[{id:'10',reference:'GUEST-10',checkIn:'2027-01-10',checkOut:'2027-01-12',
  status:'checked_out',roomTypeName:'Standard',roomNumber:'202'}],
 meta:{hotelId:'1',guestId:'7',page:1,perPage:10,total:1,totalPages:1,
  excludesUnverifiedLifetimeSpend:true},
};
describe('Guest history hotel isolation',()=>{
 it('accepts selected guest stays',()=>{
  const result=parseGuestStayHistory(data,'1','7');
  expect(result.data[0].roomNumber).toBe('202');
 });
 it('rejects cross-hotel, cross-guest and fabricated financial totals',()=>{
  expect(()=>parseGuestStayHistory(data,'2','7')).toThrow();
  expect(()=>parseGuestStayHistory(data,'1','8')).toThrow();
  expect(()=>parseGuestStayHistory({...data,meta:{...data.meta,excludesUnverifiedLifetimeSpend:false}},'1','7')).toThrow();
 });
 it('rejects impossible booking identifiers and invalid stay dates',()=>{
  expect(()=>parseGuestStayHistory({...data,data:[{...data.data[0],id:'abc'}]},'1','7')).toThrow();
  expect(()=>parseGuestStayHistory({...data,data:[{...data.data[0],checkIn:'not-a-date'}]},'1','7')).toThrow();
 });
});
