"""A small, dependency-free food-delivery dispatch algorithm simulator.

The project intentionally separates:
1. facts/predictions about the world (distance, ETA, lateness risk), and
2. value choices (the weights in a dispatch policy).

Run:
    python dispatch_simulator.py
    python dispatch_simulator.py --policy efficiency
    python dispatch_simulator.py --policy worker_friendly
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Sequence


@dataclass(frozen=True)
class Point:
    """A point on a simplified city map, measured in kilometres."""

    x: float
    y: float

    def distance_to(self, other: "Point") -> float:
        return math.hypot(self.x - other.x, self.y - other.y)


@dataclass(frozen=True)
class Order:
    """A delivery request and the time promises used by the teaching model."""

    order_id: str
    restaurant: Point
    customer: Point
    promised_minutes: float
    prep_minutes_remaining: float
    building_minutes: float = 4.0


@dataclass(frozen=True)
class Rider:
    """A candidate courier snapshot captured at one dispatch decision."""

    rider_id: str
    position: Point
    active_orders: int
    capacity: int
    fatigue: float  # 0.0 = rested, 1.0 = exhausted
    earnings_last_2h: float
    acceptance_rate: float
    route_overlap: float = 0.0  # 0 = not on the way, 1 = perfectly on the way
    online: bool = True


@dataclass(frozen=True)
class Policy:
    """Value choices: soft-objective weights plus a non-tradeable safety line."""

    name: str
    description: str
    weights: Mapping[str, float]
    maximum_fatigue: float = 1.0


@dataclass
class Evaluation:
    """Traceable intermediate and final values for one candidate rider."""

    rider: Rider
    raw: Dict[str, float]
    normalized: Dict[str, float]
    score: float = 0.0
    eligible: bool = True
    reason: str = ""


EFFICIENCY_POLICY = Policy(
    name="efficiency",
    description="平台效率优先：更看重送达速度、超时风险和履约成本。",
    weights={
        "delivery_eta": 0.50,
        "late_risk": 0.25,
        "platform_cost": 0.20,
        "workload": 0.02,
        "fatigue": 0.01,
        "recent_earnings": 0.01,
        "uncertainty": 0.01,
    },
    maximum_fatigue=1.0,
)


WORKER_FRIENDLY_POLICY = Policy(
    name="worker_friendly",
    description="劳动者友好：保留履约要求，同时提高疲劳、负荷和收入均衡的权重。",
    weights={
        "delivery_eta": 0.25,
        "late_risk": 0.25,
        "platform_cost": 0.08,
        "workload": 0.15,
        "fatigue": 0.17,
        "recent_earnings": 0.06,
        "uncertainty": 0.04,
    },
    maximum_fatigue=0.85,
)


POLICIES = {
    EFFICIENCY_POLICY.name: EFFICIENCY_POLICY,
    WORKER_FRIENDLY_POLICY.name: WORKER_FRIENDLY_POLICY,
}


def predict_features(order: Order, rider: Rider) -> Dict[str, float]:
    """Predict measurable consequences if ``rider`` receives ``order``.

    This is a deliberately transparent stand-in for production ML models.
    Lower is better for every returned feature, which keeps scoring readable.
    """

    speed_km_per_minute = 0.30  # about 18 km/h in an urban delivery setting
    pickup_distance = rider.position.distance_to(order.restaurant)
    delivery_distance = order.restaurant.distance_to(order.customer)

    # Existing orders cause detours. Fatigue modestly slows travel.
    # Stacking orders is efficient only when their routes overlap.
    detour_minutes = 3.5 * rider.active_orders * (1.0 - rider.route_overlap)
    fatigue_slowdown = 1.0 + 0.18 * rider.fatigue
    to_pickup = pickup_distance / speed_km_per_minute * fatigue_slowdown
    travel_after_pickup = delivery_distance / speed_km_per_minute * fatigue_slowdown
    wait_for_food = max(0.0, order.prep_minutes_remaining - to_pickup)
    eta = (
        to_pickup
        + wait_for_food
        + travel_after_pickup
        + order.building_minutes
        + detour_minutes
    )

    late_minutes = max(0.0, eta - order.promised_minutes)
    late_risk = late_minutes / max(order.promised_minutes, 1.0)

    # A toy payout/cost curve: base fee + distance and difficult-order subsidy.
    platform_cost = 4.0 + 0.65 * (pickup_distance + delivery_distance)
    platform_cost += 1.5 if order.building_minutes >= 8 else 0.0

    workload = rider.active_orders / max(rider.capacity, 1)

    # Uncertainty rises with workload and fatigue. Production systems would
    # estimate this from historical prediction errors and real-time context.
    uncertainty = min(1.0, 0.12 + 0.10 * rider.active_orders + 0.28 * rider.fatigue)

    return {
        "delivery_eta": eta,
        "late_risk": late_risk,
        "platform_cost": platform_cost,
        "workload": workload,
        "fatigue": rider.fatigue,
        # Penalising high recent earnings gives lower earners some priority.
        "recent_earnings": rider.earnings_last_2h,
        "uncertainty": uncertainty,
    }


def _normalise(values: Sequence[float]) -> List[float]:
    """Min-max normalisation; identical values become neutral zeros."""

    low, high = min(values), max(values)
    if math.isclose(low, high):
        return [0.0 for _ in values]
    return [(value - low) / (high - low) for value in values]


def evaluate_candidates(order: Order, riders: Iterable[Rider], policy: Policy) -> List[Evaluation]:
    """Evaluate every rider while retaining reasons for ineligible candidates.

    Hard constraints run first because an unacceptable safety condition should
    not become exchangeable for a better ETA or lower platform cost. Eligible
    candidates are then normalised within this decision set and scored using
    the selected policy. Lower scores are better.
    """

    evaluations: List[Evaluation] = []

    for rider in riders:
        if not rider.online:
            evaluations.append(Evaluation(rider, {}, {}, eligible=False, reason="未上线"))
        elif rider.active_orders >= rider.capacity:
            evaluations.append(Evaluation(rider, {}, {}, eligible=False, reason="已满载"))
        elif rider.fatigue > policy.maximum_fatigue:
            evaluations.append(Evaluation(rider, {}, {}, eligible=False, reason="超过疲劳保护线"))
        else:
            evaluations.append(Evaluation(rider, predict_features(order, rider), {}))

    eligible = [evaluation for evaluation in evaluations if evaluation.eligible]
    if not eligible:
        return evaluations

    for feature in policy.weights:
        normalised_values = _normalise([item.raw[feature] for item in eligible])
        for item, value in zip(eligible, normalised_values):
            item.normalized[feature] = value

    for item in eligible:
        item.score = sum(
            policy.weights[feature] * item.normalized[feature]
            for feature in policy.weights
        )

    return evaluations


def dispatch(order: Order, riders: Iterable[Rider], policy: Policy) -> Evaluation:
    """Return the lowest-cost eligible candidate, using ETA to break ties."""

    eligible = [item for item in evaluate_candidates(order, riders, policy) if item.eligible]
    if not eligible:
        raise RuntimeError("没有符合硬约束的可派单骑手")
    return min(eligible, key=lambda item: (item.score, item.raw["delivery_eta"]))


def demo_scenario() -> tuple[Order, List[Rider]]:
    """Build a small scenario whose candidates expose meaningful trade-offs."""

    order = Order(
        order_id="ORDER-2026-001",
        restaurant=Point(0.0, 0.0),
        customer=Point(2.4, 0.6),
        promised_minutes=25,
        prep_minutes_remaining=6,
        building_minutes=7,
    )
    riders = [
        # A很近，且手头订单与新订单高度顺路，但已经十分疲劳。
        Rider("骑手A", Point(0.25, 0.15), 3, 5, 0.92, 82, 0.98, route_overlap=0.90),
        # B距离适中、负荷较低。
        Rider("骑手B", Point(1.40, 0.80), 1, 4, 0.32, 38, 0.93, route_overlap=0.35),
        # C最空闲、收入最低，但距离商家较远。
        Rider("骑手C", Point(3.80, 2.80), 0, 4, 0.12, 18, 0.88),
    ]
    return order, riders


FEATURE_LABELS = {
    "delivery_eta": "预计送达/分",
    "late_risk": "超时风险",
    "platform_cost": "平台成本/元",
    "workload": "当前负荷",
    "fatigue": "疲劳度",
    "recent_earnings": "近2小时收入",
    "uncertainty": "预测不确定性",
}


def _format_table(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> str:
    widths = [len(header) for header in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(cell))

    def line(parts: Sequence[str]) -> str:
        return " | ".join(part.ljust(widths[index]) for index, part in enumerate(parts))

    separator = "-+-".join("-" * width for width in widths)
    return "\n".join([line(headers), separator, *(line(row) for row in rows)])


def print_policy_result(order: Order, riders: Sequence[Rider], policy: Policy) -> None:
    evaluations = evaluate_candidates(order, riders, policy)
    eligible = [item for item in evaluations if item.eligible]
    winner = min(eligible, key=lambda item: (item.score, item.raw["delivery_eta"]))

    print(f"\n【{policy.description}】")
    rows: List[List[str]] = []
    for item in evaluations:
        if not item.eligible:
            rows.append([item.rider.rider_id, "—", "—", "—", "—", item.reason])
            continue
        rows.append(
            [
                item.rider.rider_id,
                f'{item.raw["delivery_eta"]:.1f}',
                f'{item.raw["late_risk"]:.1%}',
                f'{item.raw["workload"]:.0%}',
                f'{item.rider.fatigue:.0%}',
                f"{item.score:.3f}" + ("  ← 获得订单" if item is winner else ""),
            ]
        )
    print(_format_table(["候选人", "ETA/分", "超时风险", "负荷", "疲劳", "综合分(越低越好)"], rows))

    print("权重：" + "，".join(f"{FEATURE_LABELS[key]}={value:.0%}" for key, value in policy.weights.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description="比较不同价值目标下的外卖派单结果")
    parser.add_argument(
        "--policy",
        choices=["compare", *POLICIES.keys()],
        default="compare",
        help="选择一套目标函数；默认同时比较两套政策",
    )
    args = parser.parse_args()

    order, riders = demo_scenario()
    print(f"订单 {order.order_id}：承诺 {order.promised_minutes:.0f} 分钟送达")
    selected = POLICIES.values() if args.policy == "compare" else [POLICIES[args.policy]]
    for policy in selected:
        print_policy_result(order, riders, policy)

    print("\n观察：数据没有变，改变的只是目标权重和疲劳保护线；派单结果却可能改变。")
    print("这就是算法治理的核心：不仅审查代码，还要追问谁定义目标、谁承担误差。")


if __name__ == "__main__":
    main()
