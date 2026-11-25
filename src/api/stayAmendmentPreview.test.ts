import {beforeEach,describe,expect,it,vi} from 'vitest';
import {previewStayAmendment} from './stayAmendmentPreview';
import {requestJson} from './http';
import {readSession} from './session';
vi.mock('./http',()=>({requestJson:vi.fn()}));
vi.mock('./session',()=>({readSession:vi.fn(),hotelPath:(path:string)=>'/hotels/1'+path}));
const data={id:'2',oldCheckIn:'2026-11-01',oldCheckOut:'2026-11-02',checkIn:'2026-12-01',checkOut:'2026-12-02',currency:'PHP',originalRoomSubtotalMinor:20000,proposedRoomSubtotalMinor:15000,differenceMinor:-5000,nightlyRates:[{date:'2026-12-01',amountMinor:15000,source:'base'}],closedPeriodAffected:true,previewOnly:true,saved:false};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(readSession).mockReturnValue({hotelId:'1'} as ReturnType<typeof readSession>);vi.mocked(requestJson).mockResolvedValue({data});});
describe('priced stay preview boundary',()=>{
 it('uses only the preview endpoint and preserves reductions and closed-period warnings',async()=>{
  expect(await previewStayAmendment('1','2',data.checkIn,data.checkOut)).toMatchObject({differenceMinor:-5000,closedPeriodAffected:true,saved:false});
  expect(requestJson).toHaveBeenCalledWith('/hotels/1/bookings/2/dates/preview',{method:'POST',body:{checkIn:data.checkIn,checkOut:data.checkOut}});
 });
 it.each([{id:'3'},{checkOut:'2026-12-03'},{saved:true},{previewOnly:false},{differenceMinor:'5000'}])('rejects mismatched or unsafe responses %s',async change=>{
  vi.mocked(requestJson).mockResolvedValue({data:{...data,...change}});
  await expect(previewStayAmendment('1','2',data.checkIn,data.checkOut)).rejects.toThrow();
 });
 it('rejects a hotel switch while loading',async()=>{
  vi.mocked(requestJson).mockImplementation(async()=>{vi.mocked(readSession).mockReturnValue({hotelId:'3'} as ReturnType<typeof readSession>);return {data};});
  await expect(previewStayAmendment('1','2',data.checkIn,data.checkOut)).rejects.toThrow('context changed');
 });
});
