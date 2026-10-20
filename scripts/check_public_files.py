"""Check public artifacts for credential exposure and unexpected content."""
import argparse
import base64
import getpass
import json
import os
import re
import sys
import urllib.parse
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOCKED = {'.env','.git','.npmrc','.pypirc','id_rsa','id_ed25519'}
ALLOWED_EXTENSIONS = {'.html','.css','.js','.mjs','.svg','.png','.jpg','.jpeg','.webp','.json','.txt','.xml','.ico'}

class HTMLCheck(HTMLParser):
    def __init__(self):
        super().__init__();self.policy=False;self.referrer=False
    def handle_starttag(self, tag, attrs):
        values=dict(attrs)
        if any(k.lower().startswith('on')for k,_ in attrs):
            raise ValueError('Inline event handler in public HTML')
        for k in ['href','src','action']:
            value=values.get(k,'').strip().lower()
            if value.startswith(('javascript:','vbscript:')):
                raise ValueError('Executable URL in public HTML')
        if tag=='script' and values.get('src','').startswith(('http:','https:','//')):
            raise ValueError('Remote script in public HTML')
        if tag=='meta' and values.get('http-equiv','').lower()=='content-security-policy':
            self.policy=True
        if tag=='meta' and values.get('name')=='referrer' and values.get('content')=='no-referrer':
            self.referrer=True

def scan_bytes(content, variants):
    if any(token and token in content for token in variants):
        raise ValueError('Credential exposure detected')
    if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',content):
        raise ValueError('Private key material detected')
    if re.search(rb'\bcf(?:at|ut)_[A-Za-z0-9_-]{24,}\b',content):
        raise ValueError('Cloudflare token material detected')

def scan_tree(secret=''):
    variants=[s.encode()for s in [secret,base64.b64encode(secret.encode()).decode() if secret else '',urllib.parse.quote(secret,safe='')]]
    # Source scan is useful before a commit; ignore local tooling and Git internals.
    for p in ROOT.rglob('*'):
        rel=p.relative_to(ROOT)
        if any(part in {'.git','__pycache__','node_modules'}for part in rel.parts):
            continue
        if p.is_symlink():
            raise ValueError('Symbolic link refused')
        if not p.is_file() or any(part in {'.git','__pycache__','node_modules'}for part in rel.parts):
            continue
        if p.stat().st_size>12*1024*1024:
            raise ValueError('Unexpected large project file')
        scan_bytes(p.read_bytes(),variants)
    public=ROOT/'dist'
    for p in public.rglob('*'):
        if not p.is_file():continue
        rel=p.relative_to(public)
        if any(part in BLOCKED or part.startswith('.env')for part in rel.parts) or p.suffix.lower()not in ALLOWED_EXTENSIONS:
            raise ValueError('Unexpected public artifact')
        if p.suffix=='.html':
            check=HTMLCheck();check.feed(p.read_text());
            if not check.policy or not check.referrer:
                raise ValueError('Missing browser policy')
    d=json.loads((public/'data/malware.json').read_text())
    if set(d)-{'source','sourceUrl','query','fetchedAt','count','samples'}:
        raise ValueError('Unexpected malware metadata envelope')
    allowed={'sha256','family','fileType','firstSeen','lastSeen','tags','uploadCountry'}
    if any(set(r)!=allowed for r in d['samples']):
        raise ValueError('Unexpected malware metadata fields')
    signals=json.loads((public/'data/radar-signals.json').read_text())
    if set(signals)!={'source','datasets'} or not isinstance(signals['datasets'],list):
        raise ValueError('Unexpected Radar signals envelope')
    event_keys={'kind','window','fetchedAt','limit','rows'}
    outage_keys={'id','start','end','countries','asnCountries','asns','cause','type','scope','description'}
    bgp_keys={'id','kind','start','lastSeen','countries','actorAsn','otherAsns','organizations','confidence','prefixes','finished','tags'}
    for dataset in signals['datasets']:
        if dataset.get('kind') in {'outages','hijacks','leaks'}:
            allowed_rows=outage_keys if dataset['kind']=='outages' else bgp_keys
            if set(dataset)!=event_keys or any(set(row)!=allowed_rows for row in dataset['rows']):raise ValueError('Unexpected event fields')
        else:raise ValueError('Unexpected signal dataset')
    incident_feed=json.loads((public/'data/ddos-incidents.json').read_text())
    if set(incident_feed)!={'source','windowDays','builtAt','sources','incidents'}:
        raise ValueError('Unexpected DDoS incident envelope')
    incident_keys={'id','entity','referenceDomain','sourceId','sourceUrl','evidence','startedAt','reportedAt','updatedAt','resolvedAt','status','components','fetchedAt'}
    source_keys={'id','entity','url','fetchedAt','state','matches'}
    if any(set(row)!=incident_keys for row in incident_feed['incidents']) or any(set(source)!=source_keys for source in incident_feed['sources']):
        raise ValueError('Unexpected DDoS public fields')
    return variants

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--stdin-secret',action='store_true');parser.add_argument('--zip',dest='archive');args=parser.parse_args()
    secret=getpass.getpass('Secret to check (hidden): ')if args.stdin_secret else os.environ.get('ABUSECH_AUTH_KEY','')
    try:
        variants=scan_tree(secret)
        radar_secret=os.environ.get('CLOUDFLARE_RADAR_TOKEN','')
        if radar_secret:
            variants+=scan_tree(radar_secret)
        if args.archive:
            with zipfile.ZipFile(args.archive)as archive:
                for item in archive.infolist():
                    name=Path(item.filename)
                    if name.is_absolute()or '..'in name.parts or any(p in BLOCKED or p.startswith('.env')for p in name.parts):
                        raise ValueError('Unexpected archive entry')
                    scan_bytes(archive.read(item),variants)
    except Exception:
        # Do not expose matched values, response bodies or filenames in logs.
        print('Public artifact validation FAILED. Nothing should be deployed.',file=sys.stderr);return 1
    print('PASS: public/source credential checks, public file allowlist, HTML policies and metadata allowlist.');return 0

if __name__=='__main__':sys.exit(main())
