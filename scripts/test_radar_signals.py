import json
import unittest
from pathlib import Path
from update_cloudflare import normalize,date
from update_cloudflare import FeedError

class SignalTests(unittest.TestCase):
    def test_outage_country_does_not_use_asn_country(self):
        raw={'success':True,'result':{'annotations':[{'id':'1','eventType':'OUTAGE','startDate':'2026-10-20T10:00:00Z','locations':[], 'asns':[123], 'asnsDetails':[{'location':{'code':'ES'}}],'outage':{'outageCause':'MAINTENANCE'},'private':'omitted'}]}}
        row=normalize(raw,'outages')['rows'][0]
        self.assertEqual(row['countries'],[]);self.assertEqual(row['asnCountries'],['ES']);self.assertIsNone(row['end']);self.assertNotIn('private',row)

    def test_bgp_roles_and_country_context(self):
        raw={'success':True,'result':{'asn_info':[{'asn':123,'org_name':'Example','country_code':'ES'},{'asn':456,'org_name':'Example 2','country_code':'FR'}],'events':[{'id':42,'hijacker_asn':123,'victim_asns':[456],'min_hijack_ts':'2026-10-20T10:00:00','max_msg_ts':'2026-10-20T10:03:00','confidence_score':8,'prefixes':['192.0.2.0/24','invalid'],'tags':[{'name':'rpki_new_origin_invalid'}],'private':'omitted'}]}}
        row=normalize(raw,'hijacks')['rows'][0]
        self.assertEqual(row['countries'],['ES','FR']);self.assertEqual(row['actorAsn'],123);self.assertEqual(row['otherAsns'],[456]);self.assertEqual(row['confidence'],8)
        self.assertEqual(row['prefixes'],['192.0.2.0/24']);self.assertTrue(row['start'].endswith('+00:00'));self.assertNotIn('private',row)

    def test_missing_timezone_only_accepted_for_documented_bgp_timestamps(self):
        with self.assertRaises(FeedError):date('2026-10-20T10:00:00')
        self.assertTrue(date('2026-10-20T10:00:00',bgp=True).endswith('+00:00'))

if __name__=='__main__':unittest.main()
