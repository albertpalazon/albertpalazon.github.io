import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeIncidents,selectIncidents,incidentsCSV} from '../dist/ddos-core.mjs';
import {normalizePosts,filterPosts,postsCSV} from '../dist/ransom-core.mjs';
import {normalizeMalware,selectMalware,malwareCSV} from '../dist/malware-core.mjs';
import {normalizeSignals,signalRows,signalsCSV} from '../dist/radar-signals-core.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/data/'+name+'.json',import.meta.url)));
const posts=normalizePosts(read('ransomware')).posts,malware=normalizeMalware(read('malware')).samples;
for(const country of new Set(posts.map(r=>r.country).filter(Boolean)))assert(filterPosts(posts,{country}).every(r=>r.country===country));
for(const sector of new Set(posts.map(r=>r.sector).filter(Boolean)))assert(filterPosts(posts,{sector}).every(r=>r.sector===sector));
assert.equal(filterPosts(posts,{country:'__unknown__'}).length,posts.filter(r=>!r.country).length);
const fixture=[{...posts[0],country:'ES',sector:'health',group:'Example'}, {...posts[0],country:'ES',sector:'energy'}, {...posts[0],country:'US',sector:'health'}];
assert.equal(filterPosts(fixture,{country:'ES',sector:'health',group:'Example'}).length,1);
assert(postsCSV([{...posts[0],entity:'=HYPERLINK("bad")'}]).includes('"\'=HYPERLINK'));
assert.equal(selectMalware([{...malware[0],uploadCountry:'ES'},{...malware[0],uploadCountry:'US'}],{country:'ES'}).length,1);
assert(malwareCSV(malware).includes('uploadCountry'));
assert.throws(()=>normalizeMalware({...read('malware'),samples:[{...malware[0],uploadCountry:'Spain'}]}));
const signals=normalizeSignals(read('radar-signals'));
const hijacks=signalRows(signals,'bgp',{kind:'hijacks',score:8});
assert(hijacks.every(r=>r.kind==='hijacks'&&r.confidence>=8));
for(const mode of ['bgp','outages']){
 const rows=signalRows(signals,mode);
 for(const country of new Set(rows.flatMap(r=>r.countries)))assert(signalRows(signals,mode,{country}).every(r=>r.countries.includes(country)));
}
assert(signalsCSV([{id:'=bad',countries:[],start:'now'}],'outages').includes('"\'=bad"'));
console.log('PASS: real Radar snapshots, BGP country/type/confidence filters and CSV escaping.');

const notices=normalizeIncidents(read('ddos-incidents'));
for(const entity of new Set(notices.incidents.map(r=>r.entity)))assert(selectIncidents(notices.incidents,{entity}).every(r=>r.entity===entity));
assert(selectIncidents(notices.incidents,{query:'jottacloud'}).every(r=>r.entity==='Jottacloud'));
assert.equal(selectIncidents(notices.incidents,{query:'a-domain-that-does-not-exist.example'}).length,0);
assert(incidentsCSV([{...notices.incidents[0],entity:'=bad'}]).includes('"\'=bad"'));
assert.throws(()=>normalizeIncidents({...notices,incidents:[{...notices.incidents[0],sourceUrl:'https://untrusted.example/incidents/abc123def456'}]}));
console.log('PASS: entity/service searches, provider source URL allowlist and DDoS CSV escaping.');
