# Clínica Vida Plena — Sistema de Agendamentos

## Como subir

Pré-requisito: Docker com Docker Compose. Não é preciso instalar Node.js nem MongoDB na máquina.

```bash
docker compose up --build
```

Esse único comando:

- instala as dependências do backend e do frontend dentro dos containers;
- sobe o MongoDB, o backend e o frontend, com recarga automática ao salvar arquivos;
- importa automaticamente `data/medicos.json` e `data/agendamentos.csv` na primeira subida
  (veja [Importação dos dados](#importação-dos-dados)).

| Serviço       | URL                                                     |
| ------------- | ------------------------------------------------------- |
| Frontend      | http://localhost:5173                                   |
| Backend (API) | http://localhost:3000/api/health                        |
| MongoDB       | mongodb://localhost:27017/clinica?directConnection=true |

Ao alterar dependências (`package.json`), recrie as imagens e o `node_modules` dos containers:

```bash
docker compose up --build --renew-anon-volumes
```

O MongoDB roda como replica set de um nó (`rs0`), porque só assim ele aceita transações. Para abrir o
banco com uma ferramenta na sua máquina (Compass, mongosh), use `directConnection=true`, como na
tabela acima: sem isso, a ferramenta tenta o host `mongo`, que só existe dentro do Docker.

## Importação dos dados

**Automática.** Ao subir, o backend importa `data/medicos.json` e `data/agendamentos.csv` se ainda não
existe nenhuma importação concluída. Nas próximas subidas ela não roda de novo, para não apagar o que
foi criado pelo sistema. Se a importação falhar, a API sobe mesmo assim e a falha aparece na tela.

**Manual.** Para importar de novo do zero (apaga médicos, pacientes e consultas; o histórico de
importações fica):

```bash
docker compose exec backend npm run import
```

**Relatório.** Cada importação gera:

- um resumo no terminal (no log do compose, ou na saída do `npm run import`);
- o relatório completo no MongoDB, que aparece na tela **Parametrizações › Importações**
  (http://localhost:5173/importacoes), com as linhas descartadas, o motivo e o download do CSV;
- dois arquivos em `data/relatorios/`: `importacao-AAAAMMDD-HHMMSS.json` (relatório) e
  `importacao-AAAAMMDD-HHMMSS-descartes.csv` (linhas não importadas, com o número da linha e o motivo).
  Os arquivos são gravados também quando a importação falha.

Os arquivos de `data/relatorios/` são criados pelo container como `root`. Para apagá-los, use
`sudo rm` ou rode o comando dentro do container:

```bash
docker compose exec backend sh -c "rm /data/relatorios/*"
```

**Principais regras.** A regra geral é "na dúvida, não importa": uma linha só entra quando todos os
dados dela são confiáveis ou foram corrigidos por uma regra sem ambiguidade. Com os arquivos atuais:
7.359 linhas lidas, 7.153 importadas (4.612 com alguma correção) e 206 descartadas.

- Status com outra grafia (`atendido`, `faltou`, `desmarcou`...) é padronizado; `cancelado` sem
  dizer quem cancelou vira cancelamento da clínica.
- Linhas idênticas viram uma só. Mesmo `id` com status diferente: todas são descartadas. Mesmo `id`
  com horário diferente: fica a versão cujo horário está livre; sem como desempatar, todas saem.
- "Passado" e "futuro" são julgados pela data da exportação (o maior `data_agendamento` do arquivo),
  não pelo relógio: o mesmo arquivo gera sempre o mesmo resultado. Consulta passada sem resultado e
  consulta futura já com resultado são descartadas.
- Consultas fora da grade do médico são descartadas; dois pacientes no mesmo horário do mesmo médico
  são importados e aparecem como aviso no relatório.
- Datas nos formatos `AAAA-MM-DD HH:mm` e `DD/MM/AAAA HH:mm`, sempre no fuso de São Paulo (−03:00).

As decisões completas estão em `docs/decisoes.md`.

## Como rodar os testes

Com o projeto rodando:

```bash
docker compose exec backend npm test
```

Os testes de banco usam o MongoDB do compose, em bancos próprios (`clinica_test_*`), separados do
banco `clinica` da aplicação. O teste da importação roda também sobre os arquivos reais de `data/`.
