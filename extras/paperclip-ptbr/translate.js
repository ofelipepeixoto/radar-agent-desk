(() => {
  "use strict";

  // Recheck after injection: the user may have navigated after clicking.
  const origins = new Set([
    "http://localhost:3100", "http://127.0.0.1:3100",
    "http://localhost:4310", "http://127.0.0.1:4310",
  ]);
  const current = new URL(location.href);
  if (current.protocol !== "http:" || !origins.has(current.origin) ||
      current.username || current.password || window !== window.top) {
    return "refused";
  }

  // This state is held only in the extension's isolated world, for this document.
  const undoKey = Symbol.for("radar-agent-desk.paperclip-ptbr.undo.v1");
  if (typeof globalThis[undoKey] === "function") {
    globalThis[undoKey]();
    delete globalThis[undoKey];
    return "restored";
  }

  const navRoutes = [
    ["search", "Search", "Buscar"], ["dashboard", "Dashboard", "Painel"],
    ["inbox", "Inbox", "Caixa de entrada"], ["issues", "Tasks", "Tarefas"],
    ["projects", "Projects", "Projetos"], ["routines", "Routines", "Rotinas"],
    ["artifacts", "Artifacts", "Artefatos"], ["agents", "Agents", "Agentes"],
    ["agents/all", "See all agents", "Ver todos os agentes"], ["skills", "Skills", "Habilidades"],
    ["apps", "Connectors", "Conectores"], ["activity", "Audit", "Auditoria"],
    ["activity", "Activity", "Atividade"], ["company/settings", "Settings", "Configurações"],
  ];
  const agentRoutes = [
    ["overview", "Overview", "Visão geral"], ["instructions", "Instructions", "Instruções"],
    ["skills", "Skills", "Habilidades"], ["runtime", "Harness / Runtime", "Ambiente de execução"],
    ["secrets", "Secrets & variables", "Segredos e variáveis"], ["secrets", "Secrets", "Segredos"],
    ["tools", "Tools", "Ferramentas"], ["channels", "Channels", "Canais"],
    ["permissions", "Permissions / Trust", "Permissões / Confiança"],
    ["api-keys", "API Keys", "Chaves de API"], ["revisions", "Revisions", "Revisões"],
  ];
  const auditRoutes = [
    ["activity", "Activity", "Atividade"], ["activity/runs", "Runs", "Execuções"],
    ["activity/costs", "Costs", "Custos"], ["activity/budgets", "Budgets", "Orçamentos"],
  ];

  function sameOriginLink(link) {
    try {
      const href = link.getAttribute("href");
      if (!href) return null;
      const url = new URL(href, current.href);
      return url.origin === current.origin && !url.username && !url.password ? url : null;
    } catch {
      return null;
    }
  }

  function routeEquals(url, route) {
    const path = url.pathname.split("/").filter(Boolean);
    const parts = route.split("/");
    return (path.length === parts.length || path.length === parts.length + 1) &&
      path.slice(-parts.length).every((part, i) => part === parts[i]);
  }

  const main = document.querySelector("#root main#main-content");
  const primary = [...document.querySelectorAll("#root aside > nav")].find((nav) => {
    const urls = [...nav.querySelectorAll("a[href]")].map(sameOriginLink).filter(Boolean);
    return ["dashboard", "search"].every((route) => urls.some((url) => routeEquals(url, route)));
  });
  // Stable upstream signals, not a security attestation. Refuse unrecognized layouts.
  if (!/(?:^|[\s•·|])Paperclip$/.test(document.title.trim()) ||
    !document.querySelector('meta[name="apple-mobile-web-app-title"][content="Paperclip"]') ||
    !main || !primary) return "refused";

  const edits = [];
  const forbidden = 'input, textarea, select, [contenteditable], [role="textbox"], code, pre, [data-slot="markdown-body"]';
  const dictionary = (entries) => new Map(entries);
  function translateText(element, labels, spans = false) {
    if (element.closest(forbidden)) return;
    const containers = spans ? [element, ...[...element.children].filter((child) => child.tagName === "SPAN")] : [element];
    for (const container of containers) {
      if (container.closest(forbidden)) continue;
      for (const node of container.childNodes) {
        if (node.nodeType !== 3) continue;
        const original = node.nodeValue;
        const key = original.trim();
        if (!labels.has(key) || edits.length >= 160) continue;
        const first = original.indexOf(key);
        const translated = original.slice(0, first) + labels.get(key) + original.slice(first + key.length);
        node.nodeValue = translated;
        edits.push({ node, original, translated });
      }
    }
  }

  function translateElements(root, selector, entries, spans = false) {
    const labels = dictionary(entries);
    for (const element of root.querySelectorAll(selector)) translateText(element, labels, spans);
  }

  function translateLinks(root, routes, matches) {
    for (const link of root.querySelectorAll("a[href]")) {
      const url = sameOriginLink(link);
      if (!url) continue;
      const labels = dictionary(routes.filter(([route]) => matches(url, route)).map(([, ...pair]) => pair));
      if (labels.size) translateText(link, labels, true);
    }
  }

  translateLinks(primary, navRoutes, routeEquals);
  translateElements(primary, 'button[data-slot="icon-button"]', [["New Task", "Nova tarefa"]], true);
  translateElements(primary, '[data-slot="sidebar-group-label"]', [
    ["Work", "Trabalho"], ["Org", "Organização"], ["Organization", "Organização"],
    ["Agents", "Agentes"], ["Projects", "Projetos"], ["Recent Tasks", "Tarefas recentes"],
  ]);

  const agentPath = /^(?:\/[^/]+)?\/agents\/([^/]+)(?:\/([^/]+))?\/?$/;
  const [, agentRef, agentView] = current.pathname.match(agentPath) ?? [];
  const isAgentDetail = agentRef && !["all", "new"].includes(agentRef) &&
    (!agentView || agentRoutes.some(([route]) => route === agentView));
  if (isAgentDetail) {
    const localAgentLink = (url, route) => {
      const [, ref, view] = url.pathname.match(agentPath) ?? [];
      return ref === agentRef && view === route;
    };
    const scopedAuditLink = (url, route) => routeEquals(url, route) && url.searchParams.has("agentId");
    for (const nav of document.querySelectorAll('#root nav[data-slot="contextual-sidebar-nav"]')) {
      const agentNav = [...nav.querySelectorAll("a[href]")].some((link) => {
        const url = sameOriginLink(link);
        return url && localAgentLink(url, "overview");
      });
      if (!agentNav) continue;
      translateLinks(nav, agentRoutes, localAgentLink);
      translateLinks(nav, auditRoutes, scopedAuditLink);
      translateElements(nav, '[data-slot="contextual-sidebar-section-label"]', [
        ["Agent", "Agente"], ["Runtime", "Execução"], ["Governance", "Governança"], ["Audit", "Auditoria"],
      ]);
    }

    // Preserve agent names and values. Match actions only in the agent header.
    for (const header of main.querySelectorAll("header")) {
      if (!header.querySelector('div[role="img"][aria-label$=" avatar"]') || !header.querySelector("h1")) continue;
      translateElements(header, 'button[data-slot="button"]', [
        ["Assign Task", "Atribuir tarefa"], ["Run now", "Executar agora"],
        ["Pause", "Pausar"], ["Resume", "Retomar"],
      ], true);
    }
    const headingPairs = agentRoutes.filter(([route]) => route === (agentView ?? "overview"))
      .map(([, ...pair]) => pair);
    translateElements(main, "h2.text-xl.font-semibold", headingPairs);

    const sections = [
      ["agent-identity-heading", "Identity", "Identidade"],
      ["agent-runtime-heading", "Harness / Runtime", "Ambiente de execução"],
      ["agent-capabilities-heading", "Capabilities", "Capacidades"],
      ["agent-skills-heading", "Skills", "Habilidades"],
      ["agent-recent-tasks-heading", "Recent Tasks", "Tarefas recentes"],
      ["agent-audit-links-heading", "Audit", "Auditoria"],
    ];
    for (const [id, from, to] of sections) {
      const section = main.querySelector(`section[aria-labelledby="${id}"]`);
      if (!section) continue;
      translateElements(section, `h3#${id}`, [[from, to]]);
      if (id === "agent-identity-heading" || id === "agent-runtime-heading") {
        translateElements(section, "div.space-y-3 > div > span:first-child", [
          ["Role", "Função"], ["Title", "Título"], ["Reports to", "Responde a"],
          ["Direct reports", "Subordinados diretos"], ["Created by", "Criado por"],
          ["Public key", "Chave pública"], ["Adapter", "Adaptador"], ["Model", "Modelo"],
          ["Session", "Sessão"], ["Last run", "Última execução"], ["Execution", "Execução"], ["Usage", "Uso"],
        ]);
      }
      if (id === "agent-runtime-heading" || id === "agent-skills-heading") {
        const route = id === "agent-runtime-heading" ? "runtime" : "skills";
        translateLinks(section, [[route, ...(route === "runtime" ? ["Configure", "Configurar"] : ["Manage", "Gerenciar"])]], localAgentLink);
      }
      if (id === "agent-recent-tasks-heading") {
        translateLinks(section, [["issues", "See All →", "Ver tudo →"], ["issues", "See All", "Ver tudo"]],
          (url, route) => routeEquals(url, route) && url.searchParams.has("participantAgentId"));
      }
      if (id === "agent-audit-links-heading") {
        translateLinks(section, auditRoutes.map(([route, label, pt]) => [route, label.toLowerCase(), pt]), scopedAuditLink);
      }
    }
  }

  if (!edits.length) return "unmatched";
  globalThis[undoKey] = () => {
    // React may have changed a translated label in the meantime; don't revert it.
    for (const { node, original, translated } of edits) {
      if (node.isConnected && node.nodeValue === translated) node.nodeValue = original;
    }
  };
  return "applied";
})();
