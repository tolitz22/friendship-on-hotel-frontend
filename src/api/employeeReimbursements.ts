import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
import {expenseDepartments} from './expenses';
const id=z.string().regex(/^[1-9]\d*$/);
const amount=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const claim=z.object({id,employeeId:id,employeeName:z.string(),merchant:z.string(),description:z.string(),department:z.enum(expenseDepartments),category:z.string(),receiptReference:z.string(),serviceDate:z.string(),currency:z.literal('PHP'),amountMinor:amount,paidMinor:amount,outstandingMinor:z.number().int(),status:z.enum(['pending','approved','rejected','partially_paid','paid','inconsistent']),reviewNote:z.string().nullable(),reviewedBy:id.nullable(),approvalDate:z.string().nullable(),createdAt:z.string()});
const payment=z.object({id,amountMinor:amount,paymentSource:z.enum(['hotel_bank','cashier_drawer']),evidenceReference:z.string(),businessDate:z.string(),shiftId:id.nullable()});
export type EmployeeClaim=z.infer<typeof claim>;
export type ClaimInput={requestKey:string;merchant:string;description:string;department:typeof expenseDepartments[number];category:string;receiptReference:string;serviceDate:string;amountMinor:number};
export type ReviewInput={requestKey:string;decision:'approve'|'reject';note:string};
export type ReimbursementInput={requestKey:string;amountMinor:number;paymentSource:'hotel_bank'|'cashier_drawer';evidenceReference:string;shiftId?:string};
function check(hotel:string){if(readSession().hotelId!==hotel)throw new Error('Selected hotel changed.');}
const root='/employee-reimbursements';
export function useEmployeeClaims(hotel:string,page:number){
 return useQuery({queryKey:['live','employee-claims',hotel,page],enabled:!!hotel,retry:false,queryFn:async()=>{check(hotel);const r=z.object({data:z.array(claim),meta:z.object({page:amount,totalPages:amount,total:amount}),postingEnabled:z.boolean()}).parse(await getJson<unknown>(hotelPath(root),{page,per_page:20}));check(hotel);return r;}});
}
export function useEmployeeClaim(hotel:string,claimId:string|null){
 return useQuery({queryKey:['live','employee-claim',hotel,claimId],enabled:!!hotel&&!!claimId,retry:false,queryFn:async()=>{check(hotel);const r=z.object({data:claim.extend({payments:z.array(payment)})}).parse(await getJson<unknown>(hotelPath(root+'/'+claimId))).data;check(hotel);if(r.id!==claimId)throw new Error('Unexpected claim returned.');return r;}});
}
async function write(hotel:string,path:string,input:ClaimInput|ReviewInput|ReimbursementInput,expected?:string){
 check(hotel);const r=z.object({data:z.object({claimId:id,replayed:z.boolean()})}).parse(await requestJson<unknown>(hotelPath(root+path),{method:'POST',body:input})).data;check(hotel);if(expected&&r.claimId!==expected)throw new Error('Unexpected claim returned.');return r;
}
export const submitEmployeeClaim=(hotel:string,input:ClaimInput)=>write(hotel,'',input);
export const reviewEmployeeClaim=(hotel:string,claimId:string,input:ReviewInput)=>write(hotel,'/'+claimId+'/decision',input,claimId);
export const payEmployeeClaim=(hotel:string,claimId:string,input:ReimbursementInput)=>write(hotel,'/'+claimId+'/payments',input,claimId);
