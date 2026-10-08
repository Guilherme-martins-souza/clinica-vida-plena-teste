# Decisões

Registro das decisões do projeto: o que foi escolhido, por quê e o que se perde com isso.
Novas decisões entram no fim, numeradas.

## 1. Estrutura inicial (06/10/2026)

### D1. Tudo roda pelo Docker Compose

- **Decisão:** `docker compose up` instala as dependências e sobe Mongo, backend e frontend. A importação de `data/`, quando existir, também rodará por ele. Não há fluxo documentado fora do Docker.
- **Por quê:** o desafio exige subir com um único comando, e quem avalia não precisa ter Node nem Mongo instalados.
- **Custo:** depender do Docker até para rodar testes (`docker compose exec backend npm test`).

### D2. Node.js 24 LTS com a versão exata fixada

- **Decisão:** `node:24.21.0-alpine` nos dois Dockerfiles.
- **Por quê:** o 24 é o LTS ativo. A tag exata evita que o projeto mude sozinho quando a imagem for atualizada.

### D3. MongoDB 7.0 em vez do 8.x

- **Decisão:** `mongo:7.0.43`.
- **Por quê:** as versões 8.x e 9.x se recusam a iniciar em kernels Linux 6.19 até 7.0.13 ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)), e a máquina de desenvolvimento usa o kernel 7.0.0. A 7.0 funciona em qualquer kernel e é suportada pelo Mongoose 9.
- **Custo:** ficamos sem os recursos novos do 8.x, que o projeto não usa.

### D4. tsx para o reload do backend em desenvolvimento

- **Decisão:** `tsx watch src/server.ts`, com o `tsc` usado só no build.
- **Alternativa descartada:** `node --watch` com a execução nativa de TypeScript do Node 24, que não precisaria de nenhuma dependência. Ela exige imports com extensão `.ts` e proíbe `enum`.
- **Custo:** o tsx não checa tipos. Erros de tipo só aparecem no `npm run build`.

### D5. O backend em CommonJS

- **Decisão:** o `package.json` do backend não tem `"type": "module"`.
- **Por quê:** em ESM, o TypeScript exige imports terminando em `.js`. Em CommonJS, os imports ficam sem extensão, o que é mais simples de ler.

### D6. `app.ts` separado de `server.ts`

- **Decisão:** `app.ts` monta o Express sem dar `listen` e sem ler variáveis de ambiente. `server.ts` conecta no Mongo e sobe o servidor.
- **Por quê:** os testes usam o `app` direto com o Supertest, sem banco e sem variáveis de ambiente.

### D7. Formato único de erro no backend

- **Decisão:** toda resposta de erro segue `{ error: { code, message } }`. As rotas lançam `HttpError(status, code, message)`, e um middleware central converte o erro em JSON. Erro inesperado vira 500 `INTERNAL_ERROR`, e o detalhe vai só para o log.
- **Por quê:** o frontend trata qualquer erro da mesma forma, e o desafio pede "erro claro" nas transições inválidas.

### D8. Variáveis de ambiente definidas no compose e validadas com Zod

- **Decisão:** os valores ficam no `docker-compose.yml`, sem dotenv. O `src/config/env.ts` valida esses valores na inicialização e encerra o backend com uma mensagem clara se faltar algo. O `.env.example` só documenta as variáveis.
- **Por quê:** `docker compose up` funciona sem criar arquivo `.env`, e um erro de configuração aparece na hora em que o backend sobe, não no meio de uma requisição.

### D9. `node_modules` dentro do container

- **Decisão:** o código é montado por volume, e `/app/node_modules` fica num volume anônimo.
- **Por quê:** o container usa as dependências instaladas no Linux Alpine, e não as do host.
- **Custo:** quando uma dependência muda, é preciso rodar `docker compose up --build --renew-anon-volumes`.

### D10. Proxy do Vite para `/api`

- **Decisão:** o front chama `/api/...` sem porta, e o Vite repassa a chamada para `API_PROXY_TARGET` (`http://backend:3000` dentro do Docker).
- **Por quê:** frontend e backend parecem estar na mesma origem para o navegador, então não é preciso configurar CORS.

### D11. TypeScript 7 no backend e no frontend

- **Decisão:** a mesma versão nos dois. O template do Vite vinha com o TypeScript 6.
- **Por quê:** é a preferência do usuário. Nada no frontend depende da API JavaScript do TypeScript, e o TS 7 suporta o `tsc -b` que o build do template usa.

### D12. Strict e proibição de `any`

- **Decisão:** `strict: true` em todos os tsconfigs. O oxlint, no backend e no frontend, trata a regra `no-explicit-any` como erro. Quando uma biblioteca devolve `any` (o `err` do Express, o `res.json()`), o valor é tipado como `unknown` e verificado antes de ser usado.
- **Por quê:** com `any` o TypeScript deixa de checar o código, e a regra só escrita não garante nada sem o lint.

## 2. Layout base e tela de Indicadores com dados mockados (07/10/2026)

### D13. Visual em Mantine, seguindo o design system da clínica

