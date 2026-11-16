import {describe,expect,it} from 'vitest';
import {aggregateReports,isReportRange} from './reportMath';
import {reservations,rooms,housekeeping,folios} from '../../api/mock/fixtures';
import {maintenanceOrders} from '../../api/mock/maintenanceFixtures';
const inputs={reservations,rooms,housekeeping,folios,maintenance:maintenanceOrders};
describe('reports sample aggregates',()=>{
 it('filters booking counts by arrival date including both boundaries',()=>{
  const result=aggregateReports(inputs,'2026-11-17','2026-11-18');
  expect(result.totalArrivals).toBe(2);
  expect(result.arrivalsByDay).toEqual([{date:'2026-11-17',count:1},{date:'2026-11-18',count:1}]);
 });
 it('excludes cancelled and no-show amounts from indicative booking value',()=>{
  const result=aggregateReports(inputs,'2026-12-12','2026-12-12');
  expect(result.bookingValueMinor).toBe(0);
 });
 it('keeps current room occupancy separate from arrival-range numbers',()=>{
  const a=aggregateReports(inputs,'2026-11-17','2026-11-17');
  const b=aggregateReports(inputs,'2026-12-10','2026-12-10');
  expect(a.roomSnapshot).toEqual(b.roomSnapshot);
  expect(a.roomSnapshot.total).toBe(rooms.length);
 });
 it('keeps all-time folio snapshots out of date-bounded totals',()=>{
  const a=aggregateReports(inputs,'2026-11-17','2026-11-17');
  const b=aggregateReports(inputs,'2026-12-10','2026-12-10');
  expect(a.folios.paymentsMinor).toBe(b.folios.paymentsMinor);
 });
 it('filters maintenance by report timestamp local calendar day',()=>{
  const result=aggregateReports(inputs,'2026-11-17','2026-11-17');
  expect(result.maintenance.reported).toBe(2);
 });
 it('rejects inverted date ranges',()=>expect(isReportRange('2026-12-10','2026-11-17')).toBe(false));
});
