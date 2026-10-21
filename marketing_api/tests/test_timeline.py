import unittest

from core.timeline import (
    CHANNEL_LANE,
    _campaign_lanes,
    _merge_contributors,
    dates_overlap,
    logged_hours,
    stack_rows,
)


class HoursTests(unittest.TestCase):
    def test_hours_come_from_logs_not_calendar_span(self):
        logs = [
            {"minutes": 90, "running": False},
            {"minutes": 30, "running": False},
            {"minutes": 400, "running": True},
        ]
        self.assertEqual(logged_hours(logs), 2.0)

    def test_no_logs_stay_unknown(self):
        self.assertIsNone(logged_hours([]))
        self.assertIsNone(logged_hours([{"minutes": 15, "running": True}]))


class StackTests(unittest.TestCase):
    def test_overlapping_bars_stack_inside_the_lane(self):
        rows = stack_rows(
            [
                {"id": "a", "start": "2026-10-01", "end": "2026-10-20"},
                {"id": "b", "start": "2026-10-10", "end": "2026-10-25"},
                {"id": "c", "start": "2026-10-21", "end": "2026-10-30"},
            ]
        )
        self.assertEqual(rows["a"], 0)
        self.assertEqual(rows["b"], 1)
        self.assertEqual(rows["c"], 0)

    def test_same_day_touching_counts_as_overlap(self):
        self.assertTrue(dates_overlap("2026-10-01", "2026-10-10", "2026-10-10", "2026-10-20"))
        self.assertFalse(dates_overlap("2026-10-01", "2026-10-09", "2026-10-10", "2026-10-20"))


class LaneMappingTests(unittest.TestCase):
    def test_each_ad_platform_is_its_own_lane(self):
        self.assertEqual(CHANNEL_LANE["meta"], "paid-meta")
        self.assertEqual(_campaign_lanes(["Google Ads", "TikTok"], "Paid"), ["paid-google", "paid-tiktok"])

    def test_organic_instagram_stays_on_content_not_meta(self):
        self.assertEqual(_campaign_lanes(["Instagram", "Facebook"], "Organic"), ["social"])

    def test_paid_meta_mode_uses_the_meta_lane(self):
        self.assertEqual(_campaign_lanes(["Instagram"], "Paid"), ["paid-meta"])


class AssignmentHistoryTests(unittest.TestCase):
    def test_removing_a_person_keeps_their_participation(self):
        previous = [
            {"person": "Soheil", "start": "2026-09-01", "end": None, "active": True},
            {"person": "Sara", "start": "2026-09-10", "end": None, "active": True},
        ]
        merged = _merge_contributors(previous, [{"person": "Sara", "start": "2026-09-10", "end": None, "active": True}])
        soheil = next(item for item in merged if item["person"] == "Soheil")
        self.assertFalse(soheil["active"])
        self.assertEqual(soheil["start"], "2026-09-01")
        self.assertTrue(soheil["end"])
        sara = next(item for item in merged if item["person"] == "Sara")
        self.assertTrue(sara["active"])
