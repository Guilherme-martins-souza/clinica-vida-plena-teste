# Clínica Vida Plena — Sistema de Agendamentos

Desafio técnico: sistema de agendamento de consultas para uma clínica (6 médicos) e uma
funcionalidade, baseada nos dados históricos, que ajude a reduzir as faltas (~28%).
Enunciado e dados originais: `teste-tecnico DEV jr ACS/teste-tecnico/` (fora do git).
Tecnologias e versões: `docs/tecnologias.md`.

## Estrutura
- `frontend/` React + TypeScript (Vite, Mantine, TanStack Query)
- `backend/`  Node + Express + TypeScript (Mongoose, Zod); testes em `backend/tests/`
- `data/` `agendamentos.csv` e `medicos.json` (montada em `/data` no container do backend)

## Regras
- Este arquivo nunca passa de 40 linhas.
- TypeScript sempre em modo strict. Nunca usar `any`: use `unknown` + narrowing ou tipos explícitos.
- `npm run lint` (oxlint, `no-explicit-any` como erro) e `npm run build` precisam passar em backend e frontend.
- Tudo sobe com `docker compose up`: instalação, Mongo, backend, frontend e a importação de `data/`.
  Nada pode exigir passo manual fora do compose.
- Não adicionar bibliotecas ou ferramentas sem perguntar antes.
- Não fazer commit: o usuário revisa e commita.
- Código simples e explicável, sem mágica: o usuário vem de Laravel e Vue.
- Erros do backend sempre em JSON: `{ error: { code, message } }` (lançar `HttpError` de `backend/src/errors.ts`).
- `backend/src/app.ts` não faz listen nem lê env, para os testes rodarem sem Mongo.

## Comandos
- Subir: `docker compose up --build`
- Mudou dependência: `docker compose up --build --renew-anon-volumes`
- Testes: `docker compose exec backend npm test`
- Lint/build: `docker compose exec backend npm run lint` (idem `frontend`, e `npm run build`)