- **Decisão:** o design system (`vida-plena-design-system/`) é reproduzido com componentes do Mantine (AppShell, Card, SegmentedControl, Table, Badge, Select, EmptyState). As cores do design system ficam em `frontend/src/theme/tokens.css` e o `cssVariablesResolver` do tema liga as variáveis internas do Mantine a elas. O que o Mantine não tem (barras e mapa de calor) é componente próprio com CSS Modules.
- **Alternativa descartada:** usar as classes `vp-*` do `bundle.css` direto, que deixaria o visual idêntico às prévias, mas com duas formas de estilizar no projeto.
- **Custo:** alguns detalhes precisam sobrescrever estilos do Mantine (ex.: variáveis do Badge pela prop `vars`).

### D14. Medidas em rem e pontos de quebra do design system

- **Decisão:** espaçamentos, raios e fontes do tema em rem. Os breakpoints do Mantine foram ajustados para os do design system: `sm` = 720px (menu só com ícones) e `md` = 1080px (grades com menos colunas). Os números grandes e a grade de calor usam `clamp()`.
- **Por quê:** rem acompanha o zoom e o tamanho de fonte do navegador; os breakpoints iguais aos do design system evitam valores soltos no código.

### D15. React Router com o AppShell como rota de layout

- **Decisão:** `createBrowserRouter` com o `AppShellLayout` na rota `/` renderizando um `<Outlet />`. `/` redireciona para `/indicadores`. Médicos e Importações mostram a tela "em construção".
- **Por quê:** o menu, a trilha e o destaque do item ativo saem da URL, e cada tela nova é só uma rota filha.

### D16. Mock atrás das mesmas funções que buscarão a API

- **Decisão:** a tela usa TanStack Query chamando `fetchIndicadores` e `fetchAgendamentos` (`frontend/src/api/indicadores.ts`). Hoje elas devolvem os mocks de `src/api/mocks/` com 300 ms de atraso; os tipos em `src/api/types.ts` descrevem o formato esperado da API.
- **Por quê:** tirar o mock é trocar o corpo dessas funções por `fetch`, sem mexer nos componentes. O atraso faz o estado de "carregando" já existir.
- **Detalhe:** o mock traz contagens (faltas, consultas concluídas) e as taxas são calculadas na tela, como deve acontecer com os dados reais.

### D17. Ícones com lucide-react e fonte Figtree local

- **Decisão:** `lucide-react` para os ícones e `@fontsource-variable/figtree` para a fonte, como pede o design system.
- **Por quê:** a fonte local não depende do Google Fonts; os ícones seguem a mesma grade usada nas prévias.

### D18. Período da tela de Indicadores na URL

- **Decisão:** o atalho escolhido fica em `?periodo=30d|3m|12m`. O intervalo é calculado terminando hoje.
- **Resolvido em D50:** "Personalizado" abre um seletor de datas.

### D19. Filtro Hoje / Todos na tabela de agendamentos

- **Decisão:** um controle segmentado "Hoje | Todos" na barra da tabela, com "Hoje" selecionado por padrão. "Hoje" lista só as consultas do dia (fuso America/Sao_Paulo); "Todos", as do período escolhido no topo da página. O filtro vai junto para `fetchAgendamentos` (`quando: 'hoje' | 'todos'`), para o servidor fazer o corte quando a API existir.
- **Por quê:** a recepção abre o sistema para ver a agenda do dia; o histórico completo fica a um clique.
- **Detalhe:** as datas do mock de agendamentos passaram a ser relativas a hoje, para o filtro "Hoje" sempre ter linhas.

### D20. Prettier para formatar o código

- **Decisão:** Prettier como dependência de desenvolvimento no frontend e no backend, com `npm run format` e `npm run format:check`. Cada pasta tem seu `.prettierrc.json`: 2 espaços, aspas simples, até 120 colunas; o frontend sem ponto e vírgula e o backend com, mantendo o estilo que cada um já tinha.
- **Por quê:** todo arquivo escrito precisa sair indentado e no mesmo padrão, sem depender do editor de quem mexe.
- **Detalhe:** `vida-plena-design-system/` foi para o `.gitignore`: é só a referência de design, o código não importa nada de lá.

### D21. Versão mobile (abaixo de 720px)

- **Decisão:** no celular o menu lateral some (nem o trilho de ícones fica). A logo vai para a barra superior, ao lado do botão do menu; tocar em qualquer um dos dois abre o menu inteiro **por cima** da tela, com fundo escurecido, sem empurrar o conteúdo. Fecha ao escolher uma tela, tocar no fundo ou apertar Esc. Usa o modo mobile do próprio `AppShell` do Mantine (`breakpoint: 'sm'`, `collapsed.mobile`).
- **Por quê:** antes, no celular, o menu não expandia, e tocar no ícone de um grupo levava direto para a primeira tela dele (Importações ficava inacessível pelo menu). Sem o trilho, o conteúdo ganha os 64px da largura.
- **Detalhe:** o filtro de período vira uma lista (os quatro atalhos não cabiam e faziam a página rolar na horizontal), com o botão do intervalo embaixo. Nas barras, o nome do médico vai para a linha de cima, para não ser cortado. A trilha (Agendamentos / Indicadores) some da barra superior, porque o título da página já diz onde se está.

### D22. Rodapé

- **Decisão:** rodapé discreto no fim da área de conteúdo, com "© <ano> Clínica Vida Plena. Todos os direitos reservados." centralizado, em texto pequeno e `ink-muted`. Não é fixo na tela: fica no fim da página (e no fim da tela em páginas curtas).

