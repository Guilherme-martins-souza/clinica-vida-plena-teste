# Clínica Vida Plena — Sistema de Agendamentos

## Como subir

Pré-requisito: Docker com Docker Compose. Não é preciso instalar Node.js nem MongoDB na máquina.

```bash
docker compose up --build
```

Esse único comando:

- instala as dependências do backend e do frontend dentro dos containers;
- sobe o MongoDB, o backend e o frontend, com recarga automática ao salvar arquivos.

Os dados não são importados ao subir: rode o comando de [Importação dos dados](#importação-dos-dados).

| Serviço       | URL                                                     |
| ------------- | ------------------------------------------------------- |
| Frontend      | http://localhost:5173                                   |
| Backend (API) | http://localhost:3000/api/health                        |
| MongoDB       | mongodb://localhost:27017/clinica?directConnection=true |
| WhatsApp mock | http://localhost:8025                                   |

## Importação dos dados

Para limpar o banco e rodar a importação novamente rode:

```bash
docker compose exec backend npm run import
```

**Detalhes da importação** podem ser verificados na tela de importações
(http://localhost:5173/importacoes). Além disso, cada importação gera:

- um resumo no terminal (no log do compose, ou na saída do `npm run import`);
- dois arquivos em `data/relatorios/`: `importacao-AAAAMMDD-HHMMSS.json` (relatório) e
  `importacao-AAAAMMDD-HHMMSS-descartes.csv` (linhas não importadas, com o número da linha e o motivo).
  Os arquivos são gravados também quando a importação falha.

**Decisões da importação.** Regra principal: na dúvida, não importa. Só entra o que temos certeza de
que está correto; o que fica de fora vai para uma listagem de descartes, para a clínica corrigir e
usar numa carga futura.

- **Status:** grafias diferentes (`atendido`, `faltou`, `desmarcou`...) são padronizadas. Cancelamento
  sem informar quem cancelou vira cancelamento da clínica.
- **Duplicados:** linhas idênticas viram uma. Mesmo `id` com status diferente: todas saem. Mesmo `id`
  com horário diferente: fica a versão cujo horário está livre; sem desempate, todas saem.
- **Passado e futuro** são julgados pelo maior `data_agendamento` do arquivo, não pelo relógio, para o
  mesmo arquivo dar sempre o mesmo resultado. Consulta passada sem resultado ou futura com resultado sai.
- **Conflito de horário:** se o médico, ou o paciente, já tem outra consulta (não cancelada) no mesmo
  horário, fica só a que foi marcada primeiro; as demais são descartadas com o motivo "horário
  ocupado". Consultas canceladas não contam como conflito.

## O que os dados mostraram

As faltas se concentram em alguns momentos. Segunda de manhã (46,9% de faltas) e primeira consulta
(36,9%) estão bem acima da média de 31,7%. O convênio quase não diferencia (32,0% contra 31,0%).
Por isso o risco de falta é uma pontuação por fatores: é simples de explicar e de ajustar, e leva a
recepção a agir em quem mais precisa em vez de avisar todos do mesmo jeito. O convênio, que pouco
diferencia, tem o menor peso.

## Decisões da Parte 1

O enunciado deixa cinco perguntas em aberto. As respostas:

1. **Cancelamento do paciente com menos de 24 h conta como falta.** O horário cancelado em cima da
   hora dificilmente é reaproveitado, e o efeito para a clínica é o mesmo da falta. Marcando como falta, também sabemos quem cobrar mesmo não tendo comparecido. Cancelamento da
   clínica nunca conta.
2. **Taxa de falta = faltas ÷ (realizadas + faltas).** Cancelamentos com antecedência ficam fora: o
   horário foi liberado e pode ser reaproveitado. No exemplo do enunciado (10 consultas, 2 faltas, 2
   cancelamentos), a taxa é 2 de 8 = 25%.
3. **Primeira consulta é a primeira do paciente na clínica**, com qualquer médico, entre as não
   canceladas. A hipótese de que "paciente novo falta mais" é sobre o vínculo com a clínica, e uma
   consulta cancelada não chegou a acontecer.
4. **Duplicados e conflitos do CSV: na dúvida, não importa.** Linhas idênticas viram uma; versões
   conflitantes do mesmo `id` sem como desempatar são descartadas; horário já ocupado fica com a
   consulta marcada primeiro. É melhor perder poucas linhas do que levar ao sistema um dado incerto, e
   todo descarte fica no relatório com o motivo.
5. **O que fazer com pacientes que faltam com frequência: avisar mais, e avisar a recepção.** O sistema
   marca como "faltoso" quem tem pelo menos 1 atendimento e 25% ou mais de faltas nos 5 últimos, e cada
   consulta vira uma pontuação de risco de falta, que aparece na aba Prevenção de Faltas.

## O que foi construído na Parte 2

Uma funcionalidade para reduzir as faltas, que tem como base formar uma comunicação bidirecional com o
paciente, em quatro peças:

- **Risco de falta por consulta.** Uma soma de pontos: histórico de faltas (40), primeira consulta (25),
  convênio (15), segunda-feira de manhã (15) e consulta ainda sem confirmação a menos de 48 h (20).
  De 25 a 49 pontos o risco é média, de 50 a 69 alta, de 70 em diante muito alta.
- **Aba Prevenção de Faltas.** Lista as consultas dos próximos 14 dias com risco média ou maior, com
  filtro por nível, troca de status, envio de confirmação ou lembrete, cópia do telefone e, nas de
  risco muito alta, "Oferecer vaga".
- **Mensagens automáticas por WhatsApp simulado.** Ao criar a consulta, o paciente recebe os dados e um
  link para salvar a consulta no seu Google Calendar; com 72 h ou menos recebe o pedido de confirmação e, com 36 h ou menos, o
  lembrete. O envio é simulado pelo serviço `whatsapp-mock`, que mostra tudo em
  http://localhost:8025.
- **Possibilidade de resposta do paciente.** As mensagens de confirmação e de lembrete oferecem as
  opções "1 - Confirmar", "2 - Remarcar" e "3 - Cancelar" para o paciente responder. (Os efeitos da
  resposta não foram implementados.)

**Para ver funcionando.** Depois de subir o projeto e [importar os dados](#importação-dos-dados), use uma
ação na aba Prevenção de Faltas (por exemplo, "Enviar confirmação") e depois abra http://localhost:8025
para ver as mensagens enviadas.

## Por que escolheu isso?

Pesquisei sobre o assunto e encontrei um estudo sobre o uso de SMS com possibilidade de cancelar:

> SIDES, T.; KBAIER, D. Investigating how the use of technology can reduce missed appointments:
> quantitative case study at a general practitioner surgery. _Journal of Medical Internet Research_,
> v. 26, e43894, 2024.

Depois da implantação do sistema de SMS, as consultas perdidas caíram 42,8% (de 5.848 para 3.343;
P<0,001). Os autores atribuem parte desse efeito ao fato de o sistema permitir que o paciente cancele a
tempo, e é daí que vem a base da funcionalidade: uma comunicação em que o paciente recebe o aviso e
também consegue responder.

Trazendo isso para a realidade do Brasil, decidi usar o WhatsApp no lugar do SMS, já que muitas pessoas
nem olham os SMS.

É um estudo antes-e-depois em uma única clínica do Reino Unido, portanto mais fraco que um ensaio
randomizado. Por isso trato o resultado como um indício, não como uma garantia para a Clínica Vida Plena.

## Qual resultado espera?

Sendo otimista, espero que a funcionalidade reduza mais de 50% das faltas, visto que também é
disponibilizada a possibilidade de reagendar.

## Como saber se funcionou em 3 meses

Na tela Indicadores, compare a taxa de falta dos 3 meses depois do uso da aba e das mensagens com a
dos 3 meses anteriores (a tela já compara com o período anterior de mesmo tamanho). Como referência,
vale 31,7%. Para não confundir com outras causas, olhe também:

- a taxa de segunda de manhã e a de primeira consulta, que são os fatores mais fortes;
- a taxa dos pacientes marcados como faltosos antes e depois;
- quantas consultas de risco alta e muito alta foram confirmadas depois do envio da mensagem.

## O que ficou de fora e os riscos

TODO

## Como usei IA e onde corrigi o que ela gerou

Usei o Claude como IA principal: o Claude Code (CLI) para o código e o Claude Design para idealizar o
front. O fluxo foi sempre o mesmo: gerava o design quando necessário, trazia o objetivo e as
melhorias a fazer, montava a especificação com a IA e a dividia em pequenas tarefas. A IA rodava
lint, build e testes e, depois que tudo passava, eu mesmo revisava o que tinha sido construído.

### Principais contribuições da IA

- **Estrutura do projeto:** `backend/`, `frontend/`, Dockerfiles, `docker-compose.yml`, validação das
  variáveis de ambiente, tratamento central de erros e health check.
- **Importação dos dados:** leitura e padronização do CSV, regras de duplicados, conflitos, descarte e
  correção, gravação em transação e relatório da importação.
- **Testes**
- **Análises e documentação**

### O que precisei corrigir ou decidir diferente

- **Versão do TypeScript:** a IA usou versões diferentes do TypeScript no frontend e no backend. Pedi
  o TypeScript 7 nos dois, para ficarem na mesma versão.
- **Uso de `any`:** a IA usava `any` em várias ações (como o `err` do Express e o `res.json()`).
  Precisei ajustar para o modo `strict`, com a regra de nunca usar `any` garantida pelo lint.

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

## Como rodar os testes

Com o projeto rodando:

```bash
docker compose exec backend npm test
```

## API

Rotas, filtros, paginação e formato de erros: [docs/api.md](docs/api.md).
