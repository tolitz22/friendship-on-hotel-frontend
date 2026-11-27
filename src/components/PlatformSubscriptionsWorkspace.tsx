import {useState} from 'react';
import {PlatformSubscriptionBillingPanel} from './PlatformSubscriptionBillingPanel';
import {PlatformPlansPanel} from './PlatformPlansPanel';
import {PlatformHotelSubscriptionsPanel} from './PlatformHotelSubscriptionsPanel';
export function PlatformSubscriptionsWorkspace({userId}:{userId:string}){
 const [view,setView]=useState<'agreements'|'catalog'|'billing'>('agreements');
 return <section aria-label="Subscriptions workspace"><div className="platform-tabs platform-subscription-tabs" role="group" aria-label="Subscription section"><button type="button" aria-pressed={view==='agreements'} aria-selected={view==='agreements'} onClick={()=>setView('agreements')}>Hotel subscriptions</button><button type="button" aria-pressed={view==='catalog'} aria-selected={view==='catalog'} onClick={()=>setView('catalog')}>Plan catalog</button><button type="button" aria-pressed={view==='billing'} aria-selected={view==='billing'} onClick={()=>setView('billing')}>Billing</button></div>{view==='agreements'?<PlatformHotelSubscriptionsPanel userId={userId}/>:view==='catalog'?<PlatformPlansPanel userId={userId}/>:<PlatformSubscriptionBillingPanel userId={userId} onAgreements={()=>setView('agreements')}/>}</section>;
}
