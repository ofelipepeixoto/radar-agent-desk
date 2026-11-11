# Roadmap do Radar Agent Desk

O foco é transformar o estado de um painel de agentes em um resumo pequeno, que a pessoa revisa antes de levar ao ChatGPT. A demo e o resumo por arquivo funcionam sem fornecedor. A captura opcional de uma instância Paperclip é um adaptador de laboratório, com versão fixada, apenas em loopback.

| Marco | Entrega | Quando considerar pronto |
| --- | --- | --- |
| **v0.1.0 · Base pública** | CLI, demo fictícia, resumo por arquivo local, adaptador opcional e documentação em português. | Um clone limpo roda a demo e passa nos testes sem acessar um painel real. |
| **v0.1.1 · Implementação na `main`** | Diagnóstico do WSL e da captura local. Distinguir pasta incorreta, Node indisponível, serviço fora do ar, demora e versão incompatível. | O guia funciona em um clone limpo no WSL. Os casos de rede e versão têm testes com servidor de laboratório. As mensagens não incluem dados da origem. |
| **v0.2 · Implementação na `main`** | [Contrato JSON v1, exemplos e importação CSV](docs/IMPORTACAO-OFFLINE.md). | Uma fixture de origem diferente gera o mesmo formato de saída. Entradas inválidas são rejeitadas e a saída não carrega campos identificáveis. |
| **v0.3 · Ensaio na `main`** | [Backup e restauração em laboratório](docs/OPERACAO-LOCAL.md). Versão estável corrigida e teste HTTP na cópia continuam pendentes. | Check de saúde, captura e restauração comprovados em uma cópia de teste. O suporte a versões continua explícito. |
| **v0.4 · Avaliação na `main`** | [Avaliação de MCP, n8n e Cloudflare](docs/INTEGRACOES-CONTROLADAS.md), com matriz sintética. A prova em ambiente autenticado está pendente. | Uma integração só entra em uso quando passar por testes de escopo, revogação e isolamento. O modo local continua funcional sem a integração. |

Os rótulos indicam o que está no código e na documentação. Eles não anunciam releases nem homologação de serviços em produção.

## Operação do painel em paralelo

O [roteiro do Paperclip no WSL2](docs/AGENTES-PAPERCLIP-WSL.md) registra os testes iniciais de Camaleão, Engenharia Radar e Revisão Radar: conexão por assinatura, respostas a tarefas fictícias e encerramento manual. Para ampliar a equipe, habilite um agente por vez e registre o teste do runtime, a entrega fictícia e quem revisa. A validação de uma conta por chave de API deve ser registrada separadamente. O resultado do painel não muda a versão fixada do adaptador nem valida a captura de uma restauração.

## Como manter o repositório em evolução

Escolha a menor tarefa que satisfaça um critério da tabela. Registre o caso a resolver e o teste esperado em uma issue ou na descrição da PR. Trabalhe em branch própria pelo [Codex no terminal](docs/DESENVOLVER-COM-CODEX.md), abra PR e espere o CI. Atualize o changelog junto com a mudança. Use tags quando houver uma versão pronta para repetir em um clone limpo.

A revisão humana decide o merge. Cloudflare, n8n, permissões, publicação de dados e implantação são etapas separadas. O roadmap não ativa serviços nem agenda execuções.
