import {useQuery} from '@tanstack/react-query';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

export type LiveLedgerSummary={
 folioId:string;
 currency:string;
 roomSubtotalMinor:number;
 additionalDebitsMinor:number;
 creditsMinor:number;
 netRecordedChargesMinor:number;
 pendingReviewPaymentsMinor:number;
 staffConfirmedPaymentsMinor:number;
 provisionalDifferenceMinor:number;
 taxesCalculated:false;
 feesCalculated:false;
 finalPayableTotalKnown:false;
 bankOrGatewayVerified:false;
 isSettled:false;
};
export type LiveFolioLedgerResponse={data:{
 summary:LiveLedgerSummary;
 adjustments:Array<{id:string;kind:'debit'|'credit';amountMinor:number;reason:string;createdAt:string}>;
 payments:Array<{id:string;method:'cash'|'bank_transfer';reference:string;amountMinor:number;
 status:string;recordedBy:string;recordedByName:string|null;reviewedBy:string|null;
 reviewNote:string|null;voidedByName:string|null;voidReason:string|null;createdAt:string}>;
}};

/** Independent backend read-only lookup. Never silently falls back to sample data. */
export function useLiveFolioLedger(reservationId:string){
 const {hotelId}=readSession();
 const valid=/^[1-9]\d*$/.test(reservationId);
 return useQuery({
  queryKey:['live','folio-ledger',hotelId,reservationId],
  enabled:!!hotelId&&valid,
  queryFn:()=>getJson<LiveFolioLedgerResponse>(
   hotelPath('/bookings/'+encodeURIComponent(reservationId)+'/folio-ledger')
  ),
  retry:false,
 });
}
