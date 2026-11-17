/** Identifies a linked task view without trusting its ID outside the hotel context.
 * The caller persists the returned key after opening. A refetch of the same
 * task must not replace unsaved user input in the editor. */
export function linkedTaskKey(hotelId:string|null,taskId:string|null):string|null{
 if(!hotelId||!taskId||!/^[1-9][0-9]*$/.test(hotelId)||!/^[1-9][0-9]*$/.test(taskId))
  return null;
 return hotelId+':'+taskId;
}
export function shouldOpenLinkedTask(lastOpened:string|null,hotelId:string|null,taskId:string|null){
 const current=linkedTaskKey(hotelId,taskId);
 return current!==null&&current!==lastOpened;
}
