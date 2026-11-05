"""Driver tree: 90-day GMV from new sellers = leads x win rate x activation rate x GMV per activated seller."""
from dataclasses import asdict, dataclass

import pandas as pd

LEVERS = ("leads", "win_rate", "activation_rate", "gmv_per_active")


@dataclass
class DriverTree:
    leads: float
    win_rate: float
    activation_rate: float
    gmv_per_active: float

    @property
    def won(self) -> float:
        return self.leads * self.win_rate

    @property
    def activated(self) -> float:
        return self.won * self.activation_rate

    @property
    def gmv(self) -> float:
        return self.activated * self.gmv_per_active

    def with_changes(self, **changes) -> "DriverTree":
        values = asdict(self)
        values.update(changes)
        return DriverTree(**values)

    def lever_needed(self, target_gmv: float) -> dict:
        """Value each lever would need, on its own, to reach the target. Because the tree multiplies,
        every lever needs the same relative change; what differs is how realistic that change is."""
        factor = target_gmv / self.gmv
        return {lever: getattr(self, lever) * factor for lever in LEVERS}

    def to_dict(self) -> dict:
        d = asdict(self)
        d.update(won=self.won, activated=self.activated, gmv=self.gmv)
        return d


def from_summary(s: dict) -> DriverTree:
    return DriverTree(s["leads"], s["win_rate"], s["activation_rate"], s["gmv_per_active"])


def scenarios(tree: DriverTree, channels: list, reps: list, deals: pd.DataFrame) -> list:
    """Guided scenarios. Every number comes from the data: no invented targets."""
    paid = next(c for c in channels if c["key"] == "paid_search")
    team = tree.activation_rate
    # Coach every rep below the team rate up to the team rate (same deal counts).
    coached = sum(max(r["activated"], r["deals"] * team) for r in reps) / sum(r["deals"] for r in reps)
    coached_lift = coached / deals.activated.mean()
    out = [
        {"id": "more_leads", "title": "Buy 20% more leads",
         "what": "Same win and activation rates, 20% more leads from the current mix.",
         "changes": {"leads": tree.leads * 1.2}},
        {"id": "paid_level", "title": "Raise activation to the paid-search rate",
         "what": f"Paid-search sellers already make a first sale {paid['activation_rate']:.0%} of the time. "
                 "This sets activation for every signed seller to that rate.",
         "changes": {"activation_rate": paid["activation_rate"]}},
        {"id": "coach_reps", "title": "Coach reps below the team rate up to it",
         "what": "Reps whose sellers activate below the team rate reach the team rate; everyone else stays the same.",
         "changes": {"activation_rate": tree.activation_rate * coached_lift}},
    ]
    for s in out:
        new = tree.with_changes(**s["changes"])
        s["gmv"] = new.gmv
        s["gmv_change"] = new.gmv - tree.gmv
        s["pct_change"] = new.gmv / tree.gmv - 1
    return out
