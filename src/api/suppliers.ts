import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson,requestJson} from './http';
import {readSession,hotelPath} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
const supplier=z.object({id,hotelId:id,name:z.string(),contactName:z.string().nullable(),email:z.string().nullable(),phone:z.string().nullable(),paymentTermsDays:z.number().int().min(0).max(365),isActive:z.boolean(),version:z.string().length(64)});
const list=z.object({data:z.array(supplier),meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative()})});
export type Supplier=z.infer<typeof supplier>;
export type SupplierInput=Pick<Supplier,'name'|'contactName'|'email'|'phone'|'paymentTermsDays'|'isActive'> & {version?:string};
export type SupplierFilters={search?:string;status:'active'|'inactive'|'all';page:number};
function checkHotel(hotel:string){if(readSession().hotelId!==hotel)throw new Error('Selected property changed. Reopen the supplier directory.');}
export function useSuppliers(hotel:string,filters:SupplierFilters){
 return useQuery({queryKey:['live','suppliers',hotel,filters],enabled:!!hotel,retry:false,queryFn:async()=>{
  checkHotel(hotel);const result=list.parse(await getJson<unknown>(hotelPath('/suppliers'),{...filters,per_page:20}));
  checkHotel(hotel);if(result.data.some(s=>s.hotelId!==hotel))throw new Error('Supplier data belongs to another property.');return result;
 }});
}
export async function saveSupplier(hotel:string,supplierId:string|null,input:SupplierInput){
 checkHotel(hotel);
 const result=z.object({data:supplier}).parse(await requestJson<unknown>(hotelPath('/suppliers'+(supplierId?'/'+encodeURIComponent(supplierId):'')),{method:supplierId?'PUT':'POST',body:input})).data;
 checkHotel(hotel);if(result.hotelId!==hotel||(supplierId&&result.id!==supplierId))throw new Error('Unexpected supplier returned.');return result;
}
