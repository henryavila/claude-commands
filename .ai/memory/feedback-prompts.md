# Feedback — Escrita de Prompts

## Instruções vagas são ignoradas
Regras como "itere até não haver mais erros" sem estrutura explícita levam o Claude a fazer uma passada só e parar.
**Why:** Observado ao rodar hca-review-plan-internal — o Claude admitiu que não iterou.
**How to apply:** Sempre estruturar processos repetitivos como loops explícitos com:
1. Passo de execução
2. Passo de verificação (releitura do resultado)
3. Critério de parada claro ("se não encontrou nada novo, pare")
4. Exigir reporte de quantas iterações foram feitas (força o comportamento)
