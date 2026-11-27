import {useInfiniteQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath} from './session';

export const auditCategories=['bookings','housekeeping','maintenance','staff','catalog','payments','cashier','expenses','finance'] as const;
export type AuditCategory=typeof auditCategories[number];
const categorySchema=z.enum(auditCategories);
const positiveId=z.string().regex(/^[1-9][0-9]*$/);
const schema=z.object({
 data:z.object({hotelId:positiveId,items:z.array(z.object({
  id:z.string().regex(/^[1-9][0-9]*:[1-9][0-9]*$/),category:categorySchema,source:z.string(),
  subjectId:positiveId,actorId:positiveId.nullable(),action:z.string(),createdAt:z.string(),
 }))}),
 meta:z.object({readOnly:z.literal(true),days:z.number().int().min(1).max(90),categories:z.array(categorySchema),nextCursor:z.string().nullable()}),
});
export function parseBusinessAudit(value:unknown,hotelId:string,category:AuditCategory|'all',days:number){
 const result=schema.parse(value);
 if(result.data.hotelId!==hotelId||result.meta.days!==days||result.data.items.some(item=>category!=='all'&&item.category!==category))
  throw new Error('Audit response does not match the selected hotel or filters.');
 return result;
}
export function useBusinessAudit(hotelId:string,category:AuditCategory|'all',days:number){
 return useInfiniteQuery({
  queryKey:['live','business-audit',hotelId,category,days],
  enabled:!!hotelId,
  initialPageParam:null as string|null,
  queryFn:({pageParam})=>getJson<unknown>(hotelPath('/business-audit'),{
   category:category==='all'?undefined:category,days,per_page:25,cursor:pageParam??undefined,
  }).then(value=>parseBusinessAudit(value,hotelId,category,days)),
  getNextPageParam:last=>last.meta.nextCursor??undefined,
  retry:false,
 });
}
