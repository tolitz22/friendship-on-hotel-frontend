import type {Money} from '../api/types';
export const currency=(money:Money)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:money.currency}).format(money.amountMinor/100);
export const dateLabel=(date:string)=>new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export const statusLabel=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
