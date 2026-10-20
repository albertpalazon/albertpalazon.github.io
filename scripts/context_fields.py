"""Conservative extraction of explicit source labels, never inferred from domains."""
import json
import re
import unicodedata
from pathlib import Path

def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value)) if not unicodedata.combining(c)).casefold().strip()

ALIASES = json.loads((Path(__file__).parent/'country_aliases.json').read_text())
COUNTRIES = set(ALIASES.values())

def country(value):
    if not isinstance(value, str):
        return None
    # Whole name/code, or final comma-separated component of an explicit Country label.
    return ALIASES.get(fold(value)) or ALIASES.get(fold(value.rsplit(',', 1)[-1]))

SECTORS = [
    ('health', r'health|hospital|medical|pharma|salud|sanidad'),
    ('education', r'education|school|university|college|educacion'),
    ('energy', r'energy|electric|utilities|oil|gas|energia'),
    ('agriculture', r'agricultur|farming|forestry|fishing|ganader'),
    ('government', r'government|public administration|municipal|gobierno'),
    ('finance', r'financial|banking|insurance|finanzas|banca'),
    ('manufacturing', r'manufactur|industrial|fabricacion'),
    ('technology', r'technology|software|information technology|telecom|tecnologia'),
    ('transport', r'transport|logistic|airline|shipping'),
    ('retail', r'retail|wholesale|commerce|comercio'),
    ('construction', r'construction|real estate|construccion'),
    ('services', r'legal services|law firm|professional services|consulting'),
    ('hospitality', r'hospitality|hotel|restaurant|tourism|turismo'),
]

def sector(value):
    if not isinstance(value, str) or not value.strip():
        return None
    matches = {key for key, pattern in SECTORS if re.search(pattern, fold(value))}
    return next(iter(matches)) if len(matches)==1 else 'other'

def explicit_label(description, names):
    match = re.search(r'(?:^|[\n|;])\s*(?:'+names+r')\s*:\s*([^\n|;]+)', description, re.I)
    return match.group(1).strip()[:240] if match else None

def post_context(record):
    description = str(record.get('description') or '')
    raw_country = record.get('country') or explicit_label(description, r'country|pais|país')
    raw_sector = record.get('sector') or record.get('industry') or explicit_label(description, r'industry|sector')
    return {'country':country(raw_country), 'sector':sector(raw_sector),
            'countryRaw':raw_country if isinstance(raw_country,str) else None,
            'sectorRaw':raw_sector if isinstance(raw_sector,str) else None,
            'contextSource':'source_labels' if raw_country or raw_sector else None}
