Mantenha o estado canônico de iniciativas em `.atomic-skills/` — ler, criar, atualizar e exibir.

## Regra Fundamental

NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.

Todo código modificado deve ser ancorado a uma iniciativa ativa em `.atomic-skills/initiatives/<slug>.md`, ou o usuário deve declarar explicitamente "ad-hoc".

## Detecção inicial

Rode com {{BASH_TOOL}}:
- `test -d .atomic-skills/` — se não existe, entre em modo setup
- Se existe, leia `.atomic-skills/PROJECT-STATUS.md` e determine iniciativa ativa

## Modos

Ver seções abaixo conforme os args recebidos em {{ARG_VAR}}.

(Implementação completa nas tasks 11-15 do plano.)
