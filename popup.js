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
  const columns = response && Number(response.columns) === 2 ? 2 : 2;
  columnCountSelect.value = String(columns);
  statusEl.textContent = `current: ${columns} columns`;
}

applyBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab) {
    statusEl.textContent = "no active tab";
    return;
  }
  const columns = 2;
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "set-columns",
        tabId: tab.id,
        columns
      },
      resolve
    );
  });
  if (response && response.ok) {
    statusEl.textContent = `applied: ${columns} columns`;
  } else {
    statusEl.textContent = `failed`;
  }
});

loadCurrentSetting();
