import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";

const asset = (name) => readFileSync(new URL(`../extras/paperclip-ptbr/${name}`, import.meta.url), "utf8");
const translation = asset("translate.js");
const manifest = JSON.parse(asset("manifest.json"));

function element(tagName, content, attributes = {}) {
  const queries = new Map();
  const node = { nodeType: 3, nodeValue: content, isConnected: true };
  return {
    tagName, node, childNodes: content === undefined ? [] : [node], children: [],
    getAttribute: (key) => attributes[key] ?? null,
    closest: () => attributes.excluded ? {} : null,
    querySelectorAll: (selector) => queries.get(selector) ?? [],
    querySelector: (selector) => queries.get(selector)?.[0] ?? null,
    register: (selector, ...nodes) => queries.set(selector, nodes),
  };
}

function documentFixture({ title = "Agente fictício • Agents • Paperclip", href, topFrame = true, meta = true, validLayout = true } = {}) {
  const makeLink = (label, link) => {
    const anchor = element("A", undefined, { href: link });
    anchor.children.push(element("SPAN", label));
    return anchor;
  };
  const primary = element("NAV");
  const search = makeLink("Search", "/demo/search");
  const dashboard = makeLink(" Dashboard ", "/demo/dashboard");
  const tasks = makeLink("Tasks", "/demo/issues");
  const external = makeLink("Dashboard", "http://not-paperclip.example/dashboard");
  const namedAgent = makeLink("Agents", "/demo/agents/exemplo");
  const titledTask = makeLink("Tasks", "/demo/issues/DEMO-1");
  primary.register("a[href]", ...[search, dashboard, tasks, external, namedAgent, titledTask].filter((node) => validLayout || node !== search));
  const newTask = element("BUTTON", "New Task");
  const editors = element("BUTTON", "New Task", { excluded: true });
  const work = element("SPAN", "Work");
  primary.register('button[data-slot="icon-button"]', newTask, editors);
  primary.register('[data-slot="sidebar-group-label"]', work);

  const main = element("MAIN");
  const header = element("HEADER");
  const agentName = element("H1", "Overview");
  const run = element("BUTTON");
  const runLabel = element("SPAN", "Run now");
  run.children.push(runLabel);
  const pause = element("BUTTON", "Pause");
  header.register("h1", agentName);
  header.register('div[role="img"][aria-label$=" avatar"]', element("DIV"));
  header.register('button[data-slot="button"]', run, pause);
  main.register("header", header);
  const overview = element("H2", "Overview");
  main.register("h2.text-xl.font-semibold", overview);

  const sideAgent = element("NAV");
  const overviewLink = makeLink("Overview", "/demo/agents/exemplo/overview");
  const namedPlugin = makeLink("Skills", "/demo/agents/exemplo/plugin%3Afixture%3Askill");
  const otherAgent = makeLink("Overview", "/demo/agents/outro/overview");
  const skills = makeLink("Skills", "/demo/agents/exemplo/skills");
  sideAgent.register("a[href]", overviewLink, namedPlugin, otherAgent, skills);

  const runtime = element("SECTION");
  const runtimeHeading = element("H3", "Harness / Runtime");
  const roleLabel = element("SPAN", "Role");
  const agentValue = element("SPAN", "Role");
  runtime.register("h3#agent-runtime-heading", runtimeHeading);
  runtime.register("div.space-y-3 > div > span:first-child", roleLabel);
  main.register('section[aria-labelledby="agent-runtime-heading"]', runtime);
  const recent = element("SECTION");
  const seeAll = element("A", "See All ", { href: "/demo/issues?participantAgentId=ficticio" });
  const arrow = { nodeType: 3, nodeValue: "→", isConnected: true };
  seeAll.childNodes.push(arrow);
  recent.register("a[href]", seeAll);
  main.register('section[aria-labelledby="agent-recent-tasks-heading"]', recent);
  const caps = element("SECTION");
  const markdown = element("P", "No capability summary has been added.");
  caps.register("p", markdown);
  main.register('section[aria-labelledby="agent-capabilities-heading"]', caps);

  const document = Object.assign(element("DOCUMENT"), { title });
  document.register("#root aside > nav", primary);
  document.register("#root main#main-content", main);
  document.register('#root nav[data-slot="contextual-sidebar-nav"]', sideAgent);
  if (meta) document.register('meta[name="apple-mobile-web-app-title"][content="Paperclip"]', element("META"));
  const window = {};
  window.top = topFrame ? window : {};
  const context = createContext({ URL, document, location: { href: href ?? "http://localhost:3100/demo/agents/exemplo/overview" }, window });
  return { context, dashboard, tasks, external, namedAgent, titledTask, newTask, editors, work, agentName,
    runLabel, pause, overview, overviewLink, namedPlugin, otherAgent, skills, runtimeHeading, roleLabel, agentValue, markdown, seeAll, arrow };
}

