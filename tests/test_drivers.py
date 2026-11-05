import pytest

from growth.drivers import LEVERS, DriverTree


def tree():
    return DriverTree(leads=1000, win_rate=0.10, activation_rate=0.40, gmv_per_active=1000)


def test_tree_multiplies():
    t = tree()
    assert t.won == 100 and t.activated == 40 and t.gmv == 40_000


def test_with_changes_does_not_mutate():
    t = tree()
    t2 = t.with_changes(activation_rate=0.5)
    assert t.activation_rate == 0.40 and t2.gmv == 50_000


def test_lever_needed_hits_target_for_every_lever():
    t = tree()
    needed = t.lever_needed(60_000)
    for lever in LEVERS:
        assert t.with_changes(**{lever: needed[lever]}).gmv == pytest.approx(60_000)