## 3. Decisões da Parte 1 do desafio (07/10/2026)

### D23. Cancelamento do paciente com menos de 24 h conta como falta

- **Decisão:** um cancelamento `cancelada_paciente` registrado menos de 24 horas antes do horário da consulta conta como falta nos indicadores. O status continua `cancelada_paciente`; a regra é aplicada no cálculo. Cancelamento da clínica nunca conta como falta.
- **Por quê:** o horário cancelado em cima da hora dificilmente é reaproveitado, e o efeito para a clínica é o mesmo da falta. A clínica cancelar não é responsabilidade do paciente.
- **Custo:** a consulta precisa guardar quando foi cancelada. O CSV não tem essa data, então os cancelamentos do histórico ficam como cancelamento e só os registrados pelo sistema novo podem virar falta.

### D24. Cancelamentos com antecedência ficam fora da taxa de falta

- **Decisão:** taxa de falta = faltas ÷ (realizadas + faltas). Cancelamentos com 24 h ou mais de antecedência não entram no cálculo; os de menos de 24 h entram como falta (D23). No exemplo do enunciado (10 consultas, 2 faltas, 2 cancelamentos), a taxa é 2 de 8 = 25%.
- **Por quê:** a taxa mede quem tinha consulta de pé e não veio. O horário cancelado com antecedência foi liberado e pode ser reaproveitado; contá-lo no denominador diluiria a falta.

### D25. "Primeira consulta" é a primeira do paciente na clínica

- **Decisão:** é primeira consulta a de menor data entre as consultas não canceladas do paciente, com qualquer médico. (O "não canceladas" foi acrescentado na conclusão da Parte 1.)
- **Por quê:** a hipótese do Dr. Paulo ("paciente novo falta muito mais") é sobre o vínculo com a clínica, não com um médico específico.

### D26. Duplicados e conflitos no CSV: na dúvida, não importa

- **Decisão:** linhas idênticas viram uma só. Mesmo `id` com status diferente: todas as versões são descartadas. Mesmo `id` com horário diferente: fica a versão cujo horário está livre na agenda do médico; sem como desempatar, todas são descartadas. Todo descarte vai para o relatório e para o CSV de descartes, com o motivo.
- **Por quê:** é melhor perder poucas linhas (39 de 7.359) do que levar para o sistema um dado que não se sabe se está certo.
- **Pendente:** decisão provisória, a revisar. Detalhes e as demais regras da importação em `.specs/features/banco-e-importacao/context.md`.

## 4. Banco de dados, validação e importação (07/10/2026)

### D27. MongoDB como replica set de um nó

- **Decisão:** o MongoDB do compose roda com `--replSet rs0`. O healthcheck inicia o replica set na primeira subida e só fica `healthy` quando o nó vira primário. A importação grava tudo numa transação (`session.withTransaction`).
- **Por quê:** o MongoDB só aceita transações em replica set. Com a transação, uma importação que falha no meio não deixa o banco pela metade (é o mesmo conceito do `DB::transaction` do Laravel). A tela de agendamento também vai precisar disso.
- **Custo:** ferramentas na máquina (Compass, mongosh) precisam de `directConnection=true` na URL, porque o replica set anuncia o host `mongo`, que só existe dentro do Docker. Está no README.

### D28. `csv-parse` para ler o CSV

- **Decisão:** o `agendamentos.csv` é lido com `csv-parse@7.0.2` (modo síncrono), com a versão exata fixada.
- **Por quê:** escolha minha. Ler CSV "na mão" com `split(',')` quebra com aspas e vírgulas dentro de campos. A biblioteca não tem dependências próprias.

### D29. Fuso fixo de São Paulo (−03:00)

- **Decisão:** toda data do CSV é lida como horário de São Paulo, com o deslocamento fixo `-03:00` (constante `OFFSET_SAO_PAULO`, em `normalizar.ts`).
- **Por quê:** o Brasil não tem horário de verão desde 2019, e o deslocamento fixo é simples de entender e testar.
- **Custo:** se o horário de verão voltar, horários dentro dele ficam uma hora errados. A constante é única para facilitar a troca.

### D30. "Passado" e "futuro" pela data da exportação

- **Decisão:** na importação, "passado" e "futuro" são julgados pela data de referência: o maior `data_agendamento` do arquivo (24/09/2026 17:42), nunca pelo relógio.
- **Por quê:** o mesmo arquivo gera sempre o mesmo resultado, em qualquer dia que rodar. Depois de importadas, as consultas seguem o relógio real.

### D31. Quando a importação roda

- **Decisão:** a importação roda sozinha ao subir o backend, só se ainda não existe uma importação concluída. Para importar de novo, `docker compose exec backend npm run import` apaga médicos, pacientes e consultas e importa do zero; o histórico de importações fica.
- **Por quê:** o enunciado pede que tudo suba com `docker compose up`, sem passo manual. Rodar em toda subida apagaria o que foi criado pelo sistema.
- **Detalhe:** só uma importação roda por vez (índice único parcial em `situacao: 'em_andamento'`). Se o backend cair no meio, a importação presa é marcada como `falhou` ("Importação interrompida") na próxima subida. A importação não roda ao subir: é o comando `npm run import` (o enunciado pede "um comando").

### D32. Status do CSV

