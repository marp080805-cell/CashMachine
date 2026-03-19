from account import Account

MAX_PIN_ATTEMPTS = 3
MAX_WITHDRAWAL = 1000.0


class CashMachine:
    def __init__(self, cash_reserve: float = 10000.0):
        self._accounts: dict[str, Account] = {}
        self._cash_reserve = cash_reserve
        self._current_account: Account | None = None
        self._pin_attempts = 0

    def register_account(self, account: Account) -> None:
        self._accounts[account.account_id] = account

    def insert_card(self, account_id: str) -> bool:
        if account_id not in self._accounts:
            return False
        self._current_account = self._accounts[account_id]
        self._pin_attempts = 0
        return True

    def enter_pin(self, pin: str) -> bool:
        if self._current_account is None:
            raise RuntimeError("No card inserted.")
        if self._pin_attempts >= MAX_PIN_ATTEMPTS:
            raise RuntimeError("Card blocked due to too many incorrect PIN attempts.")
        if self._current_account.verify_pin(pin):
            self._pin_attempts = 0
            return True
        self._pin_attempts += 1
        if self._pin_attempts >= MAX_PIN_ATTEMPTS:
            self.eject_card()
            raise RuntimeError("Card blocked due to too many incorrect PIN attempts.")
        return False

    def check_balance(self) -> float:
        self._require_session()
        return self._current_account.get_balance()

    def deposit(self, amount: float) -> float:
        self._require_session()
        return self._current_account.deposit(amount)

    def withdraw(self, amount: float) -> float:
        self._require_session()
        if amount > MAX_WITHDRAWAL:
            raise ValueError(f"Cannot withdraw more than {MAX_WITHDRAWAL:.2f} per transaction.")
        if amount > self._cash_reserve:
            raise ValueError("ATM does not have sufficient cash.")
        new_balance = self._current_account.withdraw(amount)
        self._cash_reserve -= amount
        return new_balance

    def get_statement(self) -> list[dict]:
        self._require_session()
        return self._current_account.get_statement()

    def eject_card(self) -> None:
        self._current_account = None
        self._pin_attempts = 0

    def _require_session(self) -> None:
        if self._current_account is None:
            raise RuntimeError("No active session. Please insert a card and enter your PIN.")
