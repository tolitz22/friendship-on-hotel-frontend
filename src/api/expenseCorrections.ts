import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
import {expenseDepartments} from './expenses';

const id=z.string().regex(/^[1-9]\d*$/);
const minor=z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const amount=minor.nonnegative();
const correction=z.object({id,kind:z.enum(['amount_correction','reclassification']),reason:z.string(),
 requestedBy:id,requestedByName:z.string().nullable(),createdAt:z.string(),
 correctedAmountMinor:amount.nullable(),correctedDepartment:z.enum(expenseDepartments).nullable(),correctedCategory:z.string().nullable(),
 decision:z.enum(['approve','reject']).nullable(),note:z.string().nullable(),reviewedBy:id.nullable(),
 reviewedByName:z.string().nullable(),decidedAt:z.string().nullable(),journalId:id.nullable(),adjustmentBusinessDate:z.string().nullable()});
const cashReturn=z.object({id,shiftId:id,journalId:id,amountMinor:amount,correctionId:id.nullable(),
 reason:z.string(),evidenceReference:z.string(),recordedBy:id,recordedByName:z.string().nullable(),
 businessDate:z.string(),createdAt:z.string(),decision:z.enum(['approve','flag']).nullable(),
 note:z.string().nullable(),reviewedBy:id.nullable(),reviewedByName:z.string().nullable(),reviewedAt:z.string().nullable()});
const history=z.object({hotelId:id,expenseId:id,correctionsEnabled:z.boolean(),originalAmountMinor:amount,
 netRecordedExpenseMinor:minor,effectiveDepartment:z.enum(expenseDepartments),effectiveCategory:z.string(),
 clearingBalanceMinor:minor,cashReturnedMinor:amount,unapprovedCashReturnCount:amount,
 corrections:z.array(correction),cashReturns:z.array(cashReturn)});
export type ExpenseHistory=z.infer<typeof history>;
export type CorrectionInput={requestKey:string;reason:string}&({kind:'amount_correction';correctedAmountMinor:number}|{kind:'reclassification';correctedDepartment:typeof expenseDepartments[number];correctedCategory:string});
export type CashReturnInput={requestKey:string;amountMinor:number;reason:string;evidenceReference:string;correctionId?:string};
function scoped(hotel:string,path:string){if(readSession().hotelId!==hotel)throw new Error('Property changed.');return hotelPath(path);}
function verify(hotel:string){if(readSession().hotelId!==hotel)throw new Error('Property changed during request.');}
export function useExpenseHistory(hotel:string,expense:string){
 return useQuery({queryKey:['live','expense-history',hotel,expense],enabled:!!hotel&&!!expense,retry:false,
 queryFn:async()=>{const result=z.object({data:history}).parse(await getJson<unknown>(scoped(hotel,'/expenses/'+encodeURIComponent(expense)+'/history'))).data;
 verify(hotel);if(result.hotelId!==hotel||result.expenseId!==expense)throw new Error('Unexpected voucher history.');return result;}});
}
export async function requestCorrection(hotel:string,expense:string,input:CorrectionInput){
 const result=z.object({data:z.object({correctionId:id,replayed:z.boolean()})}).parse(await requestJson<unknown>(scoped(hotel,'/expenses/'+encodeURIComponent(expense)+'/corrections'),{method:'POST',body:input})).data;verify(hotel);return result;
}
export async function decideCorrection(hotel:string,correctionId:string,decision:'approve'|'reject',note:string){
 const result=z.object({data:z.object({correctionId:id,decision:z.enum(['approve','reject']),journalId:id.nullable(),replayed:z.boolean()})}).parse(await requestJson<unknown>(scoped(hotel,'/expense-corrections/'+encodeURIComponent(correctionId)+'/decision'),{method:'POST',body:{decision,note}})).data;
 verify(hotel);if(result.correctionId!==correctionId||result.decision!==decision)throw new Error('Unexpected correction result.');return result;
}
export async function recordCashReturn(hotel:string,shift:string,expense:string,input:CashReturnInput){
 const result=z.object({data:z.object({cashReturnId:id,journalId:id,replayed:z.boolean()})}).parse(await requestJson<unknown>(scoped(hotel,'/cashier-shifts/'+encodeURIComponent(shift)+'/expenses/'+encodeURIComponent(expense)+'/cash-returns'),{method:'POST',body:input})).data;verify(hotel);return result;
}
export async function reviewCashReturn(hotel:string,returnId:string,decision:'approve'|'flag',note:string){
 const result=z.object({data:z.object({cashReturnId:id,decision:z.enum(['approve','flag']),replayed:z.boolean()})}).parse(await requestJson<unknown>(scoped(hotel,'/expense-cash-returns/'+encodeURIComponent(returnId)+'/review'),{method:'POST',body:{decision,note}})).data;
 verify(hotel);if(result.cashReturnId!==returnId||result.decision!==decision)throw new Error('Unexpected cash return result.');return result;
}

export async function getCashReturnQuote(hotel:string,shift:string,expense:string){
 const quote=z.object({hotelId:id,shiftId:id,expenseId:id,payee:z.string(),description:z.string(),originalAmountMinor:amount,maximumReturnMinor:amount,correctionId:id.nullable(),blockedReason:z.string().nullable()});
 const result=z.object({data:quote}).parse(await getJson<unknown>(scoped(hotel,'/cashier-shifts/'+encodeURIComponent(shift)+'/expenses/'+encodeURIComponent(expense)+'/cash-return-quote'))).data;
 verify(hotel);if(result.hotelId!==hotel||result.shiftId!==shift||result.expenseId!==expense)throw new Error('Unexpected voucher lookup.');return result;
}
export type CashReturnQuote=Awaited<ReturnType<typeof getCashReturnQuote>>;