- **Decisão:** sinônimos claros viram o status oficial e contam como corrigidos (`atendido` → `realizada`, `faltou`/`no_show`/`ausente` → `falta`, `desmarcou` → `cancelada_paciente` etc.). `cancelado` sem dizer quem cancelou vira `cancelada_clinica`. Status vazio no passado é descartado; no futuro vira `agendada`. Status fora da lista é descartado.
- **Por quê:** `cancelada_paciente` só quando há certeza de que foi o paciente: se a clínica cobrar cancelamento em cima da hora, ninguém é cobrado por engano. As passadas sem status provavelmente nunca aconteceram.

### D33. Linhas que quebram as regras da agenda

- **Decisão:**
  - dois pacientes no mesmo horário do mesmo médico: as duas consultas entram e o horário vai como aviso no relatório (82 horários);
  - fora da grade do médico (sábados, 06:00, 19:30): descartadas (18);
  - data de marcação depois da consulta: a consulta entra sem data de marcação e conta como corrigida (10);
  - consulta futura já `realizada` ou `falta`: descartada (12);
  - consulta passada ainda `agendada` ou `confirmada`: descartada (69).
- **Por quê:** a regra geral é "na dúvida, não importa". Os horários duplos são registros verdadeiros (a recepção encaixou outro paciente no horário de quem faltou). Importar uma consulta passada sem resultado como `realizada` seria inventar presença e baixaria a taxa de falta.

### D34. Relatório da importação

- **Decisão:** cada importação fica num documento da coleção `importacoes`, com os totais, as contagens por motivo e por correção, os horários duplos e as linhas descartadas (as 9 colunas como vieram). Também sai um resumo no terminal e dois arquivos em `data/relatorios/` (JSON e CSV de descartes). Os arquivos são gravados também quando a importação falha. O CSV baixado pela tela é gerado do banco a cada pedido.
- **Por quê:** a tela lê tudo numa chamada (cerca de 80 KB). Gerar o CSV do banco faz o download funcionar mesmo que o arquivo em disco seja apagado. O relatório de uma falha é justamente o que ajuda a entender o que deu errado.

### D35. "Corrigidas" são 4.612, não 4.611

- **Decisão:** com os arquivos atuais, o relatório aponta 4.612 linhas corrigidas. A spec dizia 4.611 e foi corrigida.
- **Por quê:** a linha 7326 (`AG07260`) tem só a correção `status_vazio_futuro` (status vazio numa consulta futura, que vira `agendada`). A regra da spec conta como corrigida toda linha importada com pelo menos uma correção da lista, e `status_vazio_futuro` está na lista. O número 4.611 deixava essa linha de fora. A IA encontrou a contradição entre as duas partes da spec e eu escolhi manter a regra e corrigir o número.

### D36. Detalhes das regras decididos na implementação

- **Grade:** a consulta precisa **terminar** até o fim da grade. Se a grade termina às 12:00, a consulta das 12:00 fica fora; a última é a das 11:30.
- **Conflitos:** linhas com o mesmo `id` são comparadas pelo status **como veio** no arquivo (antes de padronizar). `faltou` e `falta` no mesmo `id` contam como status diferentes.
- **Telefone do paciente:** vale o da consulta mais recente que tem telefone válido; se duas consultas têm o mesmo horário, fica a linha mais abaixo no arquivo.
- **Nome do paciente:** a grafia mais frequente entre as linhas dele, sem espaços extras; no empate, a que não está toda em maiúsculas e, depois, a que aparece primeiro.
- **Referências da consulta:** antes de gravar, o sistema confere se o médico e o paciente existem. A mensagem junta os dois problemas: "Médico inexistente: X; Paciente inexistente: Y".

### D37. Tela Importações

- **Decisão:** a tela lista as importações (a mais recente primeiro) e abre um detalhe por importação em `/importacoes/:id`, com os totais, as barras de descartes por motivo e de correções por tipo, o aviso dos horários duplos e a tabela das linhas descartadas, com filtro por motivo e download do CSV. A trilha do detalhe ("Importações / data e hora") fica dentro da página; a barra superior continua mostrando "Parametrizações / Importações".
- **Detalhe:** a situação da importação usa um selo próprio (`SituacaoBadge`), no mesmo estilo do `StatusBadge` (ponto e palavra), porque o `StatusBadge` é só para status de consulta. O `BarList` ganhou a opção `formatValue` para mostrar contagens em vez de taxas. O frontend não tem testes automatizados (escolha minha): a conferência é lint, build e navegador (desktop, 360 px e tema escuro).

### D38. Listas paginadas no backend

- **Decisão:** toda lista da API é paginada no backend: `?pagina=1&porPagina=10`, resposta `{ itens, total, pagina, porPagina }`, 10 por página por padrão e no máximo 100 (`backend/src/paginacao.ts`). Virou regra no `CLAUDE.md`. As linhas descartadas saem do detalhe da importação e vêm de `GET /api/importacoes/:id/descartes` (com `?motivo=`), que a tela pede de 30 em 30. Isto substitui a parte da D34 em que a tela lia tudo numa chamada.
- **Por quê:** pedido meu. A tela não precisa carregar as 206 linhas para mostrar 30, e o padrão vale para as próximas listas (agenda, pacientes). As linhas ficam num array dentro da importação, então o filtro e o corte da página são feitos no Mongo (`$filter` e `$slice`).
- **Resolvido em D43:** `GET /api/importacoes` também é paginada.

