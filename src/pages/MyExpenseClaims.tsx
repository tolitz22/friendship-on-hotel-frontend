import {dataMode} from '../api';
import {useHotelAuth} from '../components/AuthProvider';
import {EmployeeReimbursements} from '../components/EmployeeReimbursements';
import {Heading} from '../components/ui';

export function MyExpenseClaims(){
 const {hotelId,user}=useHotelAuth();
 const permissions=user?.hotels.find(hotel=>hotel.id===hotelId)?.permissions;
 if(dataMode!=='api'||!hotelId||!user||!permissions?.includes('reimbursement.read_own')){
  return <Heading title="My expense claims" description="Expense claim access is required."/>;
 }
 return <EmployeeReimbursements key={hotelId+':'+user.id} hotel={hotelId}
  userId={user.id} admin={false} canSubmit={permissions.includes('reimbursement.submit')}/>;
}
