# Radar Agent Desk

Estas instruções valem neste repositório público. Leia o README, o roadmap e o contrato de dados antes de mudar comportamento.

- Trabalhe em uma branch por melhoria. Preserve mudanças existentes e mantenha o diff focado. Não reescreva histórico.
- O modo offline deve funcionar sem serviços ou dependências npm. Use dados fictícios e, para HTTP, um servidor sintético em loopback. Não acesse a instância real do operador em testes de desenvolvimento.
- Preserve limites de bytes, tempo, empresa e versão. A captura aceita somente loopback e rotas fixas. Não adicione escrita, redirecionamentos, proxy, credenciais ou execução de agente como parte de um ajuste de leitura.
- Nunca adicione a Git tokens, credenciais, logs reais, bancos, configurações pessoais, capturas, nem relatórios com dados reais. Use exemplos fictícios. Não copie código de terceiros sem revisar licença e atribuição.
- Rode `npm test` e `git diff --check`; se tocar no pacote opcional, rode também os checks Python do README. Relate o que passou e o que ficou sem teste.
- Atualize documentação e changelog quando mudar comportamento público. Informe riscos e como reverter.
- Prepare o diff para revisão. Push, abertura de PR, merge, release, publicação, alterações de conta e implantação só quando forem solicitados para a rodada. Não use bypass de sandbox ou de aprovações. A CI deve rodar somente checks determinísticos, sem modelos nem chaves.
