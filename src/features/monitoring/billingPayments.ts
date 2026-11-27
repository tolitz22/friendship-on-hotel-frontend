import type {InvoiceStatus,PaymentBalance,PaymentMethod} from '../../api/platformBilling';
export const invoiceLabels:Record<InvoiceStatus,string>={unpaid:'Unpaid',partially_paid:'Partially paid',paid:'Paid',overdue:'Overdue'};
export const paymentMethods:Record<PaymentMethod,string>={gcash:'GCash',maya:'Maya',bank_transfer:'Bank transfer',cash:'Cash'};
export function recordableBalance(balance:PaymentBalance){return Math.max(0,balance.outstandingMinor-balance.pendingMinor);}
