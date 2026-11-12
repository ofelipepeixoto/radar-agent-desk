"use strict";

const localOrigins = new Set([
  "http://localhost:3100",
  "http://127.0.0.1:3100",
  "http://localhost:4310",
  "http://127.0.0.1:4310",
]);

function allowedTab(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && localOrigins.has(url.origin) && !url.username && !url.password;
  } catch {
    return false;
  }
}

const badgeStates = {
  applied: ["PT", "Rótulos em português. Clique para voltar ao original."],
  restored: ["", "Rótulos originais. Clique para traduzir."],
  refused: ["!", "Abra o Paperclip local nas portas 3100 ou 4310 e tente de novo."],
  unmatched: ["!", "A página não tem rótulos reconhecidos. Abra o painel ou a visão geral do agente."],
  error: ["!", "Não foi possível traduzir esta aba. Atualize a página e tente de novo."],
};

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  if (!Number.isSafeInteger(tabId) || tabId < 0) return;
  let status = "refused";
  if (allowedTab(tab.url)) {
    try {
      const [execution] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: ["translate.js"],
        world: "ISOLATED",
      });
      status = execution?.result;
    } catch {
      status = "error";
    }
  }
  const [text, title] = Object.hasOwn(badgeStates, status) ? badgeStates[status] : badgeStates.error;
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setTitle({ tabId, title }),
  ]);
});
