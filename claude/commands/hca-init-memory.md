Padronize a memória deste projeto para `.ai/memory/` (canônica, versionada no git),
com `~/.claude/projects/.../memory/` sendo apenas um symlink.

## 1. Detectar memória existente

Escaneie o projeto em busca de memória em locais conhecidos:
- `.ai/memory/`
- `.memory/`
- `.claude/memory/`
- `docs/claude-memory/`
- `~/.claude/projects/{path-encoded}/memory/` (path encoded: `/a/b/c` → `-a-b-c`)
- Qualquer outro diretório referenciado em `CLAUDE.md` como memória

Ignore automaticamente `_bmad/_memory/` — é memória do módulo BMAD (agentes/sidecars), não da aplicação.

## 2. Apresentar achados e pedir confirmação

Liste o que encontrou com origem e quantidade de arquivos. Exemplo:

> Encontrei memória em:
> - `.memory/` (8 arquivos)
> - `~/.claude/projects/-home-henry-projeto/memory/` (3 arquivos)
> - `_bmad/_memory/` — **ignorado** (memória BMAD)
>
> Migrar para `.ai/memory/`?

Aguarde confirmação antes de prosseguir. O usuário pode excluir itens.

## 3. Migrar arquivos

- Crie `.ai/memory/` se não existir
- Copie os arquivos aprovados para `.ai/memory/`
- Se houver múltiplos MEMORY.md, mescle num único índice
- Remova os diretórios originais somente após confirmar sucesso da cópia

## 4. Organizar conteúdo

- **Já tem estrutura** (múltiplos arquivos temáticos): preserve como está
- **Não tem memória nenhuma**: crie `.ai/memory/MEMORY.md` com índice vazio
- **Blob único** (um arquivo gigante com tudo misturado): separe em arquivos
  temáticos agrupados por afinidade. Use nomes descritivos conforme o domínio
  do projeto. O único arquivo obrigatório é `MEMORY.md` como índice — o resto
  você organiza conforme fizer sentido para o projeto.

## 5. Criar symlink

- Calcule o path encoded do projeto atual (`/home/user/projeto` → `-home-user-projeto`)
- Se `~/.claude/projects/{encoded}/memory/` existir (diretório real ou symlink antigo), remova
- Crie o symlink: `~/.claude/projects/{encoded}/memory/` → `{repo}/.ai/memory/`
- Crie o diretório pai (`~/.claude/projects/{encoded}/`) se não existir

## 6. Atualizar CLAUDE.md

- Se NÃO existir: crie com uma seção de memória
- Se JÁ existir: adicione ou atualize a seção de memória

A seção deve conter, no mínimo:
```
## Memória
Consulte `.ai/memory/MEMORY.md` antes de implementar.
Atualize a memória ao aprender algo relevante para sessões futuras.
```

## 7. Atualizar referências quebradas

Escaneie o projeto inteiro por referências aos paths antigos de memória
(os diretórios encontrados no passo 1 que foram migrados).

- **Arquivos operacionais** (CLAUDE.md, AGENTS.md, instrucoes.md, configs):
  atualize as referências para `.ai/memory/`
- **Docs históricos** (plans, designs, specs): liste as referências encontradas
  mas NÃO altere sem perguntar — são registros históricos

## 8. Validação final

Verifique que tudo funciona:
- [ ] Symlink resolve corretamente (`ls` via symlink retorna os arquivos)
- [ ] `CLAUDE.md` referencia `.ai/memory/`
- [ ] Não há referências órfãs aos paths antigos em arquivos operacionais
- [ ] `MEMORY.md` existe e serve como índice dos demais arquivos

Apresente um relatório resumido:
- Arquivos migrados (quantidade e origem)
- Symlink criado (de → para)
- Referências atualizadas (quais arquivos)
- Problemas encontrados (se houver)
