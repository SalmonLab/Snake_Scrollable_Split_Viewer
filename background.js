const KEY_TAB_SETTINGS = "splitstream_tab_settings";

const DEFAULT_COLUMNS = 2;
const SIDE_PADDING_PX = 30;
const SEPARATOR_PX = 4;

function isValidTabId(tabId) {
  return Number.isInteger(tabId) && tabId >= 0;
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
      -webkit-column-count: ${columns} !important;
      column-count: ${columns} !important;
      -webkit-column-fill: auto !important;
      column-fill: auto !important;
      -webkit-column-gap: ${SEPARATOR_PX}px !important;
      column-gap: ${SEPARATOR_PX}px !important;
      -webkit-column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
      column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
      overflow-wrap: anywhere !important;
      min-height: 0 !important;
    }

    body.splitstream-root img,
    body.splitstream-root video,
    body.splitstream-root iframe,
    body.splitstream-root canvas {
      max-width: 100% !important;
      height: auto !important;
    }
  `;
}

async function applyToTab(tabId, columns) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "apply-columns",
      columns,
      css: getCss(columns),
      shouldApply: true
    });
  } catch {
    // The tab may not have a content script yet or is not in a normal frame.
  }
}

async function updateTabSetting(tabId, columns) {
  const settings = await getStorage();
  settings[tabId] = columns;
  await setStorage({ [KEY_TAB_SETTINGS]: settings });
  await applyToTab(tabId, columns);
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
  const columns = Number(message.columns);
  if (!isValidTabId(tabId) || (columns !== 2 && columns !== 3)) {
    sendResponse({ ok: false, error: "invalid request" });
    return;
  }
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
    sendResponse({ columns: settings[tabId] || DEFAULT_COLUMNS });
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
