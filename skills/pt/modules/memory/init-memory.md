Padronize a memória deste projeto para `{{memory_path}}` (canônica, versionada no git).

Anuncie ao iniciar: "Vou padronizar a memória deste projeto para `{{memory_path}}`."

## Regra Fundamental

NO DELETION WITHOUT CONFIRMED BACKUP.
Diretórios originais de memória só podem ser removidos APÓS confirmar que
TODOS os arquivos foram copiados com sucesso para `{{memory_path}}`.
Confirmar = executar `ls` em ambos os diretórios e comparar.

## Contexto Crítico — Como o Claude Code lê memória

O Claude Code carrega auto-memory de `~/.claude/projects/<project>/memory/MEMORY.md` por padrão.
Mover arquivos para `{{memory_path}}` NÃO faz o Claude lê-los automaticamente.

Existem 2 formas de conectar `{{memory_path}}` ao Claude Code:

**Caminho A — `autoMemoryDirectory` (recomendado):** Configurar em `.claude/settings.local.json`:
```json
{ "autoMemoryDirectory": "/path/absoluto/para/{{memory_path}}" }
```
O Claude passa a ler `{{memory_path}}MEMORY.md` diretamente. Sem intermediário.
- Aceita apenas path absoluto
- Apenas em settings.local.json ou user settings (NÃO project settings)
- Cada máquina precisa configurar (não é compartilhável)

**Caminho B — Redirect (fallback):** Criar um `MEMORY.md` em `~/.claude/projects/<project>/memory/`
que aponte para `{{memory_path}}`. Funciona mas é frágil — novos arquivos de memória
ficam invisíveis se o redirect não for atualizado.

## Limites do MEMORY.md

- Apenas as primeiras **200 linhas** (ou 25KB) são carregadas no startup
- Topic files (arquivos além do MEMORY.md) são lidos sob demanda
- Se o índice crescer demais, conteúdo no final é **silenciosamente truncado**
- Mantenha MEMORY.md como índice lean com links para topic files

## Processo

### 1. Detectar memória existente

Escaneie o projeto executando `ls` e `find` nos locais conhecidos:
- `{{memory_path}}`
- `.memory/`
- `docs/memory/`
- `~/.claude/projects/*/memory/` — auto-memory padrão do Claude Code (pode ter conteúdo)
- Qualquer outro diretório referenciado nas instruções do projeto como memória

Execute `grep -r "memory\|memória\|autoMemoryDirectory" CLAUDE.md AGENTS.md .claude/settings*.json 2>/dev/null`
para encontrar referências e configurações existentes.

Se encontrar diretórios não-previstos, liste e pergunte ao usuário.

### 2. Apresentar achados e pedir confirmação

Liste o que encontrou com origem, quantidade de arquivos, e tamanho total.

Apresente como Structured Options:

> Encontrei memória em:
> 1. `.memory/` (8 arquivos, 12KB)
> 2. `~/.claude/projects/.../memory/` (3 arquivos, 4KB) — auto-memory do Claude Code
>
> Opções:
> A) Migrar tudo para `{{memory_path}}`
> B) Selecionar quais migrar
> C) Cancelar

Aguarde resposta antes de prosseguir.

### 3. Migrar arquivos

- Crie `{{memory_path}}` se não existir
- Copie os arquivos aprovados para `{{memory_path}}`
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
- **Sem memória nenhuma**: crie `{{memory_path}}MEMORY.md` com índice vazio
- **Blob único** (um arquivo gigante com tudo misturado): separe em arquivos
  temáticos agrupados por afinidade. Nomes descritivos conforme o domínio.
  Único obrigatório: `MEMORY.md` como índice.

Verifique que `MEMORY.md` tem **menos de 200 linhas**. Se passou, mova conteúdo
detalhado para topic files e deixe apenas links no índice.

### 5. Conectar ao Claude Code

Detecte o IDE em uso verificando a existência de `.claude/`, `.cursor/`, `.gemini/`, etc.

