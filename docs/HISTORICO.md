# Histórico de construção

Este documento registra o que levou à primeira base pública. Os commits públicos começam na publicação deste repositório. O relato abaixo descreve o trabalho anterior; as datas dos commits não foram recriadas.

| Etapa | Decisão e resultado |
| --- | --- |
| Prova de instalação | Foi estudado o fluxo de um painel de agentes no Windows com Ubuntu/WSL2. No laboratório Linux inicial, as checagens de instalação e as migrações passaram; a API HTTP ficou bloqueada por uma restrição de rede do ambiente. |
| Primeiro coletor | O cliente foi limitado a loopback e a contagens de uma organização. Foram escolhidos agregados do painel em vez das rotas de tarefa, que podem acionar recuperação interna. |
| Revisão em português | O resumo passou a separar números observados de dados ausentes e a omitir nomes, IDs e textos. A revisão pode ser feita com um arquivo anexado. Um pacote opcional guarda só instruções. |
| Instalação em PC | A instância Paperclip abriu no navegador do Windows e houve uma execução Codex bem-sucedida observada no painel. Isso prova o funcionamento daquele ambiente, não a captura do kit ou OAuth do ChatGPT. Os tropeços com shell, versão do Node e pasta extraída orientaram o guia. |
| Primeira base pública | O núcleo ganhou entrada offline independente. A versão pública preserva o adaptador como opção, com limites e testes. O fluxo para evoluir passa a ser branch, revisão, testes, PR e registro no changelog. |

## Origem e licenças

- CLI, parser, adaptador, documentação e testes do Radar Agent Desk: código do projeto, sob [MIT](../LICENSE), © Carlos Felipe Peixoto.
- O [Paperclip](https://github.com/paperclipai/paperclip) é software de terceiros. Compatibilidade opcional avaliada em `v2026.1106.0`, [commit d69631b0](https://github.com/paperclipai/paperclip/tree/d69631b01b9c658f80bf8bed389863dce82643e1), sob a [licença MIT da Paperclip AI](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/LICENSE). Não redistribuímos o motor nem somos afiliados aos seus mantenedores.
- O [tutorial da Curta Soluções](https://posts.curtasolucoes.com.br/paperclip) serviu de referência para a ordem de instalação. O [roteiro deste projeto](INSTALACAO-WINDOWS.md) foi escrito para seu próprio recorte e versão.
- ChatGPT e Codex são serviços externos e opcionais para revisar ou desenvolver. A importação, a demo e os testes não chamam modelos.
