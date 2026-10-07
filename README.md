# Clínica Vida Plena — Sistema de Agendamentos

## Como subir

Pré-requisito: Docker com Docker Compose. Não é preciso instalar Node.js nem MongoDB na máquina.

```bash
docker compose up --build
```

Esse único comando:

- instala as dependências do backend e do frontend dentro dos containers;
- sobe o MongoDB, o backend e o frontend, com recarga automática ao salvar arquivos;
- vai executar automaticamente a importação de `data/agendamentos.csv` e `data/medicos.json`
  (a importação ainda será criada).

| Serviço | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend (API) | http://localhost:3000/api/health |
| MongoDB | mongodb://localhost:27017/clinica |

Ao alterar dependências (`package.json`), recrie as imagens e o `node_modules` dos containers:

```bash
docker compose up --build --renew-anon-volumes
```

## Como rodar os testes

Com o projeto rodando:

```bash
docker compose exec backend npm test
```

Os testes não precisam do MongoDB.