**Se Claude Code (`.claude/` existe):**

Verifique se `autoMemoryDirectory` já está configurado:
```bash
grep -r "autoMemoryDirectory" .claude/settings*.json 2>/dev/null
```

Se NÃO configurado, apresente:

> O Claude Code lê memória de `~/.claude/projects/<project>/memory/` por padrão.
> Para ler de `{{memory_path}}` diretamente, preciso configurar `autoMemoryDirectory`.
>
> A) Configurar `autoMemoryDirectory` em `.claude/settings.local.json` (recomendado)
> B) Criar redirect manual no diretório padrão (frágil, precisa manutenção)
> C) Pular — configurar depois

Se opção A: adicione `"autoMemoryDirectory": "<path absoluto de {{memory_path}}>"` ao `.claude/settings.local.json`.
Se opção B: crie redirect em `~/.claude/projects/<project>/memory/MEMORY.md` apontando para `{{memory_path}}`.

**Se outro IDE:** pule este passo (outros IDEs não têm auto-memory nativo).

### 6. Atualizar instruções do projeto

- Se o arquivo de instruções do projeto NÃO existir: crie com seção de memória
- Se JÁ existir E `autoMemoryDirectory` foi configurado (passo 5A):
  NÃO adicione instrução de memória ao CLAUDE.md — o Claude já lê automaticamente.
  Cada linha no CLAUDE.md custa tokens em TODA sessão.
- Se JÁ existir E usando redirect (passo 5B) ou outro IDE:
  Adicione o mínimo:
  ```
  ## Memória
  Consulte `{{memory_path}}MEMORY.md` antes de implementar.
  Atualize a memória ao aprender algo relevante para sessões futuras.
  ```

### 7. Atualizar referências quebradas

Execute `grep -r` nos paths antigos de memória pelo projeto inteiro.

- **Arquivos operacionais** (instruções do projeto, configs de agentes):
  atualize as referências para `{{memory_path}}`
- **Docs históricos** (plans, designs, specs): liste as referências
  mas NÃO altere sem perguntar — são registros históricos

### 8. Validação e cleanup

Verifique executando cada comando (não apenas "verifique"):

- Execute `ls {{memory_path}}` — deve mostrar os arquivos migrados
- Execute `wc -l {{memory_path}}MEMORY.md` — deve ser < 200 linhas
- Verifique a conexão com o Claude Code:
  - Se autoMemoryDirectory: `grep autoMemoryDirectory .claude/settings*.json`
  - Se redirect: `cat ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null | head -5`
- Verifique que as instruções do projeto NÃO têm instrução redundante de memória
  (se autoMemoryDirectory foi configurado)

Se TUDO passou: agora remova os diretórios originais (os que foram migrados).
Para cada diretório a remover, liste o path completo e peça confirmação:

> Remover diretório original `.memory/`? (arquivos já estão em `{{memory_path}}`)
> Digite "remover" para confirmar.

## Encerramento

Apresente relatório:
- Arquivos migrados: [quantidade] de [origem(s)]
- MEMORY.md: [linhas] (limite: 200)
- Conexão Claude Code: [autoMemoryDirectory / redirect / não configurado]
- Instruções do projeto: [criado/atualizado/não necessário]
- Referências atualizadas: [quais arquivos]
- Diretórios removidos: [quais]
- Problemas encontrados: [se houver]

## Red Flags

- "Vou remover o diretório original antes de validar"
- "O conteúdo provavelmente foi copiado, não preciso testar"
- "As instruções do projeto já devem ter a referência, não preciso verificar"
- "Vou editar um doc histórico para atualizar o path"
- "Esse diretório de memória não-previsto provavelmente não é importante"
- "Não preciso verificar o autoMemoryDirectory, o Claude vai encontrar"
- "Vou adicionar instrução de memória no CLAUDE.md mesmo com autoMemoryDirectory configurado"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
