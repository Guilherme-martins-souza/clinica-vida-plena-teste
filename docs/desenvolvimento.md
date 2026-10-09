# Desenvolvimento

## Ao alterar dependências

Ao alterar dependências (`package.json`), recrie as imagens e o `node_modules` dos containers:

```bash
docker compose up --build --renew-anon-volumes
```
