# Clínica Vida Plena — Sistema de Agendamentos

Desafio técnico: sistema de agendamento de consultas para uma clínica (6 médicos) e uma
funcionalidade, baseada nos dados históricos, que ajude a reduzir as faltas (~28%).
Enunciado e dados originais: `teste-tecnico DEV jr ACS/teste-tecnico/` (fora do git).
Docs: `docsignorar/tecnologias.md`, `docs/decisoes.md`, `docsignorar/uso-de-ia.md`.

## Estrutura
- `frontend/` React + TypeScript (Vite, Mantine, TanStack Query)
- `backend/` Node + Express + TypeScript (Mongoose, Zod); testes em `backend/tests/`
- `whatsapp-mock/` Node + Express, WhatsApp simulado (porta 8025); testes em `whatsapp-mock/tests/`
- `data/` `agendamentos.csv` e `medicos.json` (montada em `/data` no container do backend)

## Visual
- Design system em `vida-plena-design-system/design-system/` (só referência local, fora do git): ler o `README.md` e o do componente antes de criar telas.
- Feito em Mantine: cores só pelos tokens de `frontend/src/theme/tokens.css`, nunca hex no componente; medidas em rem.

## Regras
- Este arquivo nunca passa de 40 linhas.
- TypeScript sempre em modo strict. Nunca usar `any`: use `unknown` + narrowing ou tipos explícitos.
- `npm run lint` (oxlint, `no-explicit-any` como erro) e `npm run build` precisam passar em backend e frontend.
- Tudo sobe com `docker compose up`: instalação, Mongo, backend e frontend. A importação de `data/` NÃO roda
  ao subir: é o comando `docker compose exec backend npm run import`. Nada além disso exige passo manual.
- Não adicionar bibliotecas ou ferramentas sem perguntar antes.
- Commit só quando o usuário pedir, seguindo a skill `commit` (`.claude/skills/commit/`).
- Ao fim de cada etapa: registrar decisões em `docs/decisoes.md` e o uso/correções da IA em `docsignorar/uso-de-ia.md`.
- Código simples e explicável, sem mágica: o usuário vem de Laravel e Vue.
- Sempre formatar (indentar) todo arquivo criado ou alterado, inclusive HTML e CSS, com o Prettier
  (`.prettierrc.json` de cada pasta; o backend usa ponto e vírgula, o frontend não).
- Listas sempre paginadas no backend (`lerPaginacao` de `backend/src/paginacao.ts`): 10 por página por padrão.
- Erros do backend sempre em JSON: `{ error: { code, message } }` (lançar `HttpError` de `backend/src/errors.ts`).
- `backend/src/app.ts` não faz listen nem lê env, para os testes rodarem sem Mongo.

## Comandos
- Subir: `docker compose up --build`
- Mudou dependência: `docker compose up --build --renew-anon-volumes`
- Importar dados: `docker compose exec backend npm run import`
- Testes: `docker compose exec backend npm test` (mock: `docker compose exec whatsapp-mock npm test`)
- Lint/build: `docker compose exec backend npm run lint` (idem `frontend`, `whatsapp-mock`; `npm run build`)
- Formatar: `docker compose exec frontend npm run format` (idem `backend`)
