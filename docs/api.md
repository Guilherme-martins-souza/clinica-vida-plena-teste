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

Filtros de `GET /api/consultas`: `aba=hoje|proximas|aguardando|todas` (sem `aba`, todas), `busca`
(nome do paciente, sem diferenciar acentos e maiúsculas), `status`, `medicoId`, `de` e `ate`.

- **Listas:** `?pagina=1&porPagina=10` (10 por padrão, no máximo 100); a resposta é
  `{ itens, total, pagina, porPagina }`.
- **Erros:** sempre `{ error: { code, message } }`, com o status HTTP certo (400 dados inválidos, 404
  não encontrado, 409 horário ocupado ou status alterado por outra pessoa, 422 regra da agenda).
