const KEY_TAB_SETTINGS = "splitstream_tab_settings";

const DEFAULT_COLUMNS = 2;
const SIDE_PADDING_PX = 30;
const SEPARATOR_PX = 4;

function isValidTabId(tabId) {
  return Number.isInteger(tabId) && tabId >= 0;
}

function normalizeColumns(columns) {
  const value = Number(columns);
  return value === 2 ? 2 : DEFAULT_COLUMNS;
}

function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEY_TAB_SETTINGS], (result) => resolve(result[KEY_TAB_SETTINGS] || {}));
  });
}

function setStorage(next) {
  return new Promise((resolve) => {
    chrome.storage.local.set(next, resolve);
  });
}

function getCss(columns) {
  return `
    html.splitstream-root,
    body.splitstream-root {
      margin: 0 !important;
      width: 100% !important;
      max-width: none !important;
      box-sizing: border-box !important;
    }

    html.splitstream-root {
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding: 0 !important;
    }

    body.splitstream-root {
      padding-left: ${SIDE_PADDING_PX}px !important;
      padding-right: ${SIDE_PADDING_PX}px !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      width: 100vw !important;
      min-width: 100vw !important;
    }

      .splitstream-root .splitstream-target {
        position: relative !important;
        -webkit-column-count: ${columns} !important;
        column-count: ${columns} !important;
        -webkit-column-fill: auto !important;
        column-fill: auto !important;
        height: calc(100vh - ${SIDE_PADDING_PX * 2}px) !important;
        -webkit-column-gap: ${SEPARATOR_PX}px !important;
        column-gap: ${SEPARATOR_PX}px !important;
      -webkit-column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
      column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
      width: calc(100% - ${SIDE_PADDING_PX * 2}px) !important;
      max-width: none !important;
      box-sizing: border-box !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      overflow-wrap: anywhere !important;
      min-height: 0 !important;
    }

    .splitstream-root .splitstream-target * {
      max-width: 100% !important;
      width: 100% !important;
      min-width: 0 !important;
      overflow: visible !important;
    }

    .splitstream-root .splitstream-target img,
    .splitstream-root .splitstream-target video,
    .splitstream-root .splitstream-target iframe,
    .splitstream-root .splitstream-target canvas {
      max-width: 100% !important;
      height: auto !important;
    }
  `;
}

async function applyToTab(tabId, columns) {
  const nextColumns = normalizeColumns(columns);
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "apply-columns",
      columns: nextColumns,
      css: getCss(nextColumns),
      shouldApply: true
    });
  } catch {
    // The tab may not have a content script yet or is not in a normal frame.
  }
}

async function updateTabSetting(tabId, columns) {
  const settings = await getStorage();
  const nextColumns = normalizeColumns(columns);
  settings[tabId] = nextColumns;
  await setStorage({ [KEY_TAB_SETTINGS]: settings });
  await applyToTab(tabId, nextColumns);
}

async function clearTabSetting(tabId) {
  const settings = await getStorage();
  delete settings[tabId];
  await setStorage({ [KEY_TAB_SETTINGS]: settings });
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "apply-columns",
      shouldApply: false
    });
  } catch {
    // ignore
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "set-columns") {
    return;
  }
  const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
  if (!isValidTabId(tabId)) {
    sendResponse({ ok: false, error: "invalid request" });
    return;
  }
  const columns = normalizeColumns(message.columns);
  updateTabSetting(tabId, columns).then(() => {
    sendResponse({ ok: true, columns });
  });
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "clear-columns") {
    return;
  }
  const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
  if (!isValidTabId(tabId)) {
    sendResponse({ ok: false, error: "tab not found" });
    return;
  }
  clearTabSetting(tabId).then(() => sendResponse({ ok: true }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "get-columns") {
    return;
  }
  (async () => {
    const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
    if (!isValidTabId(tabId)) {
      sendResponse({ columns: DEFAULT_COLUMNS });
      return;
    }
    const settings = await getStorage();
    sendResponse({ columns: normalizeColumns(settings[tabId] || DEFAULT_COLUMNS) });
  })();
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  const settings = await getStorage();
  const columns = settings[tabId];
  if (!columns) return;
  applyToTab(tabId, columns);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const settings = await getStorage();
  if (settings[tabId] === undefined) return;
  delete settings[tabId];
  await setStorage({ [KEY_TAB_SETTINGS]: settings });
});
