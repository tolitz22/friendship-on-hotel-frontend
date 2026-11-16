import type {Folio,HousekeepingTask,MaintenanceWorkOrder,Reservation,Room,ReservationStatus,ReportMetrics} from '../../api/types';

export const reservationStatuses:ReservationStatus[]=['pending','confirmed','checked_in','checked_out','cancelled','no_show'];
const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date);
export function isReportRange(from:string,to:string):boolean{return validDate(from)&&validDate(to)&&from<=to;}
export function aggregateReports(inputs:{reservations:Reservation[];rooms:Room[];housekeeping:HousekeepingTask[];maintenance:MaintenanceWorkOrder[];folios:Folio[]},from:string,to:string):ReportMetrics{
 if(!isReportRange(from,to))throw new Error('Invalid report date range');
 const arrivals=inputs.reservations.filter(r=>r.checkIn>=from&&r.checkIn<=to);
 const reservationsByStatus=reservationStatuses.map(status=>({status,count:arrivals.filter(r=>r.status===status).length}));
 const arrivalCount=new Map<string,number>();
 for(const r of arrivals)arrivalCount.set(r.checkIn,(arrivalCount.get(r.checkIn)??0)+1);
 const arrivalsByDay=[...arrivalCount].sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count}));
 const allRooms=inputs.rooms;
 const hk=inputs.housekeeping;
 const reported=inputs.maintenance.filter(order=>order.reportedAt.slice(0,10)>=from&&order.reportedAt.slice(0,10)<=to);
 return {
  reservationsByStatus,arrivalsByDay,totalArrivals:arrivals.length,
  bookingValueMinor:arrivals.filter(r=>!['cancelled','no_show'].includes(r.status)).reduce((sum,r)=>sum+r.total.amountMinor,0),
  roomSnapshot:{total:allRooms.length,occupied:allRooms.filter(r=>r.occupancyStatus==='occupied').length,vacant:allRooms.filter(r=>r.occupancyStatus==='vacant').length,outOfOrder:allRooms.filter(r=>r.maintenanceStatus==='out_of_order').length},
  housekeeping:{total:hk.length,todo:hk.filter(t=>t.status==='todo').length,inProgress:hk.filter(t=>t.status==='in_progress').length,done:hk.filter(t=>t.status==='done').length},
  maintenance:{reported:reported.length,open:reported.filter(o=>o.status==='open').length,inProgress:reported.filter(o=>o.status==='in_progress').length,resolved:reported.filter(o=>o.status==='resolved').length,closed:reported.filter(o=>o.status==='closed').length,highPriority:reported.filter(o=>o.priority==='urgent'||o.priority==='high').length},
  folios:{count:inputs.folios.length,chargesMinor:inputs.folios.reduce((sum,f)=>sum+f.totalCharges.amountMinor,0),paymentsMinor:inputs.folios.reduce((sum,f)=>sum+f.totalPayments.amountMinor,0),balanceMinor:inputs.folios.reduce((sum,f)=>sum+f.balance.amountMinor,0)}
 };
}
