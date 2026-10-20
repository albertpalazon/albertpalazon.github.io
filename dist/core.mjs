export const FEED = 'https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json';
export function normalize(data) {
  if (!data || !Array.isArray(data.vulnerabilities) || !data.vulnerabilities.length) throw new Error('Invalid catalog');
  const seen = new Set();
  const rows = data.vulnerabilities.map(r => {
    if (!/^CVE-\d{4}-\d{4,}$/.test(r.cveID) || seen.has(r.cveID) || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateAdded)) throw new Error('Invalid record');
    seen.add(r.cveID);
    return r;
  }).sort((a,b) => b.dateAdded.localeCompare(a.dateAdded) || b.cveID.localeCompare(a.cveID));
  return {...data, count: rows.length, vulnerabilities:rows};
}
export function selectRows(rows, {query='', vendor='', ransomware=false, sort='new'}={}) {
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const filtered = rows.filter(r => (!vendor || r.vendorProject === vendor) && (!ransomware || r.knownRansomwareCampaignUse === 'Known') && (!q || [r.cveID,r.vendorProject,r.product,r.vulnerabilityName,r.shortDescription].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)));
  return filtered.sort((a,b) => sort === 'old' ? a.dateAdded.localeCompare(b.dateAdded) : sort === 'vendor' ? a.vendorProject.localeCompare(b.vendorProject) : b.dateAdded.localeCompare(a.dateAdded));
}
export function csv(rows) {
  const fields = ['cveID','vendorProject','product','dateAdded','knownRansomwareCampaignUse','shortDescription','requiredAction'];
  const quote = value => '"'+String(value ?? '').replace(/^(\s*[=+\-@]|[\t\r])/, "'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[fields,...rows.map(r=>fields.map(f=>r[f]))].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function prettyDate(value, lang='es') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang==='en'?'en-GB':'es-ES',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value.length===10?value+'T00:00:00Z':value));
}