### D39. Lista de importações: aviso e coluna Ações

- **Decisão:** a lista ganhou um aviso ("Clique em uma importação para visualizar detalhes"), no mesmo cartão do aviso dos horários duplos (componente `AvisoCard`, com tom de atenção ou de informação), e uma última coluna "Ações" com o botão "Ver detalhes". A linha inteira continua clicável; o link da data e o botão não deixam o clique subir para a linha, para não gravar duas entradas iguais no histórico do navegador.

### D40. Horário do médico já ocupado: a consulta marcada depois é descartada

- **Decisão:** quando o médico tem duas ou mais consultas ativas (não canceladas) no mesmo slot, a importação grava a marcada primeiro e descarta as outras com o motivo `horario_ocupado` ("Horário ocupado (possível encaixe)" na tela). A ordem vem da data de marcação; se alguma não tiver essa data, vale a ordem do arquivo, porque os ids do sistema antigo são sequenciais. O detalhe da importação mostra um aviso informativo explicando esses descartes.
- **Por quê:** o enunciado diz que um médico não pode ter duas consultas no mesmo slot, e a criação de consultas vai seguir a mesma regra (D41, D42). Nos 82 casos do arquivo são dois pacientes diferentes; a 1ª marcação sempre terminou em falta e a 2ª foi marcada perto do horário (encaixe). Ficam 7.071 consultas importadas e 288 descartadas; somem 74 consultas realizadas e 8 faltas (as segundas), e 9 pacientes que só tinham essa consulta.
- **Antes:** a primeira versão gravava as duas e marcava a segunda com um campo `encaixe`; foi trocada por esta, a pedido, no mesmo dia.
- **Caso 58 (AG05281):** a data de marcação veio 5 dias depois da consulta, no mesmo horário (igual às outras 9 linhas com `data_agendamento_invalida`, sempre dias inteiros depois, mesmo horário: defeito do sistema antigo). Pelos ids vizinhos (AG05280 e AG05282, marcados em 16/06/2026 ~14h), ela foi marcada em 16/06, antes da AG05531 (29/06). A regra pela ordem do arquivo chega à mesma resposta: fica a AG05281 e a AG05531 é descartada.

### D41. Horário ocupado ao criar consulta (regra da spec de agendamento)

- **Decisão:** criar consulta recusa o horário quando o médico já tem consulta não cancelada no mesmo slot, ou quando o paciente já tem consulta não cancelada no mesmo horário. Consulta cancelada libera o horário. A checagem fica no backend, e não num índice único do banco.
- **Por quê:** é a regra do enunciado. Um índice único bloquearia os 82 encaixes do histórico (D40) e as consultas canceladas no mesmo horário.

### D42. A importação usa o mesmo método de criação do agendamento

- **Decisão:** quando existir o `create` da spec de agendamento, a importação grava as consultas por ele, para que as duas sigam as mesmas regras.
- **Resolvido em D43:** em vez de passar pelo `create`, a importação e a criação usam as mesmas regras de agenda (`backend/src/consultas/regras.ts`).

## 5. Conclusão da Parte 1 (08/10/2026)

### D43. Regras de agenda comuns à criação e à importação

- **Decisão:** as regras de agenda ficam em `backend/src/consultas/regras.ts` (início num slot de 30 min, dentro da grade do médico, horário ocupado do médico e do paciente) e são usadas pela criação de consultas e pela importação. A importação continua gravando em lote, numa transação. Ela passou a descartar também o mesmo paciente no mesmo horário como `horario_ocupado`. `GET /api/importacoes` passou a ser paginada (fecha a pendência da D38).
- **Por quê:** escolha minha, em vez de um "modo histórico" no `create`: a importação traz datas passadas e status finais que a criação deve recusar, e gravar 7 mil linhas uma a uma seria lento. Com as regras num lugar só, as duas não divergem (fecha a D42).
- **Detalhe:** o CSV não tem nenhum caso de paciente duplicado no mesmo horário; os números continuam 7.071 importadas e 288 descartadas.

### D44. Serviços recebem `agora` por parâmetro

- **Decisão:** criação, troca de status, abas, horários e indicadores recebem o instante atual como parâmetro; só a rota lê o relógio.
- **Por quê:** os testes passam o "agora" que quiserem, sem fake timers.

### D45. Duas pessoas marcando o mesmo horário ao mesmo tempo

- **Decisão:** dentro da transação da criação, a consulta faz `$inc` num campo `versaoAgenda` do médico e do paciente antes de checar o horário. Duas criações simultâneas para o mesmo médico ou paciente entram em conflito no Mongo, e a segunda refaz a checagem e recebe 409 `HORARIO_OCUPADO`.
- **Por quê:** a checagem de horário ocupado (D41) é feita no backend, e sem trava duas requisições podiam passar juntas. É a mesma ideia do `lockForUpdate` do Laravel.
- **Detalhe:** o campo não tem valor padrão no schema; nasce no primeiro `$inc`, para não mudar os documentos importados.

### D46. Troca de status

