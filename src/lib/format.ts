import type {Money} from '../api/types';
export const currency=(money:Money)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:money.currency}).format(money.amountMinor/100);
export const dateLabel=(date:string)=>new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export const statusLabel=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

/** Present hotel calendar dates without UTC/local timezone date rollover.
 * Keep raw ISO values in API requests, logs and accounting storage. */
export function readableDate(value:string|null|undefined):string{
 if(!value)return '—';
 const match=/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value);
 if(!match)return value;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const parsed=new Date(Date.UTC(year,month-1,day,12));
 if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)return value;
 return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(parsed);
}

/** Display an ISO instant in the hotel's Philippine timezone with a readable clock.
 * Do not guess a time for date-only fields. */
export function readableDateTime(value:string|null|undefined,timeZone='Asia/Manila'):string{
 if(!value)return '—';
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return readableDate(value);
 const instant=new Date(value);
 if(!Number.isFinite(instant.getTime()))return value;
 return new Intl.DateTimeFormat('en-PH',{
  month:'short',day:'numeric',year:'numeric',
  hour:'numeric',minute:'2-digit',hour12:true,timeZone,
 }).format(instant);
}
