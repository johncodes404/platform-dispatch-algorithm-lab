import unittest

from dispatch_simulator import (
    EFFICIENCY_POLICY,
    WORKER_FRIENDLY_POLICY,
    Point,
    Rider,
    demo_scenario,
    dispatch,
)


class DispatchSimulatorTests(unittest.TestCase):
    def test_distance(self):
        self.assertAlmostEqual(Point(0, 0).distance_to(Point(3, 4)), 5.0)

    def test_efficiency_policy_selects_fast_busy_rider(self):
        order, riders = demo_scenario()
        winner = dispatch(order, riders, EFFICIENCY_POLICY)
        self.assertEqual(winner.rider.rider_id, "骑手A")

    def test_worker_policy_enforces_fatigue_guardrail(self):
        order, riders = demo_scenario()
        winner = dispatch(order, riders, WORKER_FRIENDLY_POLICY)
        self.assertNotEqual(winner.rider.rider_id, "骑手A")

    def test_full_rider_is_ineligible(self):
        order, riders = demo_scenario()
        full_rider = Rider("满载骑手", Point(0, 0), 2, 2, 0.1, 10, 0.9)
        winner = dispatch(order, [full_rider, riders[1]], EFFICIENCY_POLICY)
        self.assertEqual(winner.rider.rider_id, "骑手B")


if __name__ == "__main__":
    unittest.main()