- **Decisão:** a troca usa `findOneAndUpdate` com o status atual na condição; se outra requisição mudou o status antes, responde 409 `STATUS_ALTERADO`. Confirmar só vale antes do horário da consulta; a partir do horário de início valem realizada e falta, e não dá mais para cancelar. Todo cancelamento grava `canceladaEm`, que a regra da D23 usa.
- **Por quê:** duas pessoas na recepção podem mexer na mesma consulta; a segunda recebe um erro claro em vez de sobrescrever a primeira.

### D47. Códigos de erro da agenda

- **Decisão:**
  - 400 `DADOS_INVALIDOS`, `FILTRO_INVALIDO`, `PERIODO_INVALIDO` (também `inicio` sem fuso);
  - 404 `MEDICO_NAO_ENCONTRADO`, `PACIENTE_NAO_ENCONTRADO`, `CONSULTA_NAO_ENCONTRADA`;
  - 422 `FORA_DO_SLOT`, `FORA_DA_GRADE`, `HORARIO_PASSADO`, `TRANSICAO_INVALIDA`, `ANTES_DO_HORARIO`, `DEPOIS_DO_HORARIO`;
  - 409 `HORARIO_OCUPADO`, `STATUS_ALTERADO`.
- **Por quê:** o `code` permite à tela mostrar o erro no campo certo do painel Novo agendamento (D51), sem interpretar a mensagem.

### D48. Abas da tela Agendamentos

- **Decisão:** Hoje (o dia em São Paulo), Próximas (a partir de agora, agendada ou confirmada), Aguardando registro (já passaram, ainda agendada ou confirmada) e Todas. Sem `aba`, a API devolve todas. Hoje e Próximas em ordem crescente; Aguardando e Todas, decrescente. O filtro de período só existe em Todas, e começa sem período (botão "Qualquer data"). A busca por nome ignora acentos e maiúsculas. O ID mostrado é o `codigoLegado` ou os 6 últimos caracteres do `_id` (ex.: `#4901a3`).
- **Por quê:** "Aguardando registro" separa as consultas que a recepção ainda precisa marcar como realizada ou falta, sem misturá-las com as próximas.

### D49. Horários livres do médico

- **Decisão:** `GET /api/medicos/:id/horarios?data=` devolve os slots de 30 min da grade do dia com `livre`, `ocupado` ou `passado` (passado vence ocupado) e `proximoDiaComVaga`, procurado nos 60 dias seguintes.
- **Por quê:** o painel de novo agendamento mostra só o que dá para marcar e sugere outro dia quando o escolhido está cheio.

### D50. Indicadores calculados em TypeScript

- **Decisão:** a API busca as consultas do período e calcula os indicadores em TypeScript, não numa agregação do Mongo. O cancelamento tardio do paciente (D23) conta em faltas e não em cancelamentos. O card "Consultas agendadas" (antes "Próximas consultas") conta as consultas agendadas e confirmadas do período selecionado, ou seja, as que ainda não foram finalizadas; o "i" do card lista as finalizações (realizada, falta, cancelada pelo paciente ou pela clínica). O período anterior tem o mesmo número de dias (taxa em % sem arredondar; `null` sem dados). Dia × turno vem em contagens (manhã antes das 12:00); antecedência em faixas 0–7, 8–14, 15–21 e 22+ dias (sem data de marcação fica fora). A tela calcula as taxas e mostra "—" sem dados (`BarList` com `semDados`, `HeatGrid` com `null`).
- **Por quê:** a regra da D23 fica legível e testável sem banco. São poucos milhares de consultas, então o custo é pequeno.
- **Detalhe:** de out/2025 a set/2026, 1.944 faltas em 6.149 consultas concluídas = 31,6% (período anterior: 34,3%). O período personalizado usa `@mantine/dates` com `dayjs` (pt-br): um `Popover` com `DatePicker type="range"` abre no botão do intervalo, a URL fica `?periodo=personalizado&de=&ate=` e os fins de semana não ficam em vermelho (`weekendDays: []`). Fecha a pendência da D18.

### D51. Avisos, menu de status e erros no formulário

- **Decisão:** avisos com `@mantine/notifications` (`components/avisos.tsx`): sucesso some em 3 s, erro fica até ser fechado. O menu de status usa o `Menu` do Mantine; `lib/transicoes.ts` repete a tabela de transições só para montar o menu, e quem decide é o servidor. Depois de trocar o status, com sucesso ou erro, a lista recarrega. No painel Novo agendamento, o `code` do erro da API vira erro no campo certo.
- **Por quê:** a tela nunca fica com um status que o servidor não aceitou, e o usuário vê onde está o problema.

### D52. Pacientes com histórico de faltas

- **Decisão:** `GET /api/pacientes` traz `concluidas`, `faltas` e `primeiraConsulta`. O painel de novo agendamento mostra a etiqueta "1ª consulta" quando o paciente ainda não tem consulta.
- **Por quê:** pedido meu: a recepção vê o histórico na hora de marcar, o que prepara a pergunta 5.

### D53. Telas novas e limpeza

- **Decisão:** telas Agendamentos (com a referência visual `vida-plena-agendamentos`; a tabela saiu da tela de Indicadores), Médicos (grade agrupada) e Pacientes (em Parametrizações). O CSS de tabela é compartilhado em `components/DataTable.module.css`. Os mocks e a tela "em construção" foram removidos (D16 e D15 ficam só como histórico).

### D54. Bancos de teste apagados

