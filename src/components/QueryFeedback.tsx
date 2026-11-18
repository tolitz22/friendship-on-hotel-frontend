import {AlertTriangle,LoaderCircle,SearchX} from 'lucide-react';
import {ApiError} from '../api/http';

export function messageForQueryError(error:Error):{title:string;action:string}{
 if(error instanceof ApiError){
  if(error.status===404&&/route\s+.*could not be found|route\s+.*not found/i.test(error.message)){
   return {
    title:'This page is temporarily unavailable',
    action:'Please try again later. If the problem continues, contact your hotel administrator.',
   };
  }
  if(error.status===401||error.status===419)return{
   title:'Your session needs attention',
   action:'Sign in again before reloading this hotel information.',
  };
  if(error.status===403)return{
   title:'You do not have access to these records',
   action:'Ask a hotel administrator to review your role.',
  };
  if(error.status===409)return{
   title:'The record has changed',
   action:'Reload current records before attempting an operation.',
  };
  if(error.status===0)return{
   title:'Unable to connect to the hotel system',
   action:'Check your internet connection and try again. If the issue continues, contact your hotel administrator.',
  };
  if(error.status>=500)return{
   title:'Hotel service temporarily unavailable',
   action:'Try again. If the problem continues, contact your administrator.',
  };
 }
 return {
  title:'Unable to load this information',
  action:'The records could not be verified. Check the details and retry.',
 };
}

export function QueryFeedback({
 loading,error,empty=false,onRetry,emptyMessage='No matching records found.',
}:{
 loading:boolean;error:Error|null;empty?:boolean;
 onRetry?:()=>void;emptyMessage?:string;
}){
 if(loading)return <div className="query-feedback" role="status">
  <LoaderCircle size={18} aria-hidden="true" className="loading-spin"/>
  Loading hotel records…
 </div>;
 if(error){
  const {title,action}=messageForQueryError(error);
  return <div className="query-feedback error" role="alert">
   <AlertTriangle size={19} aria-hidden="true"/>
   <div className="feedback-content">
    <strong>{title}</strong>
    <span>{action}</span>
   </div>
   {onRetry&&<button type="button" onClick={onRetry}>Retry</button>}
  </div>;
 }
 if(empty)return <div className="query-feedback empty" role="status">
  <SearchX size={18} aria-hidden="true"/>{emptyMessage}
 </div>;
 return null;
}
