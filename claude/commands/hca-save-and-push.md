Revise esta conversa, salve aprendizados na memória, e faça commit + push do trabalho.

## Regra Fundamental

NO PUSH WITHOUT FRESH VERIFICATION.
Se não executou `git status` e `git diff` NESTA execução do command, não pode fazer push.

<HARD-GATE>
Se o branch atual é main ou master:
PARE. Pergunte ao usuário: push direto para main ou criar branch + PR?
NÃO faça push para main/master sem confirmação explícita.
</HARD-GATE>

## Processo

### 1. Salvar aprendizados na memória

Identifique aprendizados úteis para FUTURAS sessões:
- Decisões tomadas e seus motivos
- Bugs encontrados e suas causas raiz
- Padrões que funcionaram ou falharam
- Feedback do usuário sobre abordagem

NÃO salve: contexto desta conversa que não será útil depois, fatos que podem
ser derivados lendo o código ou `git log`, detalhes efêmeros (branches temporários,
tentativas descartadas, erros de digitação corrigidos).

Se `.ai/memory/` não existir, rode `/hca-init-memory` primeiro.
Atualize arquivos existentes em vez de criar duplicatas.
Mantenha `MEMORY.md` como índice atualizado.

### 2. Salvar trabalho em andamento

Se houver trabalho em progresso (brainstorm, plano, artefato, spec),
salve no arquivo correspondente. Não deixe trabalho só no contexto da conversa.

### 3. Preparar commits

Execute `git status` — liste o output completo.
Execute `git diff` — analise as mudanças staged e unstaged.

**Detecção de sensíveis:** Execute `git diff --name-only` e `grep -rn` nos arquivos
alterados procurando:
- Nomes de arquivo: `.env`, `.env.*`, `credentials.*`, `*secret*`, `*token*`, `*.pem`, `*.key`
- Conteúdo suspeito: execute `grep -rn "password\|api_key\|secret\|token\|Bearer" <arquivos alterados>`
Se encontrar qualquer item: PARE e pergunte ao usuário antes de incluir no commit.

**Agrupamento:** 1 commit por unidade de trabalho coerente.
Critérios de separação:
- Memória (`.ai/memory/`) = commit separado
- Documentação (`docs/`) = commit separado
- Código/commands = commit separado
- Config = commit separado
Se TUDO é da mesma natureza, 1 commit é suficiente.

**Mensagens:** Siga o padrão do repo. Execute `git log --oneline -5` para ver
o estilo recente. Use prefixos convencionais (feat, fix, docs, refactor).

### 4. Fazer push

Execute `git status` — confirme que está limpo após os commits.
Verifique o branch atual com `git branch --show-current`.
Aplique o HARD-GATE acima se for main/master.
Execute `git push` para o branch atual.
Execute `git status` novamente — confirme que o push foi aceito.

## Encerramento

Reporte:
- Aprendizados salvos: quais arquivos de memória foram alterados
- Commits: quantidade, mensagens, branch
- Push: status final (sucesso/falha)
- Se algo falhou: descreva o erro e sugira correção

## Red Flags

- "Vou fazer push sem verificar, já sei que está ok"
- "É só um arquivo pequeno, não precisa de git status"
- "Vou incluir o .env porque o usuário não mencionou secrets"
- "Vou fazer push para main, é só uma correção rápida"
- "Não preciso separar commits, é tudo relacionado"
- "Já vi o diff mentalmente, não preciso executar git diff"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
