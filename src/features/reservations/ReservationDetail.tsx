import {X,BedDouble,CalendarDays,Users,Receipt} from 'lucide-react';
import type {Reservation} from '../../api/types';
import {currency,dateLabel,statusLabel} from '../../lib/format';
import {Status} from '../../components/ui';
import {useEffect,useRef} from 'react';

export function ReservationDetail({reservation,onClose}:{reservation:Reservation|null;onClose:()=>void}) {
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!reservation)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    closeRef.current?.focus();
    const onKeyDown=(e:KeyboardEvent)=>{
      if(e.key==='Escape')onClose();
      if(e.key==='Tab'){
        const panel=document.querySelector<HTMLElement>('[data-reservation-dialog]');
        const focusable=panel?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if(focusable?.length){
          const first=focusable[0],last=focusable[focusable.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }
      }
    };
    window.addEventListener('keydown',onKeyDown);
    return ()=>{window.removeEventListener('keydown',onKeyDown);previous?.focus();};
  },[reservation,onClose]);
  if(!reservation)return null;
  return <div className="reservation-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="reservation-dialog-title" data-reservation-dialog className="reservation-drawer">
      <div className="detail-top"><span className="detail-kicker">RESERVATION DETAILS · READ ONLY</span><button ref={closeRef} className="icon-btn" aria-label="Close reservation details" onClick={onClose}><X size={19}/></button></div>
      <h2 id="reservation-dialog-title">{reservation.primaryGuestName}</h2>
      <p className="detail-ref">{reservation.reference}</p><Status value={statusLabel(reservation.status)}/>
      <div className="detail-fields">
        <div><CalendarDays size={19}/><div><small>Check-in</small><strong>{dateLabel(reservation.checkIn)}</strong></div></div>
        <div><CalendarDays size={19}/><div><small>Check-out (exclusive night)</small><strong>{dateLabel(reservation.checkOut)}</strong></div></div>
        <div><BedDouble size={19}/><div><small>Room type / assignment</small><strong>{reservation.roomTypeName} · {reservation.assignedRoomNumber?('Room '+reservation.assignedRoomNumber):'Not assigned'}</strong></div></div>
        <div><Users size={19}/><div><small>Occupants</small><strong>{reservation.adults} adults · {reservation.children} children</strong></div></div>
        <div><Receipt size={19}/><div><small>Example total</small><strong>{currency(reservation.total)}</strong></div></div>
      </div>
      <div className="detail-note">This is a UI preview. Room type reservations are not automatically physical-room allocations. Modifications, check-in and payments remain disabled until Laravel rules are approved.</div>
    </section>
  </div>;
}
