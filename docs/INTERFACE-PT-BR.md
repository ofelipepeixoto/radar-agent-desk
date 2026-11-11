# Rótulos em português no Paperclip local

O **Radar Agent Desk** é o kit. O painel de agentes que aparece no navegador é outro programa, o **Paperclip**. Na versão estável v2026.1106.0, verificada em 11/11/2026, o [Paperclip inicia em inglês][inicialização]. O [catálogo pt-BR][catálogo] dessa versão contém apenas as três mensagens da tela inicial sem empresas. A [proposta de seletor oficial][seletor] ainda está aberta; mudar o idioma preferido do navegador não ativa um seletor no Paperclip.

## Chrome: tradução local e parcial

A extensão deste repositório traduz **rótulos selecionados** da navegação e da visão geral de agentes. Ela não traduz tarefas, instruções, nomes, logs, formulários nem todas as telas. Também não altera a instalação do Paperclip, a conta, os agentes ou o banco de dados.

1. Baixe o código desta branch ou use o clone no Windows. A pasta a abrir é `extras/paperclip-ptbr` e precisa conter `manifest.json`, `background.js` e `translate.js`. Se o clone está no Ubuntu, abra a pasta no Explorador com `explorer.exe .` a partir da raiz do clone. Se o Chrome não aceitar o caminho do WSL, copie **só** a pasta da extensão para uma pasta do Windows.
2. No Chrome, abra `chrome://extensions`, ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha a pasta da extensão. Em um perfil gerenciado, essa opção pode ser bloqueada pela política.
3. Na aba do Paperclip local, abra o menu **Extensões** e clique em **Radar Agent Desk | Paperclip em português**. Na visão geral do agente, confira por exemplo **Painel**, **Visão geral** e **Atribuir tarefa**. A marca `PT` confirma que o último clique aplicou a tradução. Após recarregar, aplique de novo se os rótulos estiverem em inglês.
4. Para voltar ao original, clique de novo na extensão ou recarregue a aba. Ao trocar de tela sem recarregar, pode ser necessário desfazer e aplicar outra vez. Para remover de vez, desative a extensão em `chrome://extensions` e recarregue a aba.

A extensão usa `activeTab` e `scripting`: só age após o clique, na aba ativa e no quadro principal. Ela recusa endereços diferentes de `http://localhost:3100`, `http://127.0.0.1:3100` e os mesmos hosts na porta `4310`. Também confere o título e elementos específicos do painel. A identificação visual é uma verificação de compatibilidade, não uma prova criptográfica da origem. A extensão não tem chamadas de rede, armazenamento ou acesso permanente a sites. Nenhum botão do Paperclip é clicado. Não use a tradução parcial como base para interpretar ações críticas se o rótulo original ou o contexto estiver em dúvida.

## Alternativas do navegador

- O [tradutor do Chrome][chrome] pode traduzir a página pelo menu do botão direito ou pelo ícone na barra de endereços. Ele usa o [serviço Google Translate][chromium]. Use em uma página de teste sem dados privados, pois o conteúdo a traduzir pode sair do computador.
- Se você já usa Firefox, a [tradução integrada][firefox] processa o conteúdo no próprio dispositivo após baixar os pacotes de idioma. Confirme que o par inglês para português aparece no seu Firefox. Esse modo também é tradução do navegador, sem mudar o idioma do Paperclip.

## Teste no repositório

```bash
node --test test/paperclip-ptbr.test.mjs
```

O teste usa uma página sintética e verifica a barreira de origem, a ativação por clique, a seleção de rótulos e a reversão. Não conecta à instalação de uma pessoa nem lê dados reais.

[inicialização]: https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/ui/src/i18n/index.ts
[catálogo]: https://github.com/paperclipai/paperclip/blob/d69631b01b9c658f80bf8bed389863dce82643e1/ui/src/i18n/locales/pt-BR.json
[seletor]: https://github.com/paperclipai/paperclip/pull/16921
[chrome]: https://support.google.com/chrome/answer/173424?hl=pt-BR
[chromium]: https://www.chromium.org/developers/design-documents/translate/
[firefox]: https://support.mozilla.org/pt-BR/kb/traducao-pagina-inteira-firefox