- **Decisão:** `desconectar()` apaga o banco do arquivo de teste, e um `globalSetup` (`backend/vitest.config.mts`) apaga as sobras `clinica_test*` antes e depois da execução.
- **Por quê:** cada execução criava bancos novos, que ficavam acumulados no Mongo.

### D55. Tela de médicos com o mesmo cabeçalho e busca dos pacientes

- **Decisão:** a lista de médicos fica num card com título, total e campo de busca por nome (`?busca=` em `GET /api/medicos`, mesma `regexDeBusca` dos pacientes).
- **Por quê:** manter as duas telas iguais; a busca no servidor funciona com a lista paginada.

## 6. Prevenção de faltas (08/10/2026)

### D56. Campo `consideradoFalta` na consulta

- **Decisão:** a consulta ganhou o campo booleano `consideradoFalta` (padrão `false`), que vale `true` quando o status é `falta` ou quando o paciente cancelou a menos de 24 h do início (D23). Ele é gravado na criação, na troca de status e na importação, pela função `calcularConsideradoFalta` (`backend/src/consultas/considerado-falta.ts`). Indicadores, tabela de pacientes, risco e chip "faltoso" só leem o campo e não recalculam a regra. Não existe um segundo campo "cancelou em menos de 24 horas": cancelada pelo paciente com `consideradoFalta = true` já é o cancelamento tardio, e `canceladaEm` guarda quando foi.
- **Por quê:** antes, cada lugar refazia a conta do cancelamento tardio, e os números podiam se contradizer. Com um campo só, a contagem é a mesma em todas as telas. Dois campos poderiam divergir.
- **Custo:** o CSV não traz a data do cancelamento, então os 306 `cancelada_paciente` importados ficam com `consideradoFalta = false` e os totais dos indicadores não mudam (1.978 faltas, 4.270 realizadas). Só cancelamentos feitos pelo sistema novo podem virar falta. Não há migração: quem já tinha o banco precisa rodar `docker compose exec backend npm run import` de novo.

### D57. Risco de falta por pontos, calculado na hora

- **Decisão:** o risco de cada consulta é uma soma de pontos por fator (`calcularRisco`, função pura em `backend/src/risco/calcular-risco.ts`), com pesos e cortes numa lista única em `backend/src/risco/pesos.ts`. Nada é guardado no banco: o risco é calculado a cada chamada, com o histórico do paciente anterior ao início da consulta (`realizada` + `consideradoFalta`). A tela lê pesos e cortes de `GET /api/prevencao-de-faltas/regras`, então o banner não repete números.

  | Fator                                                                           | Pontos |
  | ------------------------------------------------------------------------------- | ------ |
  | 2 ou mais faltas, ou taxa de faltas acima de 30% (com pelo menos 1 atendimento) | 40     |
  | Primeira consulta na clínica                                                    | 25     |
  | Atendimento por convênio                                                        | 15     |
  | Segunda-feira antes de 12:00 (São Paulo)                                        | 15     |
  | Faltam menos de 48 h e a consulta está `agendada` (sem confirmação)             | 20     |

  Cortes: de 0 a 24 baixo (não aparece na aba); de 25 a 49 média; de 50 a 69 alta; 70 ou mais muito alta.

- **Por quê:** é simples e explicável (nada de aprendizado de máquina), e a recepção vê quais fatores somaram. Calcular na hora evita um campo que ficaria velho quando o histórico, o status ou o relógio mudam.
- **Custo:** a aba busca as consultas dos 14 dias e corta a página em memória, o que serve para poucas centenas de consultas. Os pesos são um palpite informado, não um modelo treinado.

### D58. Pesos conferidos nos dados reais

- **Decisão:** os pesos da D57 foram comparados com a taxa de falta de cada recorte nas 6.248 consultas concluídas (realizadas + faltas; taxa geral de 31,7%, 1.978 faltas). Para cada consulta, o histórico e a "primeira consulta" foram calculados só com o que existia antes dela. Nenhum peso foi alterado.

  | Fator                                      | Com o fator            | Sem o fator            |
  | ------------------------------------------ | ---------------------- | ---------------------- |
  | Histórico (2+ faltas ou taxa acima de 30%) | 34,1% (871 de 2.554)   | 30,0% (1.107 de 3.694) |
  | Primeira consulta                          | 36,9% (558 de 1.514)   | 30,0% (1.420 de 4.734) |
  | Convênio                                   | 32,0% (1.296 de 4.045) | 31,0% (682 de 2.203)   |
  | Segunda-feira de manhã                     | 46,9% (306 de 653)     | 29,9% (1.672 de 5.595) |
  | Marcada com menos de 48 h de antecedência  | 8,8% (88 de 995)       | 36,0% (1.890 de 5.253) |

