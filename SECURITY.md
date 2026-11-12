# Limites de segurança

- O modo offline lê contagens em JSON ou CSV, com formato definido e sem rede. Ele não autentica a origem nem autoriza ações. Use dados fictícios em exemplos e relatos públicos.
- Use a atualização mais recente da linha Node.js 24 LTS. A [24.22.3](https://nodejs.org/pt-br/blog/release/v24.22.3) era a atualização da linha na revisão de segurança. Confira `node --version` no terminal em que executa o kit.
- Guarde entradas e saídas em diretórios privados do seu usuário (`0700` em Ubuntu/WSL2), sem links simbólicos no caminho. Mantenha essas pastas fora de áreas graváveis por outras contas e não as mova ou substitua enquanto o kit estiver em execução. As checagens de caminho não garantem segurança contra alterações concorrentes em um diretório controlado por terceiros.

- A captura é um cliente local, sem servidor próprio. Usa HTTP em `127.0.0.1`, porta numérica e rotas GET fixas. Não segue redirecionamentos, não usa cookies ou tokens, limita resposta e tempo e confere o modo local privado e a versão reportada. Uma resposta local pode ser forjada por outro processo: isso não é atestação de origem.
- O kit não aciona tarefas ou aprovações. Ele evita as rotas de lista/detalhe que podem reconciliar recuperação. GET não garante ausência de efeitos internos no upstream: com supervisor de desenvolvimento configurado, por exemplo, o health pode inicializar a configuração experimental. O roteiro usa o pacote npm sem supervisor de desenvolvimento.
- `local_trusted` é autoridade ambiente no Paperclip. O kit se limita a ler, mas esse modo **não autentica** quem consegue chegar ao Paperclip. Não exponha a porta à rede, pelo Traefik ou por túnel.
- O arquivo de saída usa contagens e códigos fixos; sem nomes, texto livre, IDs ou configurações. Não confunda redução de dados com anonimato. Não anexe export bruto, logs, banco ou credenciais ao ChatGPT.
- O ZIP do plugin contém instruções e a licença MIT. Não adiciona ferramentas, não controla permissões do servidor e não garante que o ChatGPT obedeça sozinho a uma política. Para conexão nativa, a autorização de leitura deve ser aplicada pelo Paperclip, empresa por empresa.
- A revisão do lockfile upstream `d69631b0` encontrou avisos críticos em `better-auth`, `proxy-addr` e `dompurify`. O scan separado da instalação npm resolveu as duas últimas em versões corrigidas e manteve o [aviso crítico em `better-auth`](https://github.com/advisories/GHSA-965c-763c-88jm). O impacto na configuração avaliada não foi demonstrado. O Paperclip `2026.1106.0` permanece restrito a laboratório em loopback com dados fictícios. Nenhuma versão estável corrigida foi homologada para o adaptador. Antes de preparar acesso remoto, verifique uma versão corrigida e repita o scan e os testes de autenticação.
- O kit não inicia agentes, aprova solicitações ou chama modelos. Instalar e executar agentes no Paperclip é uma ação separada, com seus próprios acessos e limites de custo.

## Relatar uma vulnerabilidade

Use o [formulário privado do GitHub](https://github.com/ofelipepeixoto/radar-agent-desk/security/advisories/new), também disponível em **Security → Advisories → Report a vulnerability**. Informe o commit ou a versão, o ambiente e como reproduzir com dados fictícios. Não publique tokens, dados reais, bancos nem detalhes de exploração em issues públicas.
