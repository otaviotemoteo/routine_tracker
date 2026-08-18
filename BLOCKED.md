# Verificação manual pendente — consolidação do onboarding

Tudo abaixo foi implementado, commitado (um arquivo por commit) e passou em
`bunx tsc --noEmit`, `bun run lint`, `bun test` e `bun run build`. O que falta
aqui é o que eu não consigo verificar sozinho neste ambiente: um navegador
real, autenticado, e o `bun test` deste ambiente não enxerga `DATABASE_URL`
(por isso os testes que tocam banco ficam "skip", nunca rodam de verdade
aqui — inclusive os que já existiam antes, como `isolation.test.ts`).

Use uma conta de teste (`bun run user:create <nome>`) para os passos abaixo,
não a conta real.

## 1. Estado dos dados — já verificado, sem pendência

Rodei uma checagem única contra o banco real antes de mexer em qualquer
código: nenhum usuário tinha (nem tem) mais de um assessment selado no mesmo
ciclo — o estado exato que o bug crítico (duplo clique em "Start" na tela
antiga) poderia ter deixado para trás. 5 usuários no total, 2 com assessment
selado, nenhuma duplicata. Não precisa de limpeza. Não incluí o script aqui
porque era só diagnóstico — rodei e apaguei.

## 2. Caminho feliz, do zero até o Today

- [ ] Criar conta nova, reivindicar (definir senha).
- [ ] A primeira tela deve ser a intro expandida (o card "Onde isso leva",
      não só a explicação da grade de 12 perguntas).
- [ ] Nenhuma NavBar deve aparecer em nenhuma tela até o fim — grade,
      resultados, direções, áreas, revisão de hábitos.
- [ ] Responder as 12 áreas, ver as prioritárias, escrever uma direção para
      cada, gerar (ou adicionar manualmente) os hábitos, apertar "Começar a
      acompanhar".
- [ ] Deve cair no Today de verdade, com os hábitos escolhidos — e a partir
      daí a NavBar aparece normalmente.

## 3. A regressão do bug crítico (a mais importante)

- [ ] Nova conta, avançar até `/onboarding/habits` com hábitos gerados na
      tela.
- [ ] **Sem apertar "Começar a acompanhar"**, ir direto pra `/` (barra de
      endereço).
- [ ] Esperado: cair de volta em `/onboarding/habits`, com os mesmos hábitos
      propostos ainda lá. Errado seria cair na tela de "Start" do zero — esse
      era o bug original.

## 4. Adicionar / editar um hábito durante a revisão

- [ ] Na tela de revisão de hábitos (ainda em modo primeiro acesso), clicar
      em "Adicionar" — deve abrir o formulário normalmente, sem redirecionar
      de volta pro onboarding.
- [ ] Salvar — deve voltar pra `/onboarding/habits` com o hábito novo na
      lista.
- [ ] Editar um hábito proposto — mesma coisa, sem bounce.
- [ ] Essa é uma correção que eu encontrei durante a implementação (não
      estava no plano original): `/habits/new` e `/habits/[id]` são usados
      pela tela de revisão mas ficam dentro do grupo `(app)`, que tem o
      mesmo gate. Sem a isenção que adicionei, esse fluxo quebraria do mesmo
      jeito que `/habits/review` quebrava antes.

## 5. Retomar exatamente de onde parou

- [ ] No meio da grade de 12 perguntas, sair (ir pra `/`) e voltar — deve
      cair na pergunta certa (você já confirmou que isso funciona hoje).
- [ ] No meio das direções (ex: escreveu 2 de 5), sair e voltar — deve cair
      na área certa, não na primeira nem numa tela genérica.
- [ ] Confirmar que o texto muda pra deixar claro que é uma retomada, não um
      começo do zero (ex: nas telas de resultado/direções o botão já diz
      "Rever suas direções" em vez de "Escrever suas direções" quando já tem
      algo escrito — isso é o mecanismo existente, só confirma que continua
      funcionando depois da mudança de rota).

## 6. O teto (ceiling) nas direções

- [ ] Com 2 das 5 direções escritas, tentar visitar direto pela URL a 4ª ou
      5ª área (`/onboarding/directions?domain=<slug>`).
- [ ] Esperado: redirecionar pra 3ª (a primeira ainda sem direção), não
      deixar pular.
- [ ] Voltar pra uma área já escrita (`domain=` de uma das 2 primeiras) —
      isso continua livre, sem redirecionar.

## 7. Botão Salvar desabilitado

- [ ] Numa tela de direção, deixar o campo "em uma frase, a direção" vazio.
- [ ] O botão "Salvar e continuar" deve estar visivelmente desabilitado
      (cinza/sem clique) até digitar algo.

## 8. Usuário que já passou pelo onboarding (recheck-in periódico)

- [ ] Com uma conta que já tem pelo menos um hábito ativo, entrar em
      Overview → card de valores → refazer o check-in.
- [ ] A NavBar deve continuar aparecendo normalmente em resultados, na lista
      de direções, em áreas e na revisão de hábitos — essa é a exceção
      deliberada (a supressão da NavBar é só pra quem ainda não tem nenhum
      hábito ativo).

## 9. O beco sem saída fechado (importância ≤4 em tudo)

- [ ] Difícil de alcançar manualmente (precisa responder "importância geral"
      baixa nas 12 áreas), mas se der pra testar: completar a grade dando
      nota ≤4 pra importância geral em tudo.
- [ ] Esperado: cair direto na tela de hábitos (modo manual, "nada sugerido
      ainda"), não numa tela de resultados sem botão de continuar.
- [ ] Se visitar `/onboarding/results` diretamente nesse estado, deve
      aparecer a mensagem nova ("nada se destacou...") com um botão pra
      adicionar hábitos, não a ausência silenciosa de botão que tinha antes.

## 10. Teste automatizado que não rodou aqui

- [ ] `src/lib/onboarding-flow.test.ts` cobre os itens 3 e 9 acima
      (regressão do bug crítico e do beco sem saída) contra um banco real,
      seguindo exatamente o padrão de `src/db/isolation.test.ts`. Ele compila
      e o `describe.skipIf` funciona (confirmei: some para "skip", não
      "fail"), mas nunca rodou de verdade aqui porque `bun test` neste
      ambiente não enxerga `DATABASE_URL` — nem os testes de isolamento que
      já existiam antes rodam aqui. Rodar `bun test` num ambiente com
      `DATABASE_URL` visível pro test runner (CI, ou local apontando pra um
      banco de teste) pra confirmar que os dois testes novos realmente
      passam, não só compilam.

## 11. Sentry (não relacionado a este trabalho, só lembrete)

- [ ] O deploy anterior mostrou erro de upload de source map ("Project not
      found"). Já corrigi o slug do projeto (`javascript-nextjs` →
      `personal_tracker`) num commit anterior a este trabalho. Vale conferir
      no próximo deploy se o erro sumiu ou se ainda precisa regenerar o
      `SENTRY_AUTH_TOKEN` na Vercel.
