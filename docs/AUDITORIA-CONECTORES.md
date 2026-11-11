# Como conferir os conectores do Paperclip

Este roteiro serve para o Paperclip local, instalado separadamente do Radar Agent Desk. A CLI não precisa de conectores para importar ou revisar contagens. O teste de um conector do painel também não valida a captura HTTP, o MCP de assistentes, um fluxo n8n ou a publicação da instância.

## Diferencie o que o painel mostra do que foi testado

1. Em **Conectores**, confira as conexões salvas. Uma opção do catálogo com **Connect** ou **Add key** não comprova integração. O teste de uma conta conectada no ChatGPT também não comprova acesso no Paperclip.
2. Na conexão salva, confira **Permissões**: quem pode usar a credencial, quais agentes podem chamá-la e quais ações estão liberadas. O escopo do recurso também precisa estar limitado no provedor. A seleção de agentes e o escopo no provedor são controles diferentes.
3. Use uma operação de leitura em um recurso público ou fictício. Se houver teste em **Permissões → Ações**, escolha o agente e a operação de leitura. Em uma tarefa, confirme em **Runs/Atividade** que a ferramenta esperada foi chamada. Se só houver descoberta de ferramentas, checagem da interface ou resposta do agente sem chamada comprovada, registre exatamente isso.
4. Registre separadamente acesso, leitura, escrita, isolamento e revogação. Um resultado de leitura não comprova os demais. Não teste escrita em serviços reais para demonstrar que uma conexão existe.

Para publicar evidência neste repositório, registre a data, o tipo de teste, o resultado e o limite do que foi observado. Não inclua credenciais, cabeçalhos, respostas brutas, dados de contas, IDs internos, caminhos de máquina nem capturas da sessão.

## Registro do laboratório local

Na rodada de 11 de novembro de 2026, **Conectores** mostrou quatro integrações instaladas. A tabela registra o estado observado e o que cada teste demonstrou. Nenhum teste fez alterações nos serviços externos.

| Conexão | Evidência observada | Limite ou ajuste recomendado |
| --- | --- | --- |
| GitHub nativo gerenciado | Engenharia Radar chamou `get_file_contents` para ler o `README.md` público da `main` deste repositório. A chamada ficou como **Worked** e retornou o título esperado. | Foram observadas permissões acima do necessário para o piloto. Restrinja a instalação a repositórios escolhidos e as ações a leitura. A chamada não testou repositórios privados, escrita ou revogação. |
| Cloudflare | Engenharia Radar chamou **Current Cloudflare Identity**. A chamada de leitura ficou como **Worked**. | Foram observadas permissões acima do mínimo. Restrinja quem pode usar a conexão e deixe o executor de API desligado enquanto não houver necessidade revisada. A checagem de identidade não demonstra escopo por zona, nem valida DNS, Workers, Access ou Tunnel. |
| Composio | A busca de ferramentas como Engenharia Radar funcionou e encontrou a operação de leitura de arquivo no catálogo. Após atualizar a lista, o painel informou que não havia aplicativos conectados. | A busca não autenticou nem chamou um aplicativo final. Restrinja o compartilhamento e desative ações que não tenham um uso revisado. |
| OpenAI por assinatura | **Check usage** consultou a janela semanal do Codex. A conexão pessoal estava limitada ao titular e aos três agentes escolhidos. Os testes de execução da [equipe inicial](AGENTES-PAPERCLIP-WSL.md) já tinham passado. | A consulta verificou a conexão salva. Nesta rodada não houve nova execução de modelo nem teste por chave da API. |

O **Assistant Connection (MCP)** experimental é outro fluxo. O status não carregou na tentativa nem na repetição. A tela indicou que o caminho público pede uma instância autenticada com HTTPS. Não houve consentimento OAuth, teste de ferramenta nem confirmação de conexão. A instância local permaneceu em loopback.

Em **Projeto → Configuration → Add GitHub repo**, o repositório público apareceu entre as opções. Nenhuma opção foi selecionada ou salva: a lista **Source repos** continuou vazia e a pasta de trabalho permaneceu gerenciada pelo Paperclip. A leitura do GitHub foi feita pela conexão de ferramentas, separada do vínculo de repositório do projeto. A auditoria não alterou permissões, vínculos, chaves ou integrações.

## Roteiros de verificação

**OpenAI por assinatura.** Em **Agentes → Harness / Runtime**, confira a conexão escolhida e rode o teste do Codex. Depois atribua uma tarefa fictícia curta e compare o resultado em **Runs**. A conta por assinatura e uma chave da API são caminhos separados. Veja o [roteiro de agentes no WSL2](AGENTES-PAPERCLIP-WSL.md) e a [documentação do provedor no Paperclip](https://docs.paperclip.ing/connectors/openai/).

**GitHub.** Em **Conectores**, confirme se foi cadastrado o conector nativo ou um servidor MCP em **Connect your own tool**. Uma conexão MCP oferece ferramentas ao agente. Não trate esse cadastro como associação de **Source repos** do projeto, configuração da pasta Git, integração com Copilot ou permissão para `git push`. No GitHub, prefira credencial granular, com validade curta, sem escrita e sem acesso a repositórios privados desnecessários. O GitHub permite ler conteúdo público sem essa autorização. No Paperclip, limite a conexão ao titular e aos agentes que precisam dela. Teste a leitura do `README.md` público de `ofelipepeixoto/radar-agent-desk` pela ferramenta do conector e confira a chamada no histórico. O mesmo conteúdo pode ser obtido sem credencial e, sozinho, não comprova a conexão. Consulte o [guia nativo do Paperclip](https://docs.paperclip.ing/connectors/github-setup/), o [guia de MCP personalizado](https://docs.paperclip.ing/connectors/custom-mcp-servers/) e o [modo somente leitura do GitHub MCP Server](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md).

**Cloudflare.** Se houver uma conexão de ferramentas salva, identifique a credencial e o escopo de ações sem copiar seus valores. Valide apenas uma leitura permitida, em um recurso que já esteja no escopo do teste. A leitura por um conector não comprova configuração de DNS, Workers, Access ou Tunnel. A instância `local_trusted` do laboratório deve permanecer em loopback. Consulte [Quando Cloudflare faria sentido](INTEGRACOES-CONTROLADAS.md#quando-cloudflare-faria-sentido) e [os limites do ambiente](../SECURITY.md).

**Composio.** Confirme os aplicativos autorizados na conta do provedor, além dos agentes e ações no Paperclip. O cadastro do agregador não prova que cada serviço esteja ligado, que as permissões estejam corretas ou que uma chamada chegue ao serviço final. Veja o [guia de contas Composio](https://docs.paperclip.ing/connectors/composio/).

**Se o teste falhar.** Registre se faltou autenticação, acesso ao agente, escopo no provedor ou evidência no histórico. Para retirar acesso de um agente, altere o compartilhamento da conexão. Para encerrar uma credencial de teste, revogue-a também no provedor e remova a conexão quando não for mais usada. Consulte o [guia de verificação do Paperclip](https://docs.paperclip.ing/connectors/verify-and-troubleshoot/).