const text = (anchor) => anchor.children[0].node.nodeValue;
const run = ({ context }) => runInContext(translation, context, { timeout: 1000 });

test("PT-BR extension has only user-initiated, network-free permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.toSorted(), ["activeTab", "scripting"]);
  for (const key of ["host_permissions", "optional_host_permissions", "content_scripts", "externally_connectable", "web_accessible_resources"]) {
    assert.ok(!(key in manifest), key);
  }
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
});

test("only injects after user click on an allowed loopback tab and only into its top frame", async () => {
  const injections = [];
  const badges = [];
  let click;
  const chrome = {
    action: {
      onClicked: { addListener: (listener) => { click = listener; } },
      setBadgeText: async (value) => { badges.push(value.text); },
      setTitle: async () => {},
    },
    scripting: { executeScript: async (options) => { injections.push(options); return [{ result: "applied" }]; } },
  };
  const context = createContext({ chrome, URL });
  runInContext(asset("background.js"), context, { timeout: 1000 });
  assert.equal(injections.length, 0);
  for (const url of [undefined, "https://localhost:3100/", "http://localhost:3200/",
    "http://localhost.example.com:3100/", "http://u:p@localhost:3100/", "http://127.0.0.2:3100/", "file:///tmp/Paperclip",
    "blob:http://127.0.0.1:3100/00000000-0000-0000-0000-000000000001"]) {
    await click({ id: 12, url });
  }
  assert.equal(injections.length, 0);
  assert.equal(badges.at(-1), "!");
  await click({ id: 12, url: "http://127.0.0.1:4310/demo/agents/exemplo/overview" });
  assert.equal(injections.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(injections[0])), {
    target: { tabId: 12, frameIds: [0] }, files: ["translate.js"], world: "ISOLATED",
  });
  assert.equal(badges.at(-1), "PT");
});

test("rechecks origin, tab frame and Paperclip layout before touching the DOM", () => {
  for (const options of [
    { href: "http://example.com:3100/demo/agents/exemplo/overview" },
    { href: "http://localhost:5100/demo/agents/exemplo/overview" },
    { href: "blob:http://127.0.0.1:3100/00000000-0000-0000-0000-000000000001" },
    { title: "Outra aplicação chamada NotPaperclip" }, { topFrame: false },
    { validLayout: false }, { meta: false },
  ]) {
    const fixture = documentFixture(options);
    assert.equal(run(fixture), "refused", JSON.stringify(options));
    assert.equal(text(fixture.dashboard), " Dashboard ");
  }
});

test("translates static labels while preserving names, task titles, values and foreign links", () => {
  const fixture = documentFixture();
  assert.equal(run(fixture), "applied");
  assert.equal(text(fixture.dashboard), " Painel ");
  assert.equal(text(fixture.tasks), "Tarefas");
  assert.equal(fixture.newTask.node.nodeValue, "Nova tarefa");
  assert.equal(fixture.work.node.nodeValue, "Trabalho");
  assert.equal(fixture.runLabel.node.nodeValue, "Executar agora");
  assert.equal(fixture.pause.node.nodeValue, "Pausar");
  assert.equal(fixture.overview.node.nodeValue, "Visão geral");
  assert.equal(text(fixture.overviewLink), "Visão geral");
  assert.equal(text(fixture.skills), "Habilidades");
  assert.equal(fixture.runtimeHeading.node.nodeValue, "Ambiente de execução");
  assert.equal(fixture.roleLabel.node.nodeValue, "Função");
  assert.equal(fixture.agentName.node.nodeValue, "Overview");
  assert.equal(fixture.agentValue.node.nodeValue, "Role");
  assert.equal(fixture.seeAll.node.nodeValue, "Ver tudo ");
  assert.equal(fixture.arrow.nodeValue, "→");
  assert.equal(fixture.markdown.node.nodeValue, "No capability summary has been added.");
  assert.equal(text(fixture.external), "Dashboard");
  assert.equal(text(fixture.namedAgent), "Agents");
  assert.equal(text(fixture.titledTask), "Tasks");
  assert.equal(text(fixture.otherAgent), "Overview");
  assert.equal(text(fixture.namedPlugin), "Skills");
  assert.equal(fixture.editors.node.nodeValue, "New Task");
});

test("second click restores only translated text still present in the document", () => {
  const fixture = documentFixture();
  assert.equal(run(fixture), "applied");
  fixture.pause.node.nodeValue = "Mudou durante a atualização";
  fixture.runLabel.node.isConnected = false;
  assert.equal(run(fixture), "restored");
  assert.equal(text(fixture.dashboard), " Dashboard ");
  assert.equal(fixture.pause.node.nodeValue, "Mudou durante a atualização");
  assert.equal(fixture.runLabel.node.nodeValue, "Executar agora");
  assert.equal(run(fixture), "applied");
});
