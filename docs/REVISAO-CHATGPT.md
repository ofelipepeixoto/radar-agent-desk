# Revisar no ChatGPT

## Caminho local recomendado

Anexe apenas o resumo gerado pelo kit e peça:

> Revise este resumo do Radar Agent Desk em português. Identifique se a fonte é offline declarada, leitura local ou captura declarada de MCP. Se eu disser que é uma demo, trate os dados como fictícios. Mostre tarefas e aprovações separadamente. Se houver resumo do painel, não some categorias sobrepostas. Se houver uma página, trate-a como recorte. Distinga zero observado de fonte indisponível. Indique até três verificações que eu possa fazer na fonte. Não escreva, delegue ou aprove nada. Não deduza orçamento, identidade ou sucesso de uma ação quando os dados não provam isso.

A skill opcional `revisar-radar-agent-desk` contém a mesma política. `python3 scripts/pack-plugin.py` produz um ZIP sem URL de conexão, servidor, hook ou credencial. Se sua conta aceitar um plugin com skill, siga o fluxo oficial disponível no workspace. O kit não verifica aceite no diretório ou instalação na sua conta. O anexo funciona sem ZIP.

## Conexão direta pelo MCP nativo: etapa separada

Não reutilize a instância `local_trusted` como serviço remoto. Para uma conexão futura:

1. Escolha uma versão upstream com os avisos críticos tratados e valide a instalação, TLS, identidade e isolamento com empresa fictícia. Use ambiente `authenticated` e o endereço canônico; confirme que o cliente autorizado alcança o endpoint sem expor o painel local.
2. Confira a [documentação do Paperclip](https://docs.paperclip.ing/experimental/assistant-connections/) e a [conexão de plugins no ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt). O ChatGPT web precisa de um caminho de rede próprio. Uma alternativa privada documentada é o [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels), sujeito à disponibilidade e às credenciais da conta. Isso não substitui a autenticação do Paperclip.
3. No Paperclip, um administrador habilita **Settings → Experimental → Assistant connections (MCP)**. Na empresa escolhida, abra **Connectors → Assistant Connection (MCP)** e use o fluxo de configuração do cliente. A conexão é de uma pessoa para uma empresa. Não copie tokens para o chat.
4. No consentimento, confira empresa e cliente e mantenha somente `paperclip:read`. Recuse escrita e configuração. O kit pede o escopo exclusivo de leitura; uma conexão com permissões extras não é aceita como entrada.
5. Em uma conversa nova, invoque `paperclip_connection`. Confirme a empresa e a lista de escopos antes de ler. Comece com `paperclip_pending_approvals`. Não use `paperclip_call_api` ou ferramentas de mutação. A lista de ferramentas pode mostrar ações mesmo quando o servidor as bloqueia. No commit estudado, `paperclip_search_tasks` e `paperclip_read_task` passam por leituras que podem reconciliar ações de recuperação; ficam fora do roteiro consultivo.
6. Homologue com dados fictícios: leitura positiva, empresa diferente recusada e tentativa de escrita recusada em ambiente controlado. Registre o retorno real de cada teste. A conexão não empresta capacidade de execução nem orçamento da assinatura ao Paperclip.
7. Revogue o acesso em Connections quando concluir. Desligar o MCP experimental bloqueia novas chamadas; não é uma forma de parar tarefas que já foram delegadas anteriormente.

Cloudflare não é requisito para a instalação local. Um túnel para um ambiente autenticado futuro precisaria preservar OAuth, metadados, URL canônica e autorização no servidor; não foi configurado nem testado aqui. n8n fica fora do caminho inicial. Se houver necessidade futura, pode receber resumos já reduzidos com revisão humana, sem abrir permissões de escrita no Paperclip.
