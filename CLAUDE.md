# Regras do Projeto CashMind

## Após cada alteração de código

Sempre que fizer qualquer alteração no código:

1. **Fazer commit e push automaticamente** para o repositório — sem precisar pedir. Commitar apenas os arquivos relevantes à alteração.

2. **Finalizar com "Próximo passo:"** com instruções completas e prontas para o usuário, incluindo:
   - Comando exato para atualizar na VPS:
     ```bash
     cd /opt/cashmachine/CashMachine && git pull origin claude/cashmachine-b2b-platform-pL5Y2 && docker compose up -d --build
     ```
   - Migration a aplicar, funcionalidade a testar, ou qualquer outra ação necessária

Seja específico e completo: comandos prontos para copiar e colar, não instruções genéricas.
