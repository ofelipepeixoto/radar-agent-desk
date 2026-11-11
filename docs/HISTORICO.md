# Histórico de construção

Este documento registra a primeira base pública e os avanços desde a publicação. O trabalho anterior é descrito como relato: as datas dos commits não foram recriadas.

| Etapa | Decisão e resultado |
| --- | --- |
| Prova de instalação | Foi estudado o fluxo de um painel de agentes no Windows com Ubuntu/WSL2. No laboratório Linux inicial, as checagens de instalação e as migrações passaram; a API HTTP ficou bloqueada por uma restrição de rede do ambiente. |
| Primeiro coletor | O cliente foi limitado a loopback e a contagens de uma organização. Foram escolhidos agregados do painel em vez das rotas de tarefa, que podem acionar recuperação interna. |
| Revisão em português | O resumo passou a separar números observados de dados ausentes e a omitir nomes, IDs e textos. A revisão pode ser feita com um arquivo anexado. Um pacote opcional guarda só instruções. |
| Instalação em PC | A instância Paperclip abriu no navegador do Windows e houve uma execução Codex bem-sucedida observada no painel. Isso prova o funcionamento daquele ambiente, não a captura do kit ou OAuth do ChatGPT. Os tropeços com shell, versão do Node e pasta extraída orientaram o guia. |
| Primeira base pública | O núcleo ganhou entrada offline independente. A versão pública preserva o adaptador como opção, com limites e testes. O fluxo para evoluir passa a ser branch, revisão, testes, PR e registro no changelog. |
| Operação local com Codex | Em WSL2, o teste de conexão por assinatura passou em uma pasta Git de laboratório separada dos dados. O Camaleão respondeu `OK` a uma tarefa de teste. A recuperação automática reportou rota não encontrada e o Board confirmou a conclusão manual. O [roteiro](AGENTES-PAPERCLIP-WSL.md) separa o teste do agente da captura, da restauração e da integração por chave. |
| Equipe inicial | Engenharia Radar e Revisão Radar passaram nos testes de conexão e nas tarefas fictícias, com revisão do Board. A conta por assinatura ficou limitada aos três agentes escolhidos. A chave de API ficou como opção futura. |
| Auditoria de conectores | O [registro de verificação](AUDITORIA-CONECTORES.md) separa o que o painel apresenta, o acesso concedido e o que foi testado. As integrações externas do painel não mudam o modo offline do kit. |
| Interface local | O kit ganhou uma extensão opcional que traduz rótulos selecionados no Chrome, acionada por clique. A [tradução parcial](INTERFACE-PT-BR.md) não altera os dados nem a configuração do Paperclip. |

## Origem e licenças

- CLI, parser, adaptador, documentação e testes do Radar Agent Desk: código do projeto, sob [MIT](../LICENSE), © Carlos Felipe Peixoto.
- O [Paperclip](https://github.com/paperclipai/paperclip) é software de terceiros. Compatibilidade opcional avaliada em `v2026.1106.0`, [commit d69631b0](https://github.com/paperclipai/paperclip/tree/d69631b01b9c658f80bf8bed389863dce82643e1), sob a [licença MIT da Paperclip AI](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/LICENSE). Não redistribuímos o motor nem somos afiliados aos seus mantenedores.
- O [tutorial da Curta Soluções](https://posts.curtasolucoes.com.br/paperclip) serviu de referência para a ordem de instalação. O [roteiro deste projeto](INSTALACAO-WINDOWS.md) foi escrito para seu próprio recorte e versão.
- ChatGPT e Codex são serviços externos e opcionais para revisar ou desenvolver. A importação, a demo e os testes não chamam modelos.
