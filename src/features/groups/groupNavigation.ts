/** Only known group tabs are accepted from URL state. */
export type GroupDetailTab='rooms'|'billing'|'activity';
export function parseGroupDetailTab(value:unknown):GroupDetailTab|undefined {
 return value==='rooms'||value==='billing'||value==='activity'?value:undefined;
}
