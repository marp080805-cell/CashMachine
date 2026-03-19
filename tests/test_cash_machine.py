import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from account import Account
from cash_machine import CashMachine, MAX_WITHDRAWAL


def setup_atm():
    atm = CashMachine(cash_reserve=5000.0)
    acc = Account(account_id="001", pin="1234", owner="Alice", balance=1000.0)
    atm.register_account(acc)
    return atm, acc


def authenticated_atm():
    atm, acc = setup_atm()
    atm.insert_card("001")
    atm.enter_pin("1234")
    return atm


def test_insert_card_valid():
    atm, _ = setup_atm()
    assert atm.insert_card("001") is True


def test_insert_card_invalid():
    atm, _ = setup_atm()
    assert atm.insert_card("999") is False


def test_enter_pin_correct():
    atm, _ = setup_atm()
    atm.insert_card("001")
    assert atm.enter_pin("1234") is True


def test_enter_pin_wrong():
    atm, _ = setup_atm()
    atm.insert_card("001")
    assert atm.enter_pin("0000") is False


def test_pin_blocks_after_max_attempts():
    atm, _ = setup_atm()
    atm.insert_card("001")
    atm.enter_pin("0000")
    atm.enter_pin("0000")
    with pytest.raises(RuntimeError, match="blocked"):
        atm.enter_pin("0000")


def test_check_balance():
    atm = authenticated_atm()
    assert atm.check_balance() == 1000.0


def test_deposit():
    atm = authenticated_atm()
    atm.deposit(200.0)
    assert atm.check_balance() == 1200.0


def test_withdraw():
    atm = authenticated_atm()
    atm.withdraw(300.0)
    assert atm.check_balance() == 700.0


def test_withdraw_exceeds_limit():
    atm = authenticated_atm()
    with pytest.raises(ValueError, match=str(int(MAX_WITHDRAWAL))):
        atm.withdraw(MAX_WITHDRAWAL + 1)


def test_withdraw_exceeds_atm_cash():
    atm = CashMachine(cash_reserve=100.0)
    acc = Account("001", "1234", "Bob", balance=5000.0)
    atm.register_account(acc)
    atm.insert_card("001")
    atm.enter_pin("1234")
    with pytest.raises(ValueError, match="sufficient cash"):
        atm.withdraw(500.0)


def test_eject_card_ends_session():
    atm = authenticated_atm()
    atm.eject_card()
    with pytest.raises(RuntimeError):
        atm.check_balance()


def test_no_card_raises():
    atm, _ = setup_atm()
    with pytest.raises(RuntimeError):
        atm.check_balance()
