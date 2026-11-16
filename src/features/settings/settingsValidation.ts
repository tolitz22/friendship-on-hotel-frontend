import {z} from 'zod';
export const settingsSchema=z.object({
 name:z.string().trim().min(2,'Enter a property name.').max(120),
 address:z.string().trim().min(4,'Enter a property address.').max(300),
 contactEmail:z.union([z.email(),z.literal('')]),
 contactPhone:z.string().max(40),
 timeZone:z.string().min(1),currency:z.literal('PHP'),
 checkInTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'Enter a valid check-in time.'),
 checkOutTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'Enter a valid check-out time.')
});
export function validateSettings(data:unknown){return settingsSchema.safeParse(data);}
export const demonstrationRules=[
 'Room-type counts and floor totals are derived from the example physical-room list.',
 'Displayed room-type rates are illustrative, not a real pricing or inventory configuration.',
 'Operational check-in and checkout times are mock preferences, not enforced reservation policies.',
 'Staff role permissions are display examples, not authentication or authorization enforcement.'
] as const;
