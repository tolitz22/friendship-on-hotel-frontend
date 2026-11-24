import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {readSession,hotelPath} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const amount=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const expenseDepartments=['rooms','maintenance','administration','utilities','food_beverage'] as const;
export const reviewStatuses=['pending','approved','flagged','not_required'] as const;
const expense=z.object({
 id,journalId:id,recordedBy:id,recordedByName:z.string().nullable(),shiftId:id.nullable(),
 payee:z.string(),description:z.string(),department:z.enum(expenseDepartments),category:z.string(),
 serviceDate:z.string(),businessDate:z.string(),currency:z.literal('PHP'),amountMinor:amount,
 paymentSource:z.enum(['cashier_drawer','hotel_bank','hotel_card']),paymentReference:z.string().nullable().optional(),paymentStatus:z.literal('paid'),
 reviewStatus:z.enum(reviewStatuses),reviewReason:z.string().nullable(),policyLimitMinor:amount.nullable(),
 invoiceReference:z.string().nullable(),createdAt:z.string(),
});
const review=z.object({reviewedBy:id,reviewedByName:z.string().nullable(),decision:z.enum(['approve','flag']),note:z.string(),createdAt:z.string()});
const list=z.object({data:z.array(expense),meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),total:amount,totalPages:amount}),
 summary:z.object({businessDate:z.string().nullable(),monthExpenseMinor:amount.nullable(),pendingReviewCount:amount,flaggedCount:amount,supplierBalancesSupported:z.boolean()}),
 postingEnabled:z.boolean()});
const policy=z.object({configured:z.boolean(),routineLimitMinor:amount.nullable()});
export type Expense=z.infer<typeof expense>;
export type ExpenseFilters={page?:number;department?:typeof expenseDepartments[number];reviewStatus?:typeof reviewStatuses[number];search?:string;from?:string;to?:string};
export type ExpenseInput={requestKey:string;payee:string;description:string;department:typeof expenseDepartments[number];category:string;serviceDate:string;amountMinor:number;invoiceReference?:string};
export type DirectExpenseInput=ExpenseInput & {paymentSource:'hotel_bank'|'hotel_card';paymentReference:string};
function scoped(hotel:string,path:string){
 if(readSession().hotelId!==hotel)throw new Error('Property changed. Reopen this form for the selected hotel.');
 return hotelPath(path);
}
function verifyHotel(hotel:string){if(readSession().hotelId!==hotel)throw new Error('Property changed during the request.');}
export function useExpenses(hotel:string|null,enabled:boolean,filters:ExpenseFilters){
 return useQuery({queryKey:['live','expenses',hotel,filters],enabled:enabled&&!!hotel,retry:false,
 queryFn:async()=>{const result=list.parse(await getJson<unknown>(scoped(hotel!,'/expenses'),{...filters,per_page:20}));verifyHotel(hotel!);return result;}});
}
export function useExpenseDetail(hotel:string|null,expenseId:string|null){
 return useQuery({queryKey:['live','expense-detail',hotel,expenseId],enabled:!!hotel&&!!expenseId,retry:false,
 queryFn:async()=>{const result=z.object({data:expense.extend({review:review.nullable()})}).parse(await getJson<unknown>(scoped(hotel!,'/expenses/'+encodeURIComponent(expenseId!)))).data;
 verifyHotel(hotel!);if(result.id!==expenseId)throw new Error('Unexpected expense returned.');return result;}});
}
export function useExpensePolicy(hotel:string|null,enabled:boolean){
 return useQuery({queryKey:['live','expense-policy',hotel],enabled:enabled&&!!hotel,retry:false,
 queryFn:async()=>{const result=z.object({data:policy}).parse(await getJson<unknown>(scoped(hotel!,'/expenses/policy'))).data;verifyHotel(hotel!);return result;}});
}
export async function recordExpensePayout(hotel:string,shift:string,input:ExpenseInput){
 const result=z.object({data:z.object({expenseId:id,payoutId:id,journalId:id,replayed:z.boolean()})}).parse(await requestJson<unknown>(scoped(hotel,'/cashier-shifts/'+encodeURIComponent(shift)+'/expense-payouts'),{method:'POST',body:input})).data;
 verifyHotel(hotel);return result;
}
export async function recordDirectExpense(hotel:string,input:DirectExpenseInput){
 const result=z.object({data:z.object({expenseId:id,journalId:id,replayed:z.boolean()})}).parse(
  await requestJson<unknown>(scoped(hotel,'/expenses'),{method:'POST',body:input})).data;
 verifyHotel(hotel);return result;
}
export async function reviewExpense(hotel:string,expenseId:string,decision:'approve'|'flag',note:string){
 const result=z.object({data:z.object({expenseId:id,reviewStatus:z.enum(reviewStatuses),replayed:z.boolean()})}).parse(await requestJson<unknown>(scoped(hotel,'/expenses/'+encodeURIComponent(expenseId)+'/review'),{method:'POST',body:{decision,note}})).data;
 verifyHotel(hotel);if(result.expenseId!==expenseId)throw new Error('Unexpected expense returned.');return result;
}

export async function updateExpensePolicy(hotel:string,routineLimitMinor:number,reason:string){
 const result=z.object({data:policy}).parse(await requestJson<unknown>(scoped(hotel,'/expenses/policy'),{method:'PUT',body:{routineLimitMinor,reason}})).data;
 verifyHotel(hotel);return result;
}

const expenseExceptions=z.object({
 hotelId:id,pendingCorrectionCount:amount,pendingReturnCount:amount,flaggedReturnCount:amount,unresolvedClearingCount:amount,
 items:z.array(z.object({kind:z.enum(['pending_correction','pending_return','flagged_return','unresolved_clearing']),id,expenseId:id,description:z.string(),businessDate:z.iso.date(),amountMinor:z.number().int().nullable()})),
});
export type ExpenseExceptions=z.infer<typeof expenseExceptions>;
export function useExpenseExceptions(hotel:string){
 return useQuery({queryKey:['live','expense-exceptions',hotel],enabled:!!hotel,retry:false,
 queryFn:async()=>{const result=z.object({data:expenseExceptions}).parse(await getJson<unknown>(scoped(hotel,'/expenses/exceptions'))).data;
 verifyHotel(hotel);if(result.hotelId!==hotel)throw new Error('Expense exceptions belong to a different hotel.');return result;}});
}
