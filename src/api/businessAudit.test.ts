import {describe,expect,it} from 'vitest';
import {parseBusinessAudit} from './businessAudit';

const sample={data:{hotelId:'2',items:[{id:'4:7',category:'staff',source:'hotel_staff_events',subjectId:'8',actorId:'3',action:'updated',createdAt:'2026-11-27 10:00:00'}]},meta:{readOnly:true,days:30,categories:['staff'],nextCursor:null}};
describe('business audit response',()=>{
 it('accepts a matching hotel and window',()=>expect(parseBusinessAudit(sample,'2','staff',30).data.items).toHaveLength(1));
 it('rejects cross-hotel or wrong-filter responses',()=>{
  expect(()=>parseBusinessAudit(sample,'3','all',30)).toThrow();
  expect(()=>parseBusinessAudit(sample,'2','finance',30)).toThrow();
  expect(()=>parseBusinessAudit(sample,'2','staff',7)).toThrow();
 });
});
