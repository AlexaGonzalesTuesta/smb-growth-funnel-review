import pytest

from growth import db


@pytest.fixture(scope="session")
def con():
    return db.connect()
