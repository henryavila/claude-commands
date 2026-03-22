# Feedback — Escrita de Prompts

## Instruções vagas são ignoradas
Regras como "itere até não haver mais erros" sem estrutura explícita levam o Claude a fazer uma passada só e parar.
**Why:** Observado ao rodar hca-review-plan-internal — o Claude admitiu que não iterou.
**How to apply:** Sempre estruturar processos repetitivos como loops explícitos com:
1. Passo de execução
2. Passo de verificação (releitura do resultado)
3. Critério de parada claro ("se não encontrou nada novo, pare")
4. Exigir reporte de quantas iterações foram feitas (força o comportamento)

## Para garantir ações específicas da IA, nomeie a ferramenta e exija prova
O agente interpreta instruções em termos de *resultado* ("releia o plano") como operações mentais, não ações reais. Dizer "releia" não garante uma chamada de Read. Dizer "verifique" não garante um grep.
**Why:** Observado em 2026-03-21 — dois usos do hca-review-plan-internal mostraram que o agente reportava "3 iterações" mas admitia que eram lineares, sem releitura real do arquivo. Corrigido nomeando a ferramenta + exigindo evidência (line numbers). Confirmado que funcionou após a correção.
**How to apply:** Quando o prompt precisa que a IA execute uma ação concreta (não apenas "pense sobre"):
1. **Nomeie a ferramenta:** "usando a ferramenta Read" em vez de "releia"
2. **Exija prova observável:** "cite line numbers" / "mostre o output" — se não executou, não tem o que citar
3. **Peça contagem de chamadas:** "quantas chamadas Read foram feitas" — força consciência sobre o comportamento real
4. Verbos abstratos (releia, verifique, confira, valide) são interpretados como operações mentais. Verbos concretos + nome da ferramenta são interpretados como ações.
