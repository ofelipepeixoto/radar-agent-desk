# Integrações controladas: Paperclip, n8n e Cloudflare

## Decisão para a v0.4

O Radar Agent Desk continua offline. O adaptador local não usa OAuth nem vira servidor remoto. O MCP nativo do Paperclip é um candidato separado, ainda **não homologado**. A prova desta entrega é uma inspeção de fonte e um teste sintético do registro de evidência. Nenhum serviço, conta, túnel, webhook ou credencial foi configurado.

| Opção | Uso recomendado | Condição para avançar |
| --- | --- | --- |
| Arquivo reduzido | Revisão manual no ChatGPT. | Conferir localmente o JSON e autorizar seu compartilhamento. Funciona sem integração. |
| MCP nativo do Paperclip | Consulta autenticada a uma empresa fictícia em uma instância separada. | Versão corrigida revisada, TLS, escopo exclusivo `paperclip:read` e os testes abaixo. |
| n8n | Receber um resumo reduzido, após revisão humana, se houver um fluxo concreto a automatizar. | Começar manualmente em cópia isolada, provar que dados brutos e falhas não saem do fluxo. |
| Cloudflare | Camada de acesso opcional para um serviço remoto que já se autentica. | Demonstrar que o cliente realmente suporta o caminho OAuth e que a origem não pode ser contornada. |

## O que foi verificado no Paperclip

