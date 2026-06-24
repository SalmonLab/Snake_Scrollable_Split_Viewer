async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

const columnCountSelect = document.getElementById("columnCount");
const applyBtn = document.getElementById("applyBtn");
const statusEl = document.getElementById("status");

async function loadCurrentSetting() {
  const tab = await getActiveTab();
  if (!tab) {
    statusEl.textContent = "no active tab";
    return;
  }

  const response = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "get-columns", tabId: tab.id }, resolve)
  );
  const columns = response && Number.isFinite(response.columns) ? Number(response.columns) : 1;
  const normalizedColumns = (columns === 1 || columns === 2 || columns === 3) ? columns : 1;
  columnCountSelect.value = String(normalizedColumns);
  statusEl.textContent = normalizedColumns === 1 ? "current: off" : `current: ${normalizedColumns} columns`;
}

applyBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab) {
    statusEl.textContent = "no active tab";
    return;
  }
  const columns = Number(columnCountSelect.value);
  const message = columns === 1
    ? { type: "clear-columns", tabId: tab.id }
    : { type: "set-columns", tabId: tab.id, columns };
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
  if (response && response.ok) {
    statusEl.textContent = columns === 1 ? "applied: off" : `applied: ${columns} columns`;
  } else {
    statusEl.textContent = `failed`;
  }
});

loadCurrentSetting();
