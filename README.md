# CashMachine

Simulador de caixa eletrônico (ATM) em Python.

## Funcionalidades

- Cadastro de contas com saldo inicial
- Autenticação por PIN com bloqueio após 3 tentativas incorretas
- Consulta de saldo
- Depósito
- Saque (limite por transação e verificação de reserva do caixa)
- Extrato de transações
- Ejeção de cartão (encerra a sessão)

## Estrutura

```
CashMachine/
├── account.py        # Modelo de conta bancária
├── cash_machine.py   # Lógica do caixa eletrônico
├── main.py           # Demonstração de uso
├── requirements.txt
└── tests/
    ├── test_account.py
    └── test_cash_machine.py
```

## Como executar

```bash
pip install -r requirements.txt

# Demo
python main.py

# Testes
pytest tests/ -v
```