A [documentação de conexão](https://docs.paperclip.ing/experimental/assistant-connections/) exige conta autenticada e URL canônica alcançável pelo cliente; conexões públicas usam HTTPS. O MCP experimental começa desligado. A [referência de protocolo](https://docs.paperclip.ing/reference/api/assistant-mcp/) distingue `paperclip:read`, `paperclip:write`, `paperclip:configure` e `offline_access`. Para este piloto, conceda apenas leitura, sem renovação persistente. A assinatura usada por agentes dentro do Paperclip não cria essa conexão.

Na revisão estática do [documento fixado em `d69631b0`](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/doc/public-mcp.md), cada concessão vincula pessoa, cliente, empresa, recurso e escopos. O [código OAuth](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/public-mcp/oauth.ts) verifica expiração e revogação do token e a participação ativa da pessoa na empresa. A [rota MCP](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/routes/public-mcp.ts) retorna `401 invalid_token` quando não autentica e pode retornar `isError: true` dentro de uma resposta HTTP bem-sucedida quando a ferramenta é recusada. O [executor de ferramentas](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/public-mcp/capabilities.ts) recusa empresa divergente e exige o escopo da operação antes do despacho. Um `200` sozinho não prova que a chamada funcionou. Revogar impede novas chamadas; tarefas já delegadas não são canceladas por isso.

O pin acima serve de referência de código, **não é recomendação de implantação**. Leia [SECURITY.md](../SECURITY.md) e reavalie o código e as dependências resolvidas da versão candidata antes de liberar acesso. Não coloque `local_trusted` atrás de túnel ou proxy. O modo local não autentica quem consegue alcançar a porta.

## Rodar a prova sintética, sem serviços

Na raiz do repositório, no Ubuntu:

```bash
node scripts/check-mcp-evidence.mjs < fixtures/mcp-evidence-synthetic.json
node --test test/mcp-evidence.test.mjs
```

O primeiro comando retorna `synthetic-only`, `liveVerification: false` e `activationPermitted: false`. Ele aceita só um JSON de até 8 KiB, com chaves fixas e códigos de resultado. Não chama endpoints nem recebe URLs, IDs, cabeçalhos, tokens ou respostas brutas. Se um teste não aconteceu, marque `not-run`. Se houve timeout, DNS, `5xx` ou falha de transporte, marque `unavailable`; esses erros não provam recusa de acesso. Use `unexpected` quando o resultado é inconclusivo ou não corresponde a um dos códigos. O status `declared-for-human-review` para laboratório é uma declaração do operador, não uma aprovação automática. A saída do processo é `0` para uma matriz completa, `2` para matriz incompleta e `1` para entrada inválida.

## Prova futura em laboratório autenticado

Use duas empresas fictícias **A** e **B**, a mesma pessoa com acesso a ambas e um administrador distinto para alterar participação. Use um cliente descartável e registre apenas os códigos do quadro. A versão corrigida, TLS, dados fictícios e modo autenticado são pré-requisitos. Não reutilize a instalação do PC. Se algum negativo permitir acesso ou a origem não puder ser confirmada, encerre o piloto e revogue a concessão.

| Campo da evidência | Passo de homologação | Resultado esperado |
| --- | --- | --- |
| `withoutCredential` | Chame a ferramenta sem o token, na mesma rota autenticada. | `authentication-denied`: autenticação negada pela aplicação, sem dados. |
| `connectionIdentityAndCompany` | Conceda apenas `paperclip:read` para A. Leia `paperclip_connection` e confira pessoa, empresa e escopos localmente. | `allowed`: identidade e empresa corretas; nenhum escopo extra. |
| `readOwnCompany` | Consulte `paperclip_list_agents` com o ID de A. | `allowed`: ferramenta sem `isError`, dados fictícios de A. |
| `readOtherCompany` | Faça a mesma consulta com o ID de B, mantendo a concessão de A. | `company-denied`: recusa explícita da empresa; não houve retorno de B. |
| `taskWrite` | Em cópia descartável, teste uma edição válida e inofensiva numa tarefa fictícia sem agente. | `scope-denied`: recusa por escopo; a tarefa ficou igual. |
| `agentConfigure` | Teste uma alteração descritiva válida de um agente fictício pausado e sem credenciais. | `scope-denied`: recusa por escopo; a configuração ficou igual. |
| `revokeOwnGrant` | A pessoa revoga a própria concessão em **Connectors → Assistant Connection (MCP)**. | `revoked`: a concessão deixou de aparecer como ativa. |
| `readWithRevokedGrant` | Repita a leitura com a mesma credencial ainda não expirada, sem renovar ou reconectar. | `authentication-denied`: o acesso antigo parou imediatamente. |
| `readAfterMembershipRemoval` | Com uma nova concessão de leitura funcional, retire a pessoa de A; repita com a credencial ainda não expirada. | `authentication-denied`: a aplicação revalidou a participação. |

Para os negativos de escrita e configuração, use argumentos válidos, `requestId` distinto por intenção quando exigido pela ferramenta, e um usuário que teria autorização na empresa fora do escopo. Erro de schema, função ausente, papel de visualizador ou token expirado não provam que o escopo bloqueou. Inspecione a resposta inteira localmente. Não anexe seus dados ou os corpos dos testes ao repositório. Ao terminar, revogue as concessões do laboratório e desligue o MCP experimental se não for usado. Para retomar, inicie novo consentimento com leitura apenas. O fluxo offline não depende desse teste.

## Limites para n8n

O primeiro protótipo deve ser **Manual Trigger → entrada fictícia → validar resumo → apresentar localmente**, sem agendamento, webhook, credenciais ou HTTP. O [Manual Trigger do n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.manualworkflowtrigger/) não dispara sozinho. Só aceite o contrato de saída reduzido deste kit: versione a validação, recuse campos extras e mantenha a diferença entre indisponível e zero. Teste resumo válido, versão errada, campo bruto injetado, repetição e ausência de saída ao falhar. Confira o [armazenamento de execuções](https://docs.n8n.io/hosting/configuration/environment-variables/executions/) antes de usar dados não fictícios. Não é necessário fornecer a n8n uma credencial Paperclip.

Se um caso aprovado realmente precisar de webhook, use ambiente separado, autenticação conforme as [opções do webhook](https://docs.n8n.io/integrations/builtin/credentials/webhook/), limite de entrada e bloqueio padrão. Defina uma chave de repetição com validade limitada se houver efeitos externos. Revogue a credencial e desative a publicação para encerrar o teste. Não foi importado nem executado um fluxo n8n real.

## Quando Cloudflare faria sentido

Só avalie uma camada de acesso se houver uma instância **autenticada**, revisada e destinada ao piloto remoto. Preserve TLS, URL canônica, descoberta `/.well-known`, consentimento e tokens do Paperclip de ponta a ponta; bloqueie acesso direto à origem. Um [token de serviço do Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) é uma credencial diferente, normalmente em cabeçalhos próprios. Só use se o cliente puder enviar os cabeçalhos em todas as etapas sem expor segredo ou substituir o `Authorization: Bearer` do Paperclip. Caso contrário, essa arquitetura não está homologada. Teste recusa no perímetro, OAuth com escopo restrito na origem e revogação independente nas duas camadas. Não foi configurado DNS, Access, túnel ou Worker.
