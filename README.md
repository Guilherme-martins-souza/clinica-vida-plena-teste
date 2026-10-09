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

Para limpar o banco e rodar a importação rode:

```bash
docker compose exec backend npm run import
```

O comando também refaz a lista de espera: apaga as pessoas dela e grava 3 de exemplo para cada médico.

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
(36,9%) estão bem acima da média de 31,7% (o Dr. Paulo tinha razão). O convênio quase não diferencia (32,0% contra 31,0%).
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
paciente, em cinco peças:

- **Risco de falta por consulta.** Uma soma de pontos, que pode ser verificada como ocorre na própria tela.
  A Juliana não precisa mais ligar para todo mundo, porque todos são avisados por WhatsApp: ela vê
  exatamente para quem ligar, que são os de risco alta ou muito alta que ainda não confirmaram.
- **Aba Prevenção de Faltas.** Lista as consultas dos próximos 14 dias com risco média ou maior, com
  filtro por nível, troca de status, envio de confirmação ou lembrete, cópia do telefone e, em
  qualquer consulta, "Oferecer vaga", que abre a lista de espera do médico para a recepção escolher
  quem avisar: a pessoa recebe o horário por WhatsApp e a conversa é iniciada na hora.
- **Lista de espera.** Resposta à ideia da Dra. Marta (multa e overbooking), sem ser destrutiva: em vez
  de punir quem falta ou marcar dois pacientes no mesmo horário, a vaga que ficaria vazia é oferecida a
  quem está esperando. Tem tela própria para cadastrar as pessoas e alimenta o "Oferecer vaga".
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

## Qual resultado espera? Quantas faltas deve evitar por mês

O estudo citado reduziu as faltas em 42,8%. Além do que o estudo propõe, adicionei o link para salvar a
consulta no Google Calendar e a possibilidade de remarcar, então acredito que a redução possa passar de
50%.

A média da clínica é de 152 faltas por mês (13 meses de dados; o mês com mais faltas teve 185). Metade
disso dá em torno de 75, e é isso que espero evitar por mês.

## Como saber se funcionou em 3 meses

Na tela Indicadores, compare a taxa de falta dos 3 meses depois do uso da aba e das mensagens com a
dos 3 meses anteriores (a tela já compara com o período anterior de mesmo tamanho). Como referência,
vale 31,7%. Para não confundir com outras causas, olhe também:

- a taxa de segunda de manhã e a de primeira consulta, que são os fatores mais fortes;
- a taxa dos pacientes marcados como faltosos antes e depois;
- quantas consultas de risco alta e muito alta foram confirmadas depois do envio da mensagem.

## O que ficou de fora e os riscos

**O que ficou de fora**

- **Efeito das respostas do paciente.** "1 - Confirmar", "2 - Remarcar" e "3 - Cancelar" aparecem nas
  mensagens, mas a resposta ainda não muda a consulta.
- **Multa e overbooking.** Pedidos pela Dra. Marta, ficaram de fora de propósito: a lista de espera
  ocupa a vaga sem punir ninguém nem marcar dois pacientes no mesmo horário.
- **LGPD.** Não há registro de consentimento do paciente para receber mensagens. O sistema guarda nome
  e telefone, e o chip "faltoso" é um rótulo sobre a pessoa, que deve ser usado só pela recepção.

**Riscos**

- **Excesso de mensagens.** Quem tem risco alto pode receber confirmação, lembrete e ofertas, e passar a
  ignorar todas.
- **Dados do CSV.** Linhas duplicadas ou conflitantes foram descartadas, então os indicadores partem de
  um conjunto menor que o original (o relatório da importação mostra quantas).
- **Paciente sem telefone.** Não recebe nenhuma mensagem, e a recepção precisa ligar.

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
- **Pesquisa:** busca de estudos sobre faltas em consultas, que levou à base da funcionalidade (o
  estudo sobre SMS com possibilidade de cancelar).
- **Testes**
- **Análises e documentação**

### O que precisei corrigir ou decidir diferente

- **Versão do TypeScript:** a IA usou versões diferentes do TypeScript no frontend e no backend. Pedi
  o TypeScript 7 nos dois, para ficarem na mesma versão.
- **Uso de `any`:** a IA usava `any` em várias ações (como o `err` do Express e o `res.json()`).
  Precisei ajustar para o modo `strict`, com a regra de nunca usar `any` garantida pelo lint.
- **Mantine em vez das classes CSS do design system:** a IA recomendou usar as classes CSS do design
  system. Decidi reproduzir o visual com o Mantine, usando só os tokens de cor.
- **`tsx` em vez do watch nativo do Node:** a IA recomendou o watch nativo para o reload do backend.
  Escolhi o `tsx`.
- **Conflitos na importação dos dados:** a IA tentou, no início, importar o máximo possível dos
  registros conflitantes do CSV. Pedi para importar só os que tínhamos certeza, e analisei todos os
  cenários existentes um a um.

## Telas

O menu lateral tem dois grupos: **Agendamentos** (Indicadores, Prevenção de Faltas, Agendamentos e Lista de espera) e
**Parametrizações** (Médicos, Pacientes e Importações).

- **Indicadores:** taxa de falta, consultas, faltas por médico, por dia e turno e por antecedência da
  marcação, comparando com o período anterior. O período vem de um atalho (30 dias, 3 meses, 12
  meses) ou de um intervalo personalizado escolhido no calendário.
- **Prevenção de Faltas:** as consultas dos próximos 14 dias com risco de falta média ou maior, com
  filtro por chance de faltar. Cada linha mostra o paciente (com o chip "faltoso", quando for o caso), o
  médico, o horário, o status e a chance de faltar. O botão "Ações" de cada linha abre um menu com
  enviar confirmação, enviar lembrete, copiar contato, oferecer vaga (escolhendo a pessoa da lista de
  espera do médico); cada opção pede confirmação num modal, e as bloqueadas explicam o
  motivo num tooltip. O status é trocado ali mesmo, e o
  banner "Como ler esta lista" explica os chips e a conta do risco.
- **Agendamentos:** abas Hoje, Próximas, Aguardando registro (consultas que já passaram sem resultado)
  e Todas, com busca por paciente e filtros de status, médico e período (este só em Todas). O botão
  "Novo agendamento" abre um painel com médico, paciente, data e os horários livres; o status de cada
  consulta é trocado pelo menu da linha.
- **Lista de espera:** tabela paginada de quem aguarda vaga (nome, telefone, médico, se quer antecipar
  e desde quando). O botão "Adicionar na lista de espera" abre um painel com seletor de paciente,
  médico (opcional) e se a pessoa quer antecipar uma consulta (apenas informativo).
- **Médicos:** os seis médicos com a especialidade e a grade de atendimento.
- **Parametrizações › Pacientes:** pacientes com busca por nome, consultas concluídas, faltas e o chip
  "faltoso".
- **Parametrizações › Importações:** histórico das importações, com o detalhe e as linhas descartadas.
- **WhatsApp simulado** (http://localhost:8025, fora do menu): um chat por número de telefone na barra
  lateral, com busca pelo número; ao clicar, mostra as mensagens daquele paciente. A página se atualiza
  sozinha quando chega mensagem nova e não tem campo de resposta.

## Como rodar os testes

Com o projeto rodando:

```bash
docker compose exec backend npm test
```

## API

Rotas, filtros, paginação e formato de erros: [docs/api.md](docs/api.md).
