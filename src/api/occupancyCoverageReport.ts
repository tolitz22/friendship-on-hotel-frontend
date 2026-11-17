import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {getJson} from './http';
import {hotelPath,readSession} from './session';

const id=z.string().regex(/^[1-9]\d*$/);
export const coverageFilters=['all','missing','assigned','needs_review','flagged','mismatch','verified'] as const;
export type CoverageFilter=typeof coverageFilters[number];
const rowSchema=z.object({
 roomId:id,roomNumber:z.string(),floor:z.number().int().nullable(),
 verificationId:id.nullable(),
 status:z.enum(['missing','assigned','submitted','verified','flagged']),
 discrepancy:z.enum(['unverified','match','unexpected_occupied','expected_occupied_vacant']).nullable(),
 expectedOccupancy:z.enum(['occupied','vacant']).nullable(),
 observedOccupancy:z.enum(['occupied','vacant','unknown']).nullable(),
 assignedUserId:id.nullable(),observedBy:id.nullable(),reviewedBy:id.nullable(),
 observedAt:z.string().nullable(),reviewedAt:z.string().nullable(),
});
const summarySchema=z.object({
 hotelId:id,inspectionDate:z.iso.date(),hotelDate:z.iso.date(),
 roomCount:z.number().int().nonnegative(),missing:z.number().int().nonnegative(),
 assigned:z.number().int().nonnegative(),submitted:z.number().int().nonnegative(),
 verified:z.number().int().nonnegative(),flagged:z.number().int().nonnegative(),
 observed:z.number().int().nonnegative(),checked:z.number().int().nonnegative(),
 unexpectedOccupied:z.number().int().nonnegative(),expectedOccupiedVacant:z.number().int().nonnegative(),
 unverified:z.number().int().nonnegative(),matching:z.number().int().nonnegative(),
 coveragePercent:z.number().min(0).max(100),observationPercent:z.number().min(0).max(100),
 historicalSnapshotOnly:z.literal(true),
});
const responseSchema=z.object({
 data:z.array(rowSchema),summary:summarySchema,
 meta:z.object({page:z.number().int().positive(),perPage:z.number().int().positive(),
 total:z.number().int().nonnegative(),totalPages:z.number().int().nonnegative(),
 filter:z.enum(coverageFilters)}),
});
export type CoverageRow=z.infer<typeof rowSchema>;
export type CoverageSummary=z.infer<typeof summarySchema>;
export function parseCoverageReport(value:unknown,hotelId:string,filter:CoverageFilter,date?:string){
 const result=responseSchema.parse(value);
 if(result.summary.hotelId!==hotelId)throw new Error('Occupancy coverage belongs to another hotel.');
 if(result.meta.filter!==filter)throw new Error('Occupancy coverage returned a different filter.');
 if(date&&result.summary.inspectionDate!==date)throw new Error('Occupancy coverage returned a different inspection date.');
 if(result.summary.checked+result.summary.missing!==result.summary.roomCount
  ||result.summary.observed!==result.summary.submitted+result.summary.verified+result.summary.flagged
  ||result.data.some(row=>row.status==='missing'&&row.verificationId!==null))
  throw new Error('The occupancy coverage totals are inconsistent.');
 return result;
}
export function useOccupancyCoverageReport(enabled:boolean,page:number,filter:CoverageFilter,date?:string){
 const {hotelId}=readSession();
 return useQuery({
  queryKey:['live','occupancy-coverage-report',hotelId,date,filter,page],
  enabled:enabled&&!!hotelId,
  queryFn:async()=>parseCoverageReport(await getJson<unknown>(hotelPath('/occupancy-coverage-report'),{
   date,filter,page,per_page:25,
  }),hotelId!,filter,date),
  retry:false,
 });
}
