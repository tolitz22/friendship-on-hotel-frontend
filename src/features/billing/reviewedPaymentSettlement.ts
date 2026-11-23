type GuestBill = {
 netRecordedChargesMinor:number;
 payments:readonly {status:string;verificationStatus:string|null;amountMinor:number}[];
 refunds:readonly {status:string}[];
};

export function isGuestBillSettled(bill:GuestBill):boolean{
 if(bill.netRecordedChargesMinor<=0
  ||bill.refunds.some(refund=>refund.status==='requested'||refund.status==='approved'))return false;

 let confirmedTotal=0;
 for(const payment of bill.payments){
  if(payment.status==='pending_review')return false;
  if(payment.status!=='staff_confirmed')continue;
  if(payment.verificationStatus==='rejected')return false;
  confirmedTotal+=payment.amountMinor;
 }
 return confirmedTotal===bill.netRecordedChargesMinor;
}
