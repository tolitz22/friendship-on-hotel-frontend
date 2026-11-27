export function pesosToMinor(input:string):number|null{
 const value=input.trim();
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(value))return null;
 const [whole,fraction='']=value.split('.');
 const minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(minor)&&minor<=999999999?minor:null;
}
export function minorToPesos(value:number){return (value/100).toFixed(2);}
export function formatPlanPrice(value:number){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value/100);}
export function parsePlanLimit(input:string):number|null|undefined{
 const value=input.trim();
 if(value==='')return null;
 if(!/^\d{1,6}$/.test(value))return undefined;
 const n=Number(value);return n>=1&&n<=100000?n:undefined;
}
