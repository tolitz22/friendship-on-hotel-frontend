import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {readSession,hotelPath} from './session';
import {expenseDepartments} from './expenses';
const id=z.string().regex(/^[1-9]\d*$/);
const amount=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const signed=z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const bill=z.object({id,supplierId:id,supplierName:z.string(),invoiceReference:z.string(),description:z.string(),department:z.enum(expenseDepartments),category:z.string(),invoiceDate:z.string(),serviceDate:z.string(),dueDate:z.string(),businessDate:z.string(),currency:z.literal('PHP'),amountMinor:amount,paidMinor:amount,outstandingMinor:signed,paymentStatus:z.enum(['unpaid','partially_paid','paid','inconsistent']),overdue:z.boolean(),journalId:id,recordedBy:id,createdAt:z.string()});
const payment=z.object({id,journalId:id,amountMinor:amount,paymentSource:z.enum(['hotel_bank','cashier_drawer']),shiftId:id.nullable(),evidenceReference:z.string(),businessDate:z.string(),recordedBy:id,recordedByName:z.string().nullable(),createdAt:z.string()});
const register=z.object({data:z.array(bill),meta:z.object({page:amount,perPage:amount,total:amount,totalPages:amount}),summary:z.object({businessDate:z.string().nullable(),outstandingMinor:amount,outstandingCount:amount,overdueMinor:amount.nullable(),overdueCount:amount.nullable(),inconsistentCount:amount}),postingEnabled:z.boolean()});
export type SupplierBill=z.infer<typeof bill>;
export type BillFilters={page:number;search?:string;status:'all'|'unpaid'|'partially_paid'|'paid'|'overdue'|'inconsistent'};
export type BillInput={requestKey:string;supplierId:string;invoiceReference:string;description:string;department:typeof expenseDepartments[number];category:string;invoiceDate:string;serviceDate:string;dueDate:string;amountMinor:number};
export type BillPaymentInput={requestKey:string;amountMinor:number;paymentSource:'hotel_bank'|'cashier_drawer';evidenceReference:string;shiftId?:string};
function check(hotel:string){if(readSession().hotelId!==hotel)throw new Error('Selected hotel changed. Reopen this workspace.');}
export function useSupplierBills(hotel:string,filters:BillFilters){
 return useQuery({queryKey:['live','supplier-bills',hotel,filters],enabled:!!hotel,retry:false,queryFn:async()=>{check(hotel);const result=register.parse(await getJson<unknown>(hotelPath('/supplier-bills'),{...filters,per_page:20}));check(hotel);return result;}});
}
export function useSupplierBill(hotel:string,billId:string|null){
 return useQuery({queryKey:['live','supplier-bill',hotel,billId],enabled:!!hotel&&!!billId,retry:false,queryFn:async()=>{check(hotel);const result=z.object({data:bill.extend({payments:z.array(payment)})}).parse(await getJson<unknown>(hotelPath('/supplier-bills/'+encodeURIComponent(billId!)))).data;check(hotel);if(result.id!==billId)throw new Error('Unexpected bill returned.');return result;}});
}
export async function recordSupplierBill(hotel:string,input:BillInput){
 check(hotel);const result=z.object({data:z.object({billId:id,journalId:id,replayed:z.boolean()})}).parse(await requestJson<unknown>(hotelPath('/supplier-bills'),{method:'POST',body:input})).data;check(hotel);return result;
}
export async function recordSupplierPayment(hotel:string,billId:string,input:BillPaymentInput){
 check(hotel);const result=z.object({data:z.object({billId:id,paymentId:id,journalId:id,paidMinor:amount,outstandingMinor:amount,paymentStatus:z.enum(['paid','partially_paid']),replayed:z.boolean()})}).parse(await requestJson<unknown>(hotelPath('/supplier-bills/'+encodeURIComponent(billId)+'/payments'),{method:'POST',body:input})).data;check(hotel);if(result.billId!==billId)throw new Error('Unexpected payment returned.');return result;
}
