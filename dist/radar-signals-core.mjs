const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function normalizeSignals(data){
 if(!data||!Array.isArray(data.datasets))throw Error('Invalid Radar data');
 const keys=new Set();
 for(const d of data.datasets){
  if(!['outages','hijacks','leaks'].includes(d.kind)||!['1d','7d'].includes(d.window)||!stamp(d.fetchedAt))throw Error('Invalid dataset');
  const key=[d.kind,d.scope||'GLOBAL',d.window].join('|');if(keys.has(key))throw Error('Duplicate dataset');keys.add(key);
  {
   if(!Array.isArray(d.rows))throw Error('Missing events');
   for(const row of d.rows)if(!row||typeof row.id!=='string'||!stamp(row.start)||!Array.isArray(row.countries)||row.countries.some(c=>!/^[A-Z]{2}$/.test(c)))throw Error('Invalid event');
  }
 }
 return data;
}
export function signalRows(data,mode,{country='',query='',kind='',cause='',score=0,window='1d'}={}){
 const q=query.trim().toLowerCase();
 const datasets=data.datasets.filter(d=>mode==='bgp'?['hijacks','leaks'].includes(d.kind):d.kind===mode);
 return datasets.flatMap(d=>d.rows.map(r=>({...r,kind:d.kind,fetchedAt:d.fetchedAt}))).filter(r=>(!country||r.countries.includes(country))&&(!kind||r.kind===kind)&&(!cause||r.cause===cause)&&(!score||(r.kind==='hijacks'&&r.confidence>=score))&&(!q||JSON.stringify([r.description,r.scope,r.asns,r.actorAsn,r.otherAsns,r.organizations,r.prefixes,r.tags]).toLowerCase().includes(q))).sort((a,b)=>b.start.localeCompare(a.start));
}
export function signalsCSV(rows,mode){
 const fields=mode==='outages'?['id','countries','asns','start','end','cause','type','scope','description','fetchedAt']:['id','kind','countries','actorAsn','otherAsns','start','lastSeen','confidence','prefixes','tags','fetchedAt'];
 const quote=v=>'"'+String(Array.isArray(v)?v.join(' | '):v??'').replace(/^(\s*[=+\-@]|[\t\r])/,"'$&").replaceAll('"','""')+'"';
 return '\uFEFF'+[fields,...rows.map(row=>fields.map(f=>row[f]))].map(row=>row.map(quote).join(',')).join('\r\n');
}
