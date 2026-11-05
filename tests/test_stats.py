from growth.stats import call_out, wilson


def test_wilson_contains_point_estimate():
    low, high = wilson(40, 100)
    assert low < 0.40 < high


def test_wilson_bounds_and_empty_group():
    assert wilson(0, 0) == (0.0, 1.0)
    low, high = wilson(0, 20)
    assert low == 0.0 and 0 < high < 0.2


def test_call_out_needs_evidence():
    assert call_out(5, 10, 0.2) == "small"        # too few deals to call
    assert call_out(60, 100, 0.40) == "above"
    assert call_out(20, 100, 0.40) == "below"
    assert call_out(42, 100, 0.40) == "in line"
