/** Accept a booking ID from staff links, including an accidentally quoted ID.
 * Only decimal positive IDs are allowed. Do not infer identity from arbitrary text. */
export function normalizeBillingBookingId(value:unknown):string|undefined{
 const raw=typeof value==='string'?value.trim():typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
 const normalized=raw.replace(/^"([1-9][0-9]*)"$/,'$1');
 return /^[1-9][0-9]*$/.test(normalized)?normalized:undefined;
}
