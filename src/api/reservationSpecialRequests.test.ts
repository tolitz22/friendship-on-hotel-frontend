import {describe,expect,it} from 'vitest';
import {parseSpecialRequests} from './reservationSpecialRequests';
const sample={
 data:[{id:'22',bookingId:'8',tag:'quiet_room',note:'Away from elevator',
  createdBy:'11',createdAt:'2027-01-01 12:00:00',
  isGuaranteed:false,chargesAutomaticallyPosted:false}],
 meta:{hotelId:'1',bookingId:'8',page:1,total:1,totalPages:1},
};
describe('Special request validation',()=>{
 it('accepts recorded but unguaranteed guest notes',()=>{
  expect(parseSpecialRequests(sample,'1','8').data[0].tag).toBe('quiet_room');
 });
 it('rejects cross-hotel or booking request data',()=>{
  expect(()=>parseSpecialRequests(sample,'2','8')).toThrow();
  expect(()=>parseSpecialRequests(sample,'1','9')).toThrow();
  expect(()=>parseSpecialRequests({...sample,data:[{...sample.data[0],bookingId:'9'}]},'1','8')).toThrow();
 });
 it('rejects unsupported tags or falsely guaranteed charges',()=>{
  expect(()=>parseSpecialRequests({...sample,data:[{...sample.data[0],tag:'cash_refund'}]},'1','8')).toThrow();
  expect(()=>parseSpecialRequests({...sample,data:[{...sample.data[0],isGuaranteed:true}]},'1','8')).toThrow();
  expect(()=>parseSpecialRequests({...sample,data:[{...sample.data[0],chargesAutomaticallyPosted:true}]},'1','8')).toThrow();
 });
});
