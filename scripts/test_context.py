"""Regression checks for source context and country/industry attribution."""
import copy
import json
import unittest
import urllib.parse
from unittest.mock import patch
from context_fields import country,post_context,sector
from update_malware import normalize as malware


class ContextTests(unittest.TestCase):
    def test_explicit_country(self):
        self.assertEqual(country('Spain'),'ES');self.assertEqual(country('España'),'ES')
        self.assertEqual(country('Seminole,Florida,US'),'US');self.assertEqual(country('USA'),'US')
        self.assertIsNone(country('New York, NY 10016'))
        self.assertIsNone(country('company.es'));self.assertIsNone(country('Unknown'))

    def test_no_domain_or_name_inference(self):
        context=post_context({'post_title':'Spain Hospital','description':'Website: hospital.es'})
        self.assertIsNone(context['country']);self.assertIsNone(context['sector'])

    def test_labels_and_original_context(self):
        context=post_context({'description':'Country: ES |\nIndustry: Healthcare |\nWebsite: example.org'})
        self.assertEqual(context['country'],'ES');self.assertEqual(context['sector'],'health')
        self.assertEqual(context['countryRaw'],'ES');self.assertEqual(context['sectorRaw'],'Healthcare')
        self.assertEqual(context['contextSource'],'source_labels')
        self.assertEqual(sector('Agriculture and farming'),'agriculture')
        self.assertEqual(sector('Medical and Financial Services'),'other')

    def test_malware_upload_country_only(self):
        raw={'query_status':'ok','data':[{'sha256_hash':'a'*64,'first_seen':'2026-10-20 10:00:00','origin_country':'ES','signature':'Example','sector':'Healthcare','reporter':'private','vendor_intel':{'secret':'no'}}]}
        row=malware(raw)['samples'][0]
        self.assertEqual(row['uploadCountry'],'ES');self.assertNotIn('sector',row);self.assertNotIn('reporter',row);self.assertNotIn('vendor_intel',row)





if __name__=='__main__':unittest.main()
