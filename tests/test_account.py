import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from account import Account


def make_account(balance=1000.0):
    return Account(account_id="001", pin="1234", owner="Test", balance=balance)


def test_verify_pin_correct():
    acc = make_account()
    assert acc.verify_pin("1234") is True


def test_verify_pin_wrong():
    acc = make_account()
    assert acc.verify_pin("0000") is False


def test_get_balance():
    acc = make_account(500.0)
    assert acc.get_balance() == 500.0


def test_deposit():
    acc = make_account(100.0)
    new_balance = acc.deposit(50.0)
    assert new_balance == 150.0
    assert acc.get_balance() == 150.0


def test_deposit_invalid():
    acc = make_account()
    with pytest.raises(ValueError):
        acc.deposit(0)
    with pytest.raises(ValueError):
        acc.deposit(-10)


def test_withdraw():
    acc = make_account(200.0)
    new_balance = acc.withdraw(80.0)
    assert new_balance == 120.0
    assert acc.get_balance() == 120.0


def test_withdraw_insufficient_funds():
    acc = make_account(50.0)
    with pytest.raises(ValueError):
        acc.withdraw(100.0)


def test_withdraw_invalid_amount():
    acc = make_account()
    with pytest.raises(ValueError):
        acc.withdraw(0)
    with pytest.raises(ValueError):
        acc.withdraw(-5)


def test_statement():
    acc = make_account(500.0)
    acc.deposit(100.0)
    acc.withdraw(50.0)
    stmt = acc.get_statement()
    assert len(stmt) == 2
    assert stmt[0]["type"] == "deposit"
    assert stmt[1]["type"] == "withdrawal"
