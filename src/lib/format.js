export const rating=value=>typeof value==='number'?value.toFixed(2):'—';
export const date=value=>new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
