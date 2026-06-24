(function () {
  const STYLE_ID = "splitstream-column-style";
  const TAG_CLASS = "splitstream-root";
  const SIDE_PADDING_PX = 30;
  const SEPARATOR_PX = 4;

  let wheelHandler = null;
  let activeColumns = 2;

  function clamp(value, min, max) {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    return Math.min(Math.max(value, min), max);
  }

  function getScrollRoot() {
    const body = document.body;
    if (body && body.scrollHeight > body.clientHeight + 1) {
      return body;
    }
    return document.scrollingElement || document.documentElement || body;
  }

  function applyStyles(columns) {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.type = "text/css";
      document.head.appendChild(style);
    }

    style.textContent = `
      html.${TAG_CLASS},
      body.${TAG_CLASS} {
        margin: 0 !important;
        width: 100% !important;
        max-width: none !important;
        box-sizing: border-box !important;
      }

      html.${TAG_CLASS} {
        padding: 0 !important;
        width: 100% !important;
        min-width: 100% !important;
        height: 100vh !important;
        overflow-x: hidden !important;
        overflow-y: hidden !important;
      }

      body.${TAG_CLASS} {
        padding-left: ${SIDE_PADDING_PX}px !important;
        padding-right: ${SIDE_PADDING_PX}px !important;
        width: 100% !important;
        height: 100vh !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        -webkit-column-count: ${columns} !important;
        column-count: ${columns} !important;
        -webkit-column-fill: auto !important;
        column-fill: auto !important;
        -webkit-column-gap: ${SEPARATOR_PX}px !important;
        column-gap: ${SEPARATOR_PX}px !important;
        -webkit-column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
        column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
        box-sizing: border-box !important;
        background: transparent !important;
      }

      body.${TAG_CLASS} > * {
        max-width: 100% !important;
        width: auto !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      body.${TAG_CLASS} img,
      body.${TAG_CLASS} video,
      body.${TAG_CLASS} iframe,
      body.${TAG_CLASS} canvas {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
  }

  function clearStyles() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.textContent = "";

    const root = document.documentElement;
    const body = document.body;
    if (root) root.classList.remove(TAG_CLASS);
    if (body) body.classList.remove(TAG_CLASS);

    if (wheelHandler) {
      window.removeEventListener("wheel", wheelHandler, { capture: true });
      wheelHandler = null;
    }
  }

  function syncWheelToRoot() {
    if (wheelHandler) {
      window.removeEventListener("wheel", wheelHandler, { capture: true });
      wheelHandler = null;
    }

    const root = getScrollRoot();
    if (!root || !root.scrollTo) {
      return;
    }

    const applyScroll = (deltaY) => {
      const max = Math.max(0, root.scrollHeight - root.clientHeight);
      if (max <= 1) return;
      const next = clamp(root.scrollTop + deltaY, 0, max);
      root.scrollTop = next;
      document.body.scrollTop = next;
      document.documentElement.scrollTop = next;
    };

    wheelHandler = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (!event.deltaY) return;
      event.preventDefault();
      applyScroll(event.deltaY);
    };

    window.addEventListener("wheel", wheelHandler, {
      capture: true,
      passive: false,
    });
  }

  function applyColumns(columns) {
    activeColumns = Number(columns) || 2;
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    root.classList.add(TAG_CLASS);
    body.classList.add(TAG_CLASS);

    applyStyles(activeColumns);
    syncWheelToRoot();
  }

  function clearColumns() {
    clearStyles();
  }

  chrome.runtime.sendMessage({ type: "get-columns" }, (response) => {
    const columns = response && Number(response.columns) ? Number(response.columns) : 2;
    if (columns === 1) {
      clearColumns();
      return;
    }
    applyColumns(columns);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === "apply-columns") {
      if (!message.shouldApply || message.columns === 1) {
        clearColumns();
      } else {
        applyColumns(message.columns);
      }
      return;
    }
  });
})();

