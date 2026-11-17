import {getJson,requestJson} from './http';
import {hotelPath} from './session';
import type {CollectionResponse} from './types';

export const POLICY_FIELDS={
 sellableUnit:{title:'Sellable inventory unit',options:{physical_room:'Physical room',room_type:'Room type',hybrid:'Hybrid'}},
 assignmentTiming:{title:'Physical-room assignment',options:{at_booking:'At booking',before_arrival:'Before arrival',at_check_in:'At check-in'}},
 inventoryConsumption:{title:'States consuming inventory',options:{
  confirmed_only:'Confirmed only',pending_and_confirmed:'Pending + confirmed',
  confirmed_and_checked_in:'Confirmed + checked-in',
  pending_confirmed_checked_in:'Pending + confirmed + checked-in',
 }},
 holdPolicy:{title:'Pending reservation holds',options:{no_pending_holds:'No pending holds',timed_pending_holds:'Timed holds'}},
 maintenanceBlocks:{title:'Maintenance and staff blocks',options:{
  block_out_of_service:'Block out-of-service rooms',
  block_out_of_service_and_manual:'Block out-of-service + manual blocks',
 }},
 overbooking:{title:'Overbooking',options:{prohibited:'Never allow',authorized_override:'Authorized override'}},
 cancellationPolicy:{title:'Cancellation',options:{manual_review:'Manual review',cutoff_based:'Cutoff-based'}},
 ratePolicy:{title:'Pricing basis',options:{manual_quote_review:'Manual rate review',published_rate_plans:'Published rate plans'}},
} as const;
export type PolicyField=keyof typeof POLICY_FIELDS;
export type PolicyDecisions=Record<PolicyField,string|null>;
export interface PolicyDraft{
 hotelId:string;revision:number;status:'draft';effectiveForBookings:false;
 decisions:PolicyDecisions;completion:{complete:boolean;missing:PolicyField[]};
}
export interface PolicyRevision{
 revision:number;actorId:string;decisions:PolicyDecisions;createdAt:string;
}
export const getReservationPolicyDraft=()=>getJson<{data:PolicyDraft}>(hotelPath('/reservation-policy-draft'));
export const updateReservationPolicyDraft=(expectedRevision:number,decisions:Partial<PolicyDecisions>)=>
 requestJson<{data:PolicyDraft}>(hotelPath('/reservation-policy-draft'),{
  method:'PATCH',body:{expectedRevision,decisions},
 });
export const getReservationPolicyHistory=()=>getJson<CollectionResponse<PolicyRevision>>(
 hotelPath('/reservation-policy-draft/history'));
