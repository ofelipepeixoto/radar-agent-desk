# Operar agentes no Paperclip com Windows e WSL2

O Paperclip é o painel de operação. O Radar Agent Desk é o kit de resumo: você pode usar a CLI sem iniciar agentes, e pode operar o painel sem rodar a CLI. Este roteiro registra a operação local observada no Paperclip `2026.1106.0`, usando Node `24.22.2` e Codex CLI `0.167.1` no Ubuntu do WSL2. Confira a [avaliação da versão](OPERACAO-LOCAL.md) e os [limites de segurança](../SECURITY.md). Use dados fictícios e mantenha a porta em loopback. A versão avaliada tem dependências com avisos e não foi aprovada para produção.

## 1. Separe as três pastas

Comece pelo [guia do Windows](INSTALACAO-WINDOWS.md) para abrir o Ubuntu, conferir o Node e instalar a instância de laboratório, se necessário. Se o painel já funciona, reaproveite a instância e sua configuração. Não repita `onboard` sobre os dados existentes.

| Pasta | Uso |
| --- | --- |
| Clone do `radar-agent-desk` | Código público e comandos `check`, `demo`, `probe` e `capture`. |
| Diretório de dados do Paperclip | Instância, banco, configuração e segredos. Fica fora do Git. |
| Pasta Git vazia de trabalho | Ambiente descartável de teste do Codex. Sem arquivos privados, remotos ou chaves. |

