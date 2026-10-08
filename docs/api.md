# API

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
| `GET /api/prevencao-de-faltas`                  | Consultas de risco dos próximos 14 dias (paginada, `?nivel=`).            |
| `GET /api/prevencao-de-faltas/regras`           | Pesos, cortes e fatores da conta do risco.                                |
| `POST /api/consultas/:id/mensagens`             | Envia a confirmação ou o lembrete ao paciente (`{ tipo }`).               |
| `POST /api/consultas/:id/oferecer-vaga`         | Oferece o horário à primeira pessoa elegível da lista de espera.          |
| `POST /api/lista-espera`                        | Cadastra uma pessoa na lista de espera.                                   |
| `GET /api/lista-espera`                         | Lista de espera (paginada), da mais antiga para a mais nova.              |

Filtros de `GET /api/consultas`: `aba=hoje|proximas|aguardando|todas` (sem `aba`, todas), `busca`
(nome do paciente, sem diferenciar acentos e maiúsculas), `status`, `medicoId`, `de` e `ate`.

- **Listas:** `?pagina=1&porPagina=10` (10 por padrão, no máximo 100); a resposta é
  `{ itens, total, pagina, porPagina }`.
- **Erros:** sempre `{ error: { code, message } }`, com o status HTTP certo (400 dados inválidos, 404
  não encontrado, 409 horário ocupado ou status alterado por outra pessoa, 422 regra da agenda).

## Prevenção de faltas

### Campos novos

- **`consideradoFalta`** (booleano): devolvido em cada consulta de `GET /api/consultas` e da aba de prevenção.
  `true` quando o status é `falta` ou quando o paciente cancelou a menos de 24 h do início.
  Cancelamentos antecipados, da clínica, `realizada` e demais status ficam com `false`.
- **`faltoso`** (booleano): devolvido em `GET /api/pacientes`, `GET /api/consultas` e na aba de prevenção.
  `true` com pelo menos 1 atendimento e 25% ou mais de faltas nos 5 últimos atendimentos.

### GET /api/prevencao-de-faltas

Consultas `agendada` ou `confirmada` de agora até o fim do 14º dia seguinte (horário de São Paulo), com risco
média, alta ou muito alta, em ordem cronológica. Filtro: `?nivel=media|alta|muito_alta`, além de `pagina` e `porPagina`.

```json
{
  "itens": [
    {
      "id": "6ac8230efb8c0eafe64798f6",
      "codigo": "AG07258",
      "paciente": { "id": "PAC0147", "nome": "Ricardo Carvalho Teixeira", "telefone": "53920990039" },
      "primeiraConsulta": false,
      "faltoso": true,
      "medico": { "id": "MED03", "nome": "Dr. Carlos Souza", "especialidade": "Ortopedia" },
      "tipoAtendimento": "particular",
      "marcadaEm": "2026-09-24T18:41:00.000Z",
      "inicio": "2026-10-09T11:30:00.000Z",
      "status": "confirmada",
      "consideradoFalta": false,
      "risco": { "pontos": 40, "nivel": "media", "fatores": [{ "codigo": "historico", "pontos": 40 }] }
    }
  ],
  "total": 48,
  "pagina": 1,
  "porPagina": 10
}
```

Erro: 400 `FILTRO_INVALIDO` quando `nivel` não é um dos três valores.

### GET /api/prevencao-de-faltas/regras

Pesos e cortes vêm de `backend/src/risco/pesos.ts`; a tela monta o banner com eles.

```json
{
  "pesos": { "historico": 40, "primeiraConsulta": 25, "convenio": 15, "segundaDeManha": 15, "semConfirmacao": 20 },
  "cortes": { "media": 25, "alta": 50, "muitoAlta": 70 },
  "fatores": [
    {
      "codigo": "historico",
      "rotulo": "Histórico de faltas (2 ou mais, ou mais de 30% dos atendimentos)",
      "pontos": 40
    }
  ]
}
```

`fatores` traz os cinco fatores; o exemplo mostra só o primeiro.

### POST /api/consultas/:id/mensagens

Envia ao `whatsapp-mock` a mensagem 2 (`confirmacao`) ou 3 (`lembrete`), quantas vezes for pedido. Não altera o status da consulta.

- Corpo: `{ "tipo": "confirmacao" }` ou `{ "tipo": "lembrete" }`.
- Resposta 200: `{ "enviada": true }`.
- Erros: 400 `DADOS_INVALIDOS` (tipo ausente ou inválido), 404 `CONSULTA_NAO_ENCONTRADA`,
  422 `SEM_TELEFONE` (paciente sem telefone), 502 `MENSAGEM_NAO_ENVIADA` (mock fora do ar ou com erro).

### POST /api/consultas/:id/oferecer-vaga

Envia a mensagem 4 (vaga disponível) à pessoa mais antiga da lista de espera do mesmo médico, ou sem médico definido.
Não altera a consulta nem remove a pessoa da fila. Sem corpo.

- Resposta 200: `{ "enviada": true }`.
- Erros: 404 `CONSULTA_NAO_ENCONTRADA`, 404 `SEM_LISTA_DE_ESPERA` (ninguém elegível), 502 `MENSAGEM_NAO_ENVIADA`.

### POST /api/lista-espera

Corpo: `nome` e `telefone` (só dígitos, 10 ou 11, com DDD) são obrigatórios; `medicoId` e `antecipar` são opcionais.

```json
{ "nome": "Helena Prado", "telefone": "11955550001", "medicoId": "MED01", "antecipar": false }
```

Resposta 201:

```json
{
  "id": "6ac8268bcb5f61492c5a0d28",
  "nome": "Helena Prado",
  "telefone": "11955550001",
  "medicoId": "MED01",
  "antecipar": false,
  "criadoEm": "2026-10-08T23:21:03.057Z"
}
```

Erro: 400 `DADOS_INVALIDOS` quando o corpo não segue o formato acima.

### GET /api/lista-espera

Paginada (`{ itens, total, pagina, porPagina }`), da pessoa mais antiga para a mais nova, que é a ordem da oferta de vaga.
Cada item tem os mesmos campos da resposta do `POST`. Ao subir com a coleção vazia, o backend grava 5 pessoas fictícias.
