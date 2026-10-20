export function normalizeIncidents(data){
 if(!data||!Array.isArray(data.incidents)||!Array.isArray(data.sources)||data.windowDays!==90)throw Error('Invalid incident feed');
 const allowedHosts=new Set(['status.jottacloud.com','status.teamsupport.com','17hats.statuspage.io','www.cloudflarestatus.com','status.proton.me','status.render.com','status.discord.com']),seen=new Set();
 for(const source of data.sources){const url=new URL(source.url);if(url.protocol!=='https:'||url.username||url.password||!allowedHosts.has(url.hostname))throw Error('Invalid source');}
 for(const r of data.incidents){
  const u=new URL(r.sourceUrl);
  if(!r||seen.has(r.id)||typeof r.entity!=='string'||!Array.isArray(r.components)||r.components.some(v=>typeof v!=='string')||r.evidence!=='provider_mentions_ddos'||u.protocol!=='https:'||u.username||u.password||!allowedHosts.has(u.hostname)||!/^\/incidents\/[a-z0-9]{6,40}$/.test(u.pathname)||u.search||u.hash||!['startedAt','reportedAt','updatedAt','fetchedAt'].every(k=>typeof r[k]==='string'&&Number.isFinite(Date.parse(r[k]))))throw Error('Invalid record');
  seen.add(r.id);
 }
 return data;
}
export function selectIncidents(rows,{query='',entity='',status='',sort='new'}={}){
 const q=query.trim().toLowerCase();
 return rows.filter(r=>(!entity||r.entity===entity)&&(!status||r.status===status)&&(!q||[r.entity,r.referenceDomain,...r.components].join(' ').toLowerCase().includes(q))).sort((a,b)=>sort==='updated'?b.updatedAt.localeCompare(a.updatedAt):b.startedAt.localeCompare(a.startedAt));
}
export function incidentsCSV(rows){
 const fields=['entity','referenceDomain','components','startedAt','reportedAt','updatedAt','status','evidence','sourceUrl','fetchedAt'];
 const quote=v=>'"'+String(Array.isArray(v)?v.join(' | '):v??'').replace(/^(\s*[=+\-@]|[\t\r])/,"'$&").replaceAll('"','""')+'"';
 return '\uFEFF'+[fields,...rows.map(r=>fields.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\r\n');
}
