class Account:
    def __init__(self, account_id: str, pin: str, owner: str, balance: float = 0.0):
        self.account_id = account_id
        self._pin = pin
        self.owner = owner
        self._balance = balance
        self._transactions: list[dict] = []

    def verify_pin(self, pin: str) -> bool:
        return self._pin == pin

    def get_balance(self) -> float:
        return self._balance

    def deposit(self, amount: float) -> float:
        if amount <= 0:
            raise ValueError("Deposit amount must be positive.")
        self._balance += amount
        self._transactions.append({"type": "deposit", "amount": amount, "balance": self._balance})
        return self._balance

    def withdraw(self, amount: float) -> float:
        if amount <= 0:
            raise ValueError("Withdrawal amount must be positive.")
        if amount > self._balance:
            raise ValueError("Insufficient funds.")
        self._balance -= amount
        self._transactions.append({"type": "withdrawal", "amount": amount, "balance": self._balance})
        return self._balance

    def get_statement(self) -> list[dict]:
        return list(self._transactions)
