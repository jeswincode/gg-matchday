export function formatDate(value){
  if(!value) return "—";
  return new Date(value).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
}
