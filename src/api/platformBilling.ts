import {getJson,requestJson} from './http';
import type {Paginated} from './platformPlans';
export interface SubscriptionInvoice{id:string;hotelId:string;hotelName:string;reference:string;planName:string;agreementRevision:number;currency:'PHP';cycle:'monthly'|'annual';amountMinor:number;outstandingMinor:number;verifiedMinor:number;pendingMinor:number;status:InvoiceStatus;periodStart:string;periodEnd:string;issuedOn:string;dueOn:string;issuedBy:string|null}
export function fetchSubscriptionInvoices(status:'all'|InvoiceStatus,search:string,page:number,signal?:AbortSignal){return getJson<Paginated<SubscriptionInvoice>&{summary:{outstandingMinor:number;currency:'PHP'};today:string}>('/platform/subscription-invoices',{status,search,page},signal);}
export function issueSubscriptionInvoice(hotelId:string,input:{revision:number;dueOn:string;confirmed:boolean}){return requestJson<{data:SubscriptionInvoice;replayed:boolean}>('/platform/hotels/'+encodeURIComponent(hotelId)+'/subscription-invoices',{method:'POST',body:input});}

export type InvoiceStatus='unpaid'|'partially_paid'|'paid'|'overdue';
export type PaymentMethod='gcash'|'maya'|'bank_transfer'|'cash';
export interface SubscriptionPayment{id:string;method:PaymentMethod;reference:string;evidenceReference:string;amountMinor:number;receivedOn:string;status:'pending'|'verified'|'rejected';recordedBy:string|null;reviewedBy:string|null;reviewNote:string|null;reviewedAt:string|null;selfReviewed:boolean;createdAt:string}
export interface PaymentBalance{amountMinor:number;verifiedMinor:number;pendingMinor:number;outstandingMinor:number}
export interface PaymentInput{method:PaymentMethod;reference:string;evidenceReference:string;amountMinor:number;receivedOn:string;confirmed:boolean}
const paymentPath=(id:string)=>'/platform/subscription-invoices/'+encodeURIComponent(id)+'/payments';
export function fetchSubscriptionPayments(id:string,page:number,signal?:AbortSignal){return getJson<Paginated<SubscriptionPayment>&{balance:PaymentBalance}>(paymentPath(id),{page},signal);}
export function recordSubscriptionPayment(id:string,input:PaymentInput){return requestJson<{data:SubscriptionPayment;replayed:boolean}>(paymentPath(id),{method:'POST',body:input});}
export function reviewSubscriptionPayment(id:string,paymentId:string,input:{decision:'verified'|'rejected';note:string;confirmed:boolean;selfReviewConfirmed:boolean}){return requestJson<{data:SubscriptionPayment}>(paymentPath(id)+'/'+encodeURIComponent(paymentId)+'/review',{method:'PUT',body:input});}
