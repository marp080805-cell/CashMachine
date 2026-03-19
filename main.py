from account import Account
from cash_machine import CashMachine


def main():
    atm = CashMachine(cash_reserve=5000.0)

    alice = Account(account_id="001", pin="1234", owner="Alice", balance=1500.0)
    bob = Account(account_id="002", pin="5678", owner="Bob", balance=300.0)
    atm.register_account(alice)
    atm.register_account(bob)

    print("=== CashMachine Demo ===\n")

    atm.insert_card("001")
    atm.enter_pin("1234")

    print(f"Balance: R$ {atm.check_balance():.2f}")
    atm.deposit(200.0)
    print(f"After deposit of R$ 200.00: R$ {atm.check_balance():.2f}")
    atm.withdraw(500.0)
    print(f"After withdrawal of R$ 500.00: R$ {atm.check_balance():.2f}")

    print("\nStatement:")
    for entry in atm.get_statement():
        print(f"  {entry['type']:12s}  R$ {entry['amount']:8.2f}  ->  balance R$ {entry['balance']:.2f}")

    atm.eject_card()
    print("\nCard ejected.")


if __name__ == "__main__":
    main()
