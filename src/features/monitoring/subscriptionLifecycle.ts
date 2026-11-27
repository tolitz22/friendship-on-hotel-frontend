import type {HotelSubscription,SubscriptionStatus} from '../../api/platformSubscriptions';
export function subscriptionActions(subscription:HotelSubscription|null):('trial'|'assign'|'renew')[]{
 if(!subscription)return ['trial','assign'];
 if(subscription.kind==='trial')return ['assign'];
 return subscription.status==='expired'?['renew','assign']:['renew'];
}
export const subscriptionLabels:Record<SubscriptionStatus,string>={unassigned:'Unassigned',trial:'Trial',active:'Active agreement',expired:'Expired'};
export function calendarDate(date:string){
 return new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
}