- **Por quê:** segunda de manhã é o fator mais forte (17 pontos percentuais acima do resto), seguido de primeira consulta (7 pontos) e histórico (4 pontos). O convênio quase não diferencia (1 ponto): ficou com o menor peso, mas segue na conta porque os pesos são um palpite a revisar, não um achado dos dados. Mudar um peso exigiria alterar spec, testes e banner, e a diferença não justificou. O fator "sem confirmação a menos de 48 h" não pode ser medido no histórico, porque o CSV não guarda a confirmação; a coluna acima mede a antecedência da marcação, que é outra coisa (consultas marcadas em cima da hora quase não faltam). Esse fator ficou como regra de negócio: consulta que ainda não foi confirmada perto do horário merece contato.
- **Custo:** o peso do histórico (40) é o maior apesar de a diferença nos dados ser modesta (4 pontos percentuais): ele foi definido na spec, e a conta mede só o histórico anterior a cada consulta. Convênio tem pouco apoio nos dados. Os números saíram do banco depois da importação e conferem com `GET /api/indicadores` (por exemplo, convênio 1.296 de 4.045 e primeira consulta 558 de 1.514).

### D59. Paciente "faltoso"

- **Decisão:** o paciente é faltoso quando tem pelo menos 1 atendimento e 25% ou mais de faltas nos 5 últimos. Contam como atendimento só as consultas `realizada` ou `consideradoFalta = true` com início antes de agora, do mais recente para o mais antigo (`ehFaltoso`, em `backend/src/historico/historico.ts`). Um atendimento com falta vale 100% e marca faltoso; sem atendimento, não é faltoso. A API devolve `faltoso` nos pacientes, nas consultas e na aba, e o chip "faltoso" aparece nas tabelas de pacientes e de agendamentos.
- **Por quê:** é a mesma regra dos indicadores (D23 e D24), então o chip não contradiz os números. Olhar só os 5 últimos faz o paciente que melhorou sair da lista.
- **Custo:** quem só tem uma falta e nenhum outro atendimento é marcado; isso foi aceito para a recepção ter atenção também com pacientes novos que faltaram.

### D60. Mensagens por WhatsApp simulado e limite de 3 envios por tipo

- **Decisão:** são quatro mensagens, todas começando por "Clínica Vida Plena": 1 (consulta criada, com o link do Google Calendar e o aviso de cancelamento com 24 h de antecedência), 2 (pedido de confirmação, quando faltam 72 h ou menos), 3 (lembrete, quando faltam 36 h ou menos e a consulta está `agendada`) e 4 (vaga disponível). As mensagens 2, 3 e 4 terminam com "Responda: 1 - Confirmar, 2 - Remarcar, 3 - Cancelar", só como texto: o backend não lê respostas. Um agendador (`setInterval` de 1 minuto no `server.ts`, com `agora` por parâmetro) envia as mensagens 2 e 3. Ele guarda em memória o que já enviou e envia no máximo 3 por tipo por execução do backend; reiniciar libera mais 3. Os botões da aba enviam sem esse limite e podem reenviar. A falha do mock não derruba a criação da consulta (a rota responde 201) nem o agendador (tenta de novo na rodada seguinte); no envio manual responde 502 `MENSAGEM_NAO_ENVIADA`, e sem telefone responde 422 `SEM_TELEFONE`.
- **Por quê:** sem registro no banco e sem biblioteca de agendamento, o código fica pequeno e testável. O limite faz o avaliador ver alguns exemplos ao subir o projeto sem encher o mock de centenas de mensagens.
- **Custo:** a memória se perde ao reiniciar: o backend pode reenviar a mensagem 2 ou 3 da mesma consulta depois de um restart (até 3 por tipo). Em produção, o registro dos envios iria para o banco e o limite deixaria de existir.

### D61. Serviço `whatsapp-mock`

- **Decisão:** o envio é simulado por um serviço próprio, `whatsapp-mock/` (Node + Express, porta 8025, mensagens em memória), que sobe junto no `docker compose up`. `POST /messages` com `{ to, tipo, text }` guarda a mensagem e responde 201 com `{ id }`; `GET /` mostra as mensagens agrupadas por telefone, da mais recente para a mais antiga. Não há rota nem botão para responder. O backend envia para a URL da variável `WHATSAPP_URL`, e só a URL base muda numa integração real.
- **Por quê:** o desafio não pede integração real, e uma página simples deixa conferir o que o sistema mandou.
- **Custo:** as mensagens somem quando o mock reinicia, e ele não tem autenticação (serviço local de demonstração).

### D62. Lista de espera e oferta de vaga

- **Decisão:** a coleção `lista_espera` guarda nome, telefone (10 ou 11 dígitos), médico opcional, `antecipar` e a data de cadastro, sem tela de cadastro: só `POST /api/lista-espera` e `GET /api/lista-espera`. Se estiver vazia quando o backend sobe, grava 5 pessoas fictícias (2 com médico, 2 com `antecipar`). Nas linhas de risco muito alta e status `agendada`, a ação "Oferecer vaga" envia a mensagem 4 à pessoa mais antiga da espera do mesmo médico (ou sem médico definido). A oferta não muda o status da consulta nem tira a pessoa da fila; sem ninguém elegível responde 404 `SEM_LISTA_DE_ESPERA`. `antecipar` é só informativo.
- **Por quê:** é a ideia do plano ("se der tempo") no tamanho mínimo: regra simples e explicável, sem depender da importação.
- **Custo:** quem recebe a oferta continua na fila e pode receber a mesma vaga de novo; a clínica decide na mão. Não há aceite automático.

## Decisões pendentes (Parte 1 do desafio)

5. O que o sistema faz com pacientes que faltam com frequência? Resolvida na Parte 2: chip "faltoso" (D59), risco de falta (D57) e a aba Prevenção de Faltas com mensagens (D60).
