# Formato do resumo para o ChatGPT

O kit gera um JSON pequeno com contagens de tarefas e aprovações pendentes. O arquivo de entrada fica no computador. Revise e compartilhe somente o resumo se estiver autorizado a expor esses totais.

## Opções de origem

| `source` | Entrada | Limite da evidência |
| --- | --- | --- |
| `radar-offline` | Cinco contagens declaradas pelo operador, inclusive a demo | Não comprova fonte, autenticidade ou conexão. |
| `fixture` | Fixture de testes do formato de páginas | Não consultou o Paperclip. |
| `paperclip-native-mcp` | Respostas copiadas de um cliente MCP já autorizado | O arquivo não autentica o servidor, a captura nem a conexão. |
| `paperclip-local-rest` | Totais do painel REST do Paperclip local | Não representa OAuth. O transporte em `local_trusted` depende do computador e da configuração do operador. |

## Entrada offline

Copie [o exemplo](../fixtures/contagens-exemplo.json). Informe as cinco contagens como inteiros entre 0 e 1 bilhão. `inProgress` e `blocked` são subconjuntos distintos de `open`, por isso a soma não pode ultrapassar `open`. As chaves são fixas; campos extras, textos, IDs e declarações de autorização são recusados. O kit marca a cobertura como `operator_declared_aggregate`, sem inferir autenticidade ou capturar nada da rede. A demo usa este mesmo formato com números fictícios.

## Painel REST local

O coletor checa saúde e empresa por loopback e lê os totais de `/api/companies/:companyId/dashboard`. Usa estes campos da resposta para o resumo:

```json
{
  "schemaVersion": 1,
  "source": "paperclip-local-rest",
  "connection": {"companyId": "11111111-1111-4111-8111-111111111111"},
  "dashboard": {
    "companyId": "11111111-1111-4111-8111-111111111111",
    "tasks": {"open": 5, "inProgress": 2, "blocked": 1, "done": 4},
    "pendingApprovals": 2
  }
}
```

O resultado `dashboard` carrega os totais, sem IDs e sem os outros campos do painel. `open` já inclui `inProgress` e `blocked`; não some essas três colunas. `done` não inclui tarefas canceladas. `pendingApprovals` é um total sem classificação por tipo. Campos de página e lista de aprovações ficam indisponíveis nesse formato. Os números precisam ser inteiros entre 0 e 1 bilhão, e `inProgress + blocked` não pode exceder `open`.

Não misture `dashboard` com páginas MCP no mesmo arquivo, nem inclua `scopes` na conexão REST. Veja o [cálculo do painel no Paperclip fixado](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/dashboard.ts).

## Captura manual pelo MCP nativo

Use esta opção se seu cliente local permitir salvar o resultado estruturado das ferramentas. Não copie tokens OAuth, cabeçalhos, logs de autenticação ou respostas de ferramentas de escrita. O kit não invoca essas ferramentas MCP. A busca nativa de tarefas pode acionar recuperação interna do Paperclip mesmo com concessão de leitura; se você precisa apenas de uma consulta passiva, prefira o painel agregado local.

1. Chame `paperclip_connection({})`. Confira se `scopes` contém exclusivamente `paperclip:read`. Use o `companyId` exato da resposta nas consultas seguintes.
2. Se precisar de aprovações, chame `paperclip_pending_approvals` com o mesmo `companyId`. As decisões continuam no Paperclip.
3. Use `taskPage` apenas para um recorte que você já tem. Não consulte busca ou detalhe de tarefas só para montar o resumo; no corte auditado essas rotas podem ter efeitos internos.
4. Em cada resposta bem-sucedida, use o objeto `structuredContent`. No JSON-RPC bruto ele fica em `result.structuredContent`. Se o cliente expuser apenas um bloco `text` com o mesmo objeto JSON, decodifique o JSON desse bloco. Não use respostas com `isError: true`. Se não conseguiu consultar uma fonte, omita o bloco correspondente; não substitua por `[]`.
5. Monte um arquivo local com a estrutura abaixo. Copie em `requestedCompanyId` o valor do argumento efetivamente usado em cada chamada. O esquema valida consistência, não a veracidade desse valor.

```json
{
  "schemaVersion": 1,
  "source": "paperclip-native-mcp",
  "connection": {
    "companyId": "11111111-1111-4111-8111-111111111111",
    "scopes": ["paperclip:read"]
  },
  "taskPage": {
    "requestedCompanyId": "11111111-1111-4111-8111-111111111111",
    "result": {"limit": 30, "offset": 0, "tasks": []}
  },
  "pendingApprovals": {
    "requestedCompanyId": "11111111-1111-4111-8111-111111111111",
    "result": {"approvals": []}
  }
}
```

Os valores acima são ilustrativos. Em uma captura real, `connection` recebe o objeto de conexão; `taskPage.result` recebe um recorte anterior, se disponível; `pendingApprovals.result` recebe a resposta de aprovações. `taskPage` e `pendingApprovals` são opcionais. Campos extras das respostas podem ser descartados **antes** de salvar o arquivo, desde que se preserve:

- Conexão MCP: `companyId`, `scopes` e, se copiar o objeto `company`, seu `id`.
- Tarefas: `id`, `companyId`, `status`; preserve `limit` e `offset` da resposta. Toda linha deve carregar a mesma empresa da conexão.
- Aprovações: `id`, `status` igual a `pending`, `type` quando houver. O Paperclip não retorna `companyId` nessas linhas. A empresa associada vem do argumento declarado na captura. Se houver `companyId` na linha, ele também precisa coincidir.

## Como interpretar o resumo

- `state: "unavailable"` indica fonte ausente. `state: "available", rows: 0` indica lista vazia no recorte recebido.
- `coverage: "single_page_only"` limita as contagens às linhas dessa página; `atPageLimit: true` indica que ela atingiu o limite. Mesmo abaixo do limite, o kit não certifica total, ausência de filtros ou atualidade.
- Os totais de aprovação representam apenas as linhas da resposta. `binding: "declared_request_company"` explicita que a associação à empresa veio da captura, não da linha retornada.
- Status ou tipo ausente/desconhecido vira contagem `unknown`. O valor original não sai no resumo.
- O resumo descarta IDs, nomes, títulos, descrições, comentários, links, tokens e logs. Isso é minimização, não uma garantia de anonimato: contagens podem revelar atividade em empresas pequenas.
- O módulo não altera o Paperclip. A indicação `actionsExecuted: false` se refere à geração deste resumo, não ao histórico dos agentes ou aos efeitos internos de uma captura feita antes dela.

Entrada: até 256 KiB de JSON UTF-8, profundidade de até 32 objetos/arrays, 25.000 nós, até 100 tarefas (respeitando `limit`) e 100 aprovações. Chaves JSON duplicadas, IDs repetidos e empresas divergentes são rejeitados. O erro tem código fixo e não repete o conteúdo de entrada. Não conte com a remoção de campos extras para justificar o envio do arquivo bruto a outro serviço.

Referência do contrato: Paperclip `v2026.1106.0`, commit `d69631b01b9c658f80bf8bed389863dce82643e1`: [projeções de resposta](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/public-mcp/capabilities.ts), [campos de tarefas e limites](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/services/public-mcp/contracts.ts), [envelope das tools](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/server/src/routes/public-mcp.ts) e [tipos e estados](https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/packages/shared/src/constants.ts).
