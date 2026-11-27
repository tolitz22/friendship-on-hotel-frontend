import {z} from 'zod';
import {getJson,requestJson} from './http';
import {hotelPath,readSession} from './session';
const id=z.string().regex(/^[1-9]\d*$/);
const item=z.object({id,hotelId:id,roomId:id,roomNumber:z.string(),description:z.string(),storageLocation:z.string(),
 status:z.enum(['stored','returned','disposed']),reportedBy:id,revision:z.number().int().positive(),reportedAt:z.string(),updatedAt:z.string()});
export type LostFoundItem=z.infer<typeof item>;
export type CustodyAction='move'|'return'|'dispose';
const list=z.object({data:z.array(item),meta:z.object({hotelId:id,page:z.number().int().positive(),total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative()})});
const history=z.object({data:z.array(z.object({id,actorId:id,action:z.enum(['registered','move','return','dispose']),before:z.object({status:z.string(),storageLocation:z.string()}).nullable(),after:z.object({status:z.string(),storageLocation:z.string()}),note:z.string().nullable(),createdAt:z.string()})),meta:z.object({page:z.number().int().positive(),totalPages:z.number().int().nonnegative()})});
function scope(hotelId:string){if(readSession().hotelId!==hotelId)throw new Error('Hotel changed. Reload lost & found.');}
export function parseLostFoundList(raw:unknown,hotelId:string,userId?:string){
 const result=list.parse(raw);
 if(result.meta.hotelId!==hotelId||result.data.some(row=>row.hotelId!==hotelId||userId!==undefined&&row.reportedBy!==userId))throw new Error('Lost and found scope mismatch.');
 return result;
}
export async function listLostFound(hotelId:string,page:number,status:string,userId?:string){
 scope(hotelId);return parseLostFoundList(await getJson<unknown>(hotelPath('/lost-found'),{page,status:status||undefined}),hotelId,userId);
}
export async function createLostFound(hotelId:string,body:{roomId:string;description:string;storageLocation:string;requestKey:string}){
 scope(hotelId);const result=z.object({data:item}).parse(await requestJson<unknown>(hotelPath('/lost-found'),{method:'POST',body})).data;
 if(result.hotelId!==hotelId||result.roomId!==body.roomId)throw new Error('Lost and found report scope mismatch.');return result;
}
export async function updateLostFound(hotelId:string,row:LostFoundItem,body:{action:CustodyAction;note:string;storageLocation?:string}){
 scope(hotelId);const result=z.object({data:item}).parse(await requestJson<unknown>(hotelPath('/lost-found/'+row.id),{method:'PATCH',body:{...body,expectedRevision:row.revision}})).data;
 if(result.hotelId!==hotelId||result.id!==row.id)throw new Error('Lost and found update scope mismatch.');return result;
}
export async function lostFoundHistory(hotelId:string,itemId:string,page:number){
 scope(hotelId);return history.parse(await getJson<unknown>(hotelPath('/lost-found/'+itemId+'/history'),{page}));
}
