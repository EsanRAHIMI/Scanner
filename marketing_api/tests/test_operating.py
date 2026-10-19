import unittest
from datetime import date

from fastapi import HTTPException

from core.insight import paid_range, snapshot_index
from core.operating import (
    _HAS_IMAGE,
    _content_patch,
    _product_key,
    campaign_status,
    content_public,
    content_stage,
    is_planning_placeholder,
)


def mtd(channel, day, spend, clicks=None):
    return {
        'channel': channel,
        'record_type': 'Monthly MTD',
        'period_start': f'{day[:7]}-01',
        'snapshot_date': day,
        'spend': spend,
        'impressions': None,
        'clicks': clicks,
        'raw_results': None,
    }


class PaidRangeTests(unittest.TestCase):
    def test_range_is_end_minus_day_before_start(self):
        rows = [mtd('Meta', '2026-10-12', 100, 10), mtd('Meta', '2026-10-19', 160, 25)]
        result = paid_range(snapshot_index(rows), date(2026, 10, 13), date(2026, 10, 19))
        self.assertEqual(result['spend'], 60)
        self.assertEqual(result['clicks'], 15)
        self.assertEqual(result['missing'], [])

    def test_missing_base_snapshot_is_unknown_not_zero(self):
        rows = [mtd('Meta', '2026-10-16', 100), mtd('Meta', '2026-10-19', 160)]
        result = paid_range(snapshot_index(rows), date(2026, 10, 13), date(2026, 10, 19))
        self.assertIsNone(result['spend'])
        self.assertEqual(result['missing'], ['Meta'])

    def test_range_starting_on_the_first_needs_no_base(self):
        rows = [mtd('Meta', '2026-10-07', 70)]
        result = paid_range(snapshot_index(rows), date(2026, 10, 1), date(2026, 10, 7))
        self.assertEqual(result['spend'], 70)

    def test_range_across_months_adds_both_parts(self):
        rows = [
            mtd('Meta', '2026-09-27', 500),
            mtd('Meta', '2026-09-30', 560),
            mtd('Meta', '2026-10-03', 30),
        ]
        result = paid_range(snapshot_index(rows), date(2026, 9, 28), date(2026, 10, 3))
        self.assertEqual(result['spend'], 90)

    def test_channels_that_never_spent_are_left_out(self):
        rows = [mtd('Snapchat', '2026-10-19', None), mtd('Meta', '2026-10-07', 70)]
        result = paid_range(snapshot_index(rows), date(2026, 10, 1), date(2026, 10, 7))
        self.assertEqual([row['channel'] for row in result['channels']], ['Meta'])


class ContentModelTests(unittest.TestCase):
    def test_legacy_status_maps_onto_the_pipeline(self):
        self.assertEqual(content_stage('Needs plan'), 'Idea')
        self.assertEqual(content_stage('Drafts'), 'Brief')
        self.assertEqual(content_stage('In Progress'), 'Production')
        self.assertEqual(content_stage('Published'), 'Published')

    def test_channel_comes_from_the_post_link_when_unset(self):
        item = content_public({'_id': 'a', 'fields': {'Title': 'x', 'Content Link': 'https://www.instagram.com/reel/abc/'}})
        self.assertEqual(item['channels'], ['Instagram'])

    def test_views_stay_unknown_when_blank(self):
        item = content_public({'_id': 'a', 'fields': {'Title': 'x', 'Social Views': ''}})
        self.assertIsNone(item['kpi']['views'])

    def test_one_item_carries_many_channels_in_a_fixed_order(self):
        patch = _content_patch({'channels': ['Website', 'Instagram', 'LinkedIn']})
        self.assertEqual(patch['fields.Channels'], 'Instagram, LinkedIn, Website')

    def test_unknown_channel_is_rejected(self):
        with self.assertRaises(HTTPException):
            _content_patch({'channels': ['MySpace']})

    def test_publish_date_keeps_the_classic_columns_in_step(self):
        patch = _content_patch({'publish_date': '2026-10-19'})
        self.assertEqual(patch['publish_date'], '2026-10-19')
        self.assertEqual(patch['fields.Day of Week'], 'Monday')

    def test_planning_rows_from_the_classic_calendar_are_hidden(self):
        self.assertTrue(is_planning_placeholder({'fields': {'Title': '', 'Status': 'Needs plan'}}))
        self.assertFalse(is_planning_placeholder({'fields': {'Title': 'Teaser', 'Status': 'Needs plan'}}))

    def test_campaign_status_follows_dates_unless_paused(self):
        doc = {'start_date': '2026-10-16', 'end_date': '2026-11-01'}
        self.assertEqual(campaign_status(doc, date(2026, 10, 19)), 'Live')
        self.assertEqual(campaign_status(doc, date(2026, 10, 1)), 'Planned')
        self.assertEqual(campaign_status(doc, date(2026, 11, 2)), 'Done')
        self.assertEqual(campaign_status({**doc, 'state': 'Paused'}, date(2026, 10, 19)), 'Paused')


class AssetLookupTests(unittest.TestCase):
    def test_list_only_asks_for_products_with_an_image(self):
        self.assertEqual(_HAS_IMAGE, {'fields.Image.0.url': {'$exists': True}})

    def test_short_ids_stay_strings(self):
        self.assertEqual(_product_key('abc'), 'abc')


if __name__ == '__main__':
    unittest.main()
