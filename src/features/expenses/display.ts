import {statusLabel} from '../../lib/format';
import type {ExpenseFilters} from '../../api/expenses';

declare module '@tanstack/react-router' {
 interface HistoryState {
  expenseRegister?:{hotel:string;filters:ExpenseFilters};
  recordedExpenseId?:string;
 }
}

const formatter=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'});
export const expenseMoney=(minor:number)=>formatter.format(minor/100);
export const expenseDepartmentLabels={
 rooms:'Rooms',
 maintenance:'Property operations & maintenance',
 administration:'Administration',
 utilities:'Energy, water & waste',
 food_beverage:'Food & beverage',
};
export function expenseReviewLabel(value:string){
 if(value==='not_required')return 'No review required';
 if(value==='pending')return 'Needs review';
 return statusLabel(value);
}
