Padronize a memória deste projeto para `.ai/memory/` (canônica, versionada no git),
com `~/.claude/projects/.../memory/` sendo apenas um symlink.

Anuncie ao iniciar: "Vou padronizar a memória deste projeto para `.ai/memory/`."

## Regra Fundamental

NO DELETION WITHOUT CONFIRMED BACKUP.
Diretórios originais de memória só podem ser removidos APÓS confirmar que
TODOS os arquivos foram copiados com sucesso para `.ai/memory/`.
Confirmar = executar `ls` em ambos os diretórios e comparar.

## Processo

### 1. Detectar memória existente

Escaneie o projeto executando `ls` e `find` nos locais conhecidos:
- `.ai/memory/`
- `.memory/`
- `.claude/memory/`
- `docs/claude-memory/`
- `~/.claude/projects/{path-encoded}/memory/` (path encoded: `/a/b/c` → `-a-b-c`)
- Qualquer outro diretório referenciado em `CLAUDE.md` como memória

Execute `grep -r "memory\|memória" CLAUDE.md AGENTS.md 2>/dev/null` para
encontrar referências não-óbvias.

Ignore automaticamente `_bmad/_memory/` — é memória do módulo BMAD.
Se encontrar diretórios não-previstos, liste e pergunte ao usuário.

### 2. Apresentar achados e pedir confirmação

Liste o que encontrou com origem, quantidade de arquivos, e tamanho total.

Apresente como Structured Options:

> Encontrei memória em:
> 1. `.memory/` (8 arquivos, 12KB)
> 2. `~/.claude/projects/-home-henry-projeto/memory/` (3 arquivos, 4KB)
> 3. `_bmad/_memory/` — **ignorado automaticamente** (memória BMAD)
>
> Opções:
> A) Migrar tudo (itens 1 e 2) para `.ai/memory/`
> B) Selecionar quais migrar
> C) Cancelar

Aguarde resposta antes de prosseguir.

### 3. Migrar arquivos

- Crie `.ai/memory/` se não existir
- Copie os arquivos aprovados para `.ai/memory/`
- Se houver múltiplos `MEMORY.md`, mescle num único índice
- Execute `ls` no destino para confirmar que todos os arquivos chegaram

<HARD-GATE>
NÃO remova os diretórios originais ainda.
A remoção só acontece no passo 8, após TODA a validação.
Se o usuário pedir para remover agora: explique que a validação
garante segurança e a remoção vem no final.
</HARD-GATE>

### 4. Organizar conteúdo

- **Já tem estrutura** (múltiplos arquivos temáticos): preserve como está
- **Sem memória nenhuma**: crie `.ai/memory/MEMORY.md` com índice vazio
- **Blob único** (um arquivo gigante com tudo misturado): separe em arquivos
  temáticos agrupados por afinidade. Nomes descritivos conforme o domínio.
  Único obrigatório: `MEMORY.md` como índice.

### 5. Criar symlink

- Calcule o path encoded: `/home/user/projeto` → `-home-user-projeto`
- Se `~/.claude/projects/{encoded}/memory/` existir (diretório real ou symlink),
  remova o antigo (é seguro — os arquivos já estão em `.ai/memory/`)
- Crie: `ln -s {repo}/.ai/memory/ ~/.claude/projects/{encoded}/memory/`
- Crie o diretório pai se não existir

### 6. Atualizar CLAUDE.md

- Se NÃO existir: crie com seção de memória
- Se JÁ existir: adicione ou atualize a seção de memória

Conteúdo mínimo da seção:
```
## Memória
Consulte `.ai/memory/MEMORY.md` antes de implementar.
Atualize a memória ao aprender algo relevante para sessões futuras.
```

### 7. Atualizar referências quebradas

Execute `grep -r` nos paths antigos de memória pelo projeto inteiro.

- **Arquivos operacionais** (CLAUDE.md, AGENTS.md, configs):
  atualize as referências para `.ai/memory/`
- **Docs históricos** (plans, designs, specs): liste as referências
  mas NÃO altere sem perguntar — são registros históricos

### 8. Validação e cleanup

Verifique executando cada comando (não apenas "verifique"):

- Execute `ls -la ~/.claude/projects/{encoded}/memory/` via symlink
  — deve mostrar os arquivos de `.ai/memory/`
- Execute `readlink ~/.claude/projects/{encoded}/memory/`
  — deve apontar para `{repo}/.ai/memory/`
- Execute `grep -l "memory\|memória" CLAUDE.md`
  — deve encontrar referência a `.ai/memory/`
- Execute `ls .ai/memory/MEMORY.md`
  — deve existir

Se TUDO passou: agora remova os diretórios originais (os que foram migrados).
Para cada diretório a remover, liste o path completo e peça confirmação:

> Remover diretório original `.memory/`? (arquivos já estão em `.ai/memory/`)
> Digite "remover" para confirmar.

## Encerramento

Apresente relatório:
- Arquivos migrados: [quantidade] de [origem(s)]
- Symlink: `~/.claude/projects/{encoded}/memory/` → `{repo}/.ai/memory/`
- CLAUDE.md: [criado/atualizado]
- Referências atualizadas: [quais arquivos]
- Diretórios removidos: [quais]
- Problemas encontrados: [se houver]

## Red Flags

- "Vou remover o diretório original antes de validar"
- "O symlink provavelmente está certo, não preciso testar"
- "CLAUDE.md já deve ter a referência, não preciso verificar"
- "Vou editar um doc histórico para atualizar o path"
- "Esse diretório de memória não-previsto provavelmente não é importante"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
