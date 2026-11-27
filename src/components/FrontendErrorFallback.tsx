import {useEffect} from 'react';
import {reportFrontendError} from '../features/telemetry/frontendErrors';

export function FrontendErrorFallback({error,reset}:{error:unknown;reset:()=>void}){
 useEffect(()=>{reportFrontendError('route_error',{error});},[error]);
 return <section role="alert" className="mx-auto my-8 max-w-lg rounded-xl border border-slate-200 p-6">
  <h2 className="text-lg font-semibold">This page could not load</h2>
  <p className="mt-2 text-sm">Try opening the page again. If you were saving a booking or payment, check its current status before repeating the action.</p>
  <div className="mt-4 flex flex-wrap gap-3">
   <button type="button" className="rr-secondary-action" onClick={reset}>Try again</button>
   <a href="/" className="rr-secondary-action">Return to dashboard</a>
  </div>
 </section>;
}