No **Ubuntu** (prompt termina em `$`), confira o [Codex CLI](https://developers.openai.com/codex/cli/). Se ainda não estiver instalado **no Ubuntu**, rode `npm install -g @openai/codex`. Depois use `codex --version` e `codex login status`. Se necessário, use `codex login` e conclua o login no navegador. O login do terminal é verificado separadamente da conta escolhida no painel.

Crie a pasta de trabalho uma vez. Um Git vazio, sem commit, foi suficiente no ensaio:

```bash
teste_codex="$HOME/radar-paperclip-codex-lab"
if [ ! -e "$teste_codex" ]; then
  mkdir -m 700 -- "$teste_codex" && git init -q "$teste_codex"
fi
git -C "$teste_codex" rev-parse --is-inside-work-tree
```

Se a última linha não imprimir `true`, confira o caminho antes de prosseguir. Não inicialize Git dentro do diretório de dados.

## 2. Teste a conexão do agente

1. Abra o painel local no navegador e use **Conectores → OpenAI**. Se já houver uma conexão por assinatura válida, reaproveite-a. Para conectar pela primeira vez, escolha assinatura, siga o link de login e informe o código de dispositivo apenas na página oficial da OpenAI. Volte ao Paperclip e conclua a conexão. Consulte o [guia do Paperclip](https://github.com/paperclipai/paperclip-docs/blob/main/docs/connectors/openai.md) se a opção não estiver disponível.
2. Restrinja a conexão ao seu usuário e aos agentes escolhidos. Em **Agentes → Camaleão → Harness / Runtime** (ou no agente que você criou), escolha **Codex** e selecione a conexão por assinatura no campo **Connection**. Mantenha **Bypass sandbox** desligado.
3. Clique em **Run test** ou **Test again** e abra **Test details**. No teste observado, a página informou **ACP**, a pasta Git de trabalho, autenticação pelo Codex e `Codex hello probe succeeded`. Só salve uma mudança de runtime após verificar o teste e a configuração. Em uma tarefa, o acesso também depende de a pessoa responsável estar autorizada a usar a conexão.

Se o `hello` falhar e o teste mostrar o diretório de dados como pasta de trabalho, confira `git -C` nesse caminho. No ensaio, a conexão passou após reiniciar a mesma instância a partir da pasta Git vazia. Quando precisar repetir esse diagnóstico, pare a instância pela janela que a iniciou (`Ctrl+C`) e confira se a porta ficou livre com `ss -ltn 'sport = :3100'`. Para outra porta, troque `3100` pelo seu valor. Não mate um processo que você não identificou.

No bloco abaixo, substitua o valor de `dados` pelo **mesmo** diretório já usado pela sua instância. Exemplo para instância `default`, com o nome de pasta do guia de instalação:

```bash
dados="$HOME/.radar-agent-desk-paperclip-lab"
config="$dados/instances/default/config.json"
test -f "$config" &&
cd "$HOME/radar-paperclip-codex-lab" &&
PAPERCLIP_TELEMETRY_DISABLED=1 npx --yes --registry=https://registry.npmjs.org \
  paperclipai@2026.1106.0 run --no-repair \
  --data-dir "$dados" --instance default --config "$config"
```

Se usava uma porta definida por `PORT`, conserve o mesmo valor. Mantenha a janela do servidor aberta, volte ao painel e repita o teste. Essa sequência recupera o cenário observado do Codex. Se o `probe` do Radar Agent Desk reportar versão ou commit divergentes, siga o diagnóstico do adaptador e use a importação offline enquanto não resolver. O `hello` não é teste de captura.

## 3. Comece sob demanda e com revisão humana

O perfil inicial observado no Camaleão tinha instruções em português, **Heartbeat on interval** desligado, **Wake on demand** ligado, concorrência de `1`, tempo limite de `900` segundos e **Continue after max-turn stop** desligado. Confira esses campos quando criar um agente. Uma instrução dizendo para não escrever, publicar ou mexer em credenciais não substitui as permissões do runtime e das ferramentas. Dê acesso só ao que a função precisa.

1. Clique em **Nova tarefa** ou **Assign Task**, atribua ao agente e use um pedido pequeno com dados fictícios. Para validar o primeiro caminho, use `Responda apenas OK, sem ler ou alterar arquivos.`.
2. Confira a resposta e, na área **Runs** do agente, a execução correspondente. `OK` demonstra que a tarefa chegou ao agente e houve retorno; confira separadamente se ela ficou concluída.
3. Se a resposta já estiver correta e o painel mostrar uma pergunta de recuperação após `API route not found`, confirme que a pergunta ainda está pendente. Você pode responder: `A resposta foi aceita. O Board vai encerrar esta tarefa manualmente. Não repita chamadas pela API.`. Em seguida, no status da tarefa, escolha **Done** se a interface permitir e confira o novo status. Se o painel impedir o encerramento, mantenha o status registrado e investigue pela interface. Não teste rotas de escrita desconhecidas.

No ensaio no WSL, o Camaleão respondeu `OK`, o caminho automático de recuperação retornou rota não encontrada e o Board confirmou **Done** pelo painel. Isso valida o fluxo simples com encerramento manual; o erro de recuperação continua registrado como limitação.

## 4. Configure a equipe inicial

No painel, abra **Agentes** e use a opção de adicionar um agente. Para cada função, escolha **Codex**, dê acesso à conexão por assinatura quando ela for necessária, salve as instruções em português e repita o teste do runtime. Use um agente por tarefa. O Board decide quando aceitar o resultado ou pedir outra rodada.

| Agente | Entrega | Primeiro teste sem ferramentas |
| --- | --- | --- |
| **Camaleão** | Organiza prioridades, transforma um pedido em tarefa e aponta bloqueios e próximos passos para o Board. | `Responda apenas OK, sem ler ou alterar arquivos.` |
| **Engenharia Radar** | Diagnostica problemas e propõe uma alteração pequena, com teste e como voltar atrás. Trabalha em um clone dedicado quando houver autorização. | `Sem ferramentas, elimine as repetições de A,B,A mantendo a ordem. Responda somente no formato ENG-01:<resultado>.` |
| **Revisão Radar** | Confere evidências, segurança e critérios de aceite. Aponta o que pode ser aprovado e o que falta verificar. | `Sem ferramentas, avalie uma mudança fictícia que imprime a chave de API inteira no log. Responda só REV-01:APROVAR ou REV-01:BLOQUEAR.` |

Inclua nas instruções de cada agente: responda em português do Brasil; separe observação de hipótese; use só dados e ferramentas autorizados; não publique, não faça merge e não configure credenciais por iniciativa própria; deixe a decisão final com o Board. Em **Nova tarefa**, selecione o responsável, descreva o resultado esperado e informe quais dados e ferramentas ele pode usar. Acompanhe a execução em **Runs**. Para passar uma entrega de Engenharia para Revisão, atribua uma tarefa separada com o resumo e a evidência autorizada. Evite automação em cadeia até testar a revisão manual.

No ensaio, os dois agentes especialistas usaram **Codex Default (ACP)**, `gpt-5.6-sol` e a conexão pessoal por assinatura selecionada explicitamente. No conector, **Just me** e **Just agents I pick** limitaram a conexão à pessoa titular e aos três agentes da tabela. Em **Harness / Runtime**, foram mantidos o limite de `900` segundos, concorrência `1`, execução sob demanda, timer e continuação desligados. Busca, bypass do sandbox e captura de traces brutos ficaram desligados. Em permissões, a criação de agentes e a importação de skills ficaram desligadas. A capacidade de atribuir tarefas ainda seguia o padrão da organização; a instrução de não delegar por conta própria não equivale a um bloqueio técnico.

Os testes dos especialistas retornaram `ENG-01:A,B` e `REV-01:BLOQUEAR`. O Board conferiu o resultado e marcou ambas as tarefas como **Done**. Em cada caso, o painel registrou duas execuções bem-sucedidas, uma por atribuição e outra por automação. Timer desligado evita disparos por intervalo; não garante que cada evento produza apenas uma execução. Confira o histórico antes de pedir outra rodada. Os testes usaram apenas dados fictícios e a assinatura, sem chave de API.

## 5. Diferencie assinatura, API e revisão no ChatGPT

| Caminho | O que faz | Como validar |
| --- | --- | --- |
| Assinatura via Codex | Executa o agente do Paperclip usando a conta atribuída. | Teste de runtime e tarefa fictícia. |
| Chave da API OpenAI | Usa o projeto associado à chave, com [cobrança separada](https://help.openai.com/pt-br/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform). | Teste com a conta de API explicitamente selecionada e verificação de uso no projeto correspondente. Um `hello` por assinatura não confirma essa integração. |
| Resumo para o ChatGPT | Você revisa as contagens reduzidas antes de enviar. | [Demo offline](INSTALACAO-WINDOWS.md#2-baixe-e-rode-a-demo) e [roteiro de revisão](REVISAO-CHATGPT.md). |

Use uma chave de projeto somente em uma instância e com um agente aprovados para esse uso. O conector OpenAI do Paperclip tem opção de chave e armazena a credencial como segredo. Consulte a [documentação do conector](https://github.com/paperclipai/paperclip-docs/blob/main/docs/connectors/openai.md) para a sua versão. Não coloque a chave em instruções, tarefas, logs, commits ou arquivos do kit. Não publique a porta local nem trate orçamento de alerta como barreira de gasto.

Para a equipe inicial sob demanda, a decisão foi manter a assinatura. Considere um piloto por chave apenas para uma necessidade que ela não atende, como um consumidor direto da API, isolamento de cobrança por projeto ou uma limitação comprovada da assinatura. Use um projeto e agente dedicados, combine um teto antes do teste, acompanhe o uso e confirme como revogar o acesso. Não mude o login dos agentes que já funcionam para testar uma alternativa.

Para evoluir, acrescente uma função por vez, descreva o que ela entrega e rode o primeiro teste com dados fictícios. Registre o resultado e o que ainda falta validar antes de habilitar rede, automação recorrente ou acesso a sistemas de trabalho. Para a documentação e a CLI, use o [fluxo de revisão por PR](DESENVOLVER-COM-CODEX.md).
