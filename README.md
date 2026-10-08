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
tabela acima: sem isso, a ferramenta tenta o host `mongo`, que só existe dentro do Docker, e falha com
`getaddrinfo ENOTFOUND mongo`. No Compass, a opção fica em _Advanced Connection Options › General ›
Direct Connection_.

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
7.359 linhas lidas, 7.071 importadas e 288 descartadas.

- Status com outra grafia (`atendido`, `faltou`, `desmarcou`...) é padronizado; `cancelado` sem
  dizer quem cancelou vira cancelamento da clínica.
- Linhas idênticas viram uma só. Mesmo `id` com status diferente: todas são descartadas. Mesmo `id`
  com horário diferente: fica a versão cujo horário está livre; sem como desempatar, todas saem.
- "Passado" e "futuro" são julgados pela data da exportação (o maior `data_agendamento` do arquivo),
  não pelo relógio: o mesmo arquivo gera sempre o mesmo resultado. Consulta passada sem resultado e
  consulta futura já com resultado são descartadas.
- Consultas fora da grade do médico são descartadas. Se o médico (ou o paciente) já tem consulta não
  cancelada no mesmo horário, fica a marcada primeiro e as outras são descartadas como "horário
  ocupado", a mesma regra da criação de consultas.
- Datas nos formatos `AAAA-MM-DD HH:mm` e `DD/MM/AAAA HH:mm`, sempre no fuso de São Paulo (−03:00).

As decisões completas estão em `docs/decisoes.md`.

## Telas

- **Indicadores:** taxa de falta, consultas, faltas por médico, por dia e turno e por antecedência da
  marcação, comparando com o período anterior. O período vem de um atalho (30 dias, 3 meses, 12
  meses) ou de um intervalo personalizado escolhido no calendário.
- **Agendamentos:** abas Hoje, Próximas, Aguardando registro (consultas que já passaram sem resultado)
  e Todas, com busca por paciente e filtros de status, médico e período (este só em Todas). O botão
  "Novo agendamento" abre um painel com médico, paciente, data e os horários livres; o status de cada
  consulta é trocado pelo menu da linha.
- **Médicos:** os seis médicos com a especialidade e a grade de atendimento.
- **Parametrizações › Pacientes:** pacientes com busca por nome, consultas concluídas e faltas.
- **Parametrizações › Importações:** histórico das importações, com o detalhe e as linhas descartadas.

## API

Todas as rotas ficam em `http://localhost:3000/api`.

| Rota                                            | O que faz                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/health`                               | Saúde da API e do banco.                                                  |
| `GET /api/importacoes`                          | Lista das importações (paginada).                                         |
| `GET /api/importacoes/:id`                      | Detalhe de uma importação.                                                |
| `GET /api/importacoes/:id/descartes`            | Linhas descartadas (paginada, `?motivo=`).                                |
| `GET /api/importacoes/:id/descartes.csv`        | Download das linhas descartadas em CSV.                                   |
| `POST /api/consultas`                           | Cria uma consulta (`medicoId`, `pacienteId`, `inicio` com fuso).          |
| `PATCH /api/consultas/:id/status`               | Troca o status de uma consulta (`{ status }`).                            |
| `GET /api/consultas`                            | Lista de consultas (paginada). Filtros abaixo.                            |
| `GET /api/consultas/contagens`                  | Quantidade de consultas em cada aba.                                      |
| `GET /api/medicos`                              | Médicos com a grade de atendimento.                                       |
| `GET /api/medicos/:id/horarios?data=AAAA-MM-DD` | Horários do dia (`livre`, `ocupado`, `passado`) e o próximo dia com vaga. |
| `GET /api/pacientes?busca=`                     | Pacientes (paginada), com concluídas, faltas e 1ª consulta.               |
| `GET /api/indicadores?de=&ate=`                 | Indicadores do período (datas `AAAA-MM-DD`).                              |

Filtros de `GET /api/consultas`: `aba=hoje|proximas|aguardando|todas` (sem `aba`, todas), `busca`
(nome do paciente, sem diferenciar acentos e maiúsculas), `status`, `medicoId`, `de` e `ate`.

- **Listas:** `?pagina=1&porPagina=10` (10 por padrão, no máximo 100); a resposta é
  `{ itens, total, pagina, porPagina }`.
- **Erros:** sempre `{ error: { code, message } }`, com o status HTTP certo (400 dados inválidos, 404
  não encontrado, 409 horário ocupado ou status alterado por outra pessoa, 422 regra da agenda).

## Decisões da Parte 1

O enunciado deixa cinco perguntas em aberto. As respostas:

1. **Cancelamento do paciente com menos de 24 h conta como falta.** O horário cancelado em cima da
   hora dificilmente é reaproveitado, e o efeito para a clínica é o mesmo da falta. Cancelamento da
   clínica nunca conta (D23).
2. **Taxa de falta = faltas ÷ (realizadas + faltas).** Cancelamentos com antecedência ficam fora: o
   horário foi liberado e pode ser reaproveitado. No exemplo do enunciado (10 consultas, 2 faltas, 2
   cancelamentos), a taxa é 2 de 8 = 25% (D24).
3. **Primeira consulta é a primeira do paciente na clínica**, com qualquer médico, entre as não
   canceladas. A hipótese de que "paciente novo falta mais" é sobre o vínculo com a clínica, e uma
   consulta cancelada não chegou a acontecer (D25).
4. **Duplicados e conflitos do CSV: na dúvida, não importa.** Linhas idênticas viram uma; versões
   conflitantes do mesmo `id` sem como desempatar são descartadas; horário já ocupado fica com a
   consulta marcada primeiro. É melhor perder poucas linhas do que levar ao sistema um dado incerto, e
   todo descarte fica no relatório com o motivo (D26, D40).
5. **O que fazer com pacientes que faltam com frequência:** em aberto, será decidida depois.

## Como rodar os testes

Com o projeto rodando:

```bash
docker compose exec backend npm test
```

Os testes de banco usam o MongoDB do compose, em bancos próprios (`clinica_test*`), separados do
banco `clinica` da aplicação, e apagam esses bancos ao terminar. O teste da importação roda também
sobre os arquivos reais de `data/`.
