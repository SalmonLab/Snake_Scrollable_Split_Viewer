(function () {
  const STYLE_ID = "splitstream-column-style";
  const TAG_CLASS = "splitstream-root";
  const SIDE_PADDING_PX = 30;
  const SEPARATOR_PX = 4;

  function buildCss(columns) {
    return `
      html.${TAG_CLASS},
      body.${TAG_CLASS} {
        margin: 0 !important;
        width: 100% !important;
        max-width: none !important;
        box-sizing: border-box !important;
      }

      html.${TAG_CLASS} {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 0 !important;
      }

      body.${TAG_CLASS} {
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

      body.${TAG_CLASS} img,
      body.${TAG_CLASS} video,
      body.${TAG_CLASS} iframe,
      body.${TAG_CLASS} canvas {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
  }

  function applyColumns(columns, cssText) {
    const docEl = document.documentElement;
    const body = document.body;
    if (!docEl || !body) return;

    docEl.classList.add(TAG_CLASS);
    body.classList.add(TAG_CLASS);

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.type = "text/css";
      document.head.appendChild(style);
    }

    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) {
      styleEl.textContent = cssText || buildCss(columns);
    }
  }

  function clearColumns() {
    const docEl = document.documentElement;
    const body = document.body;
    if (docEl) {
      docEl.classList.remove(TAG_CLASS);
    }
    if (body) {
      body.classList.remove(TAG_CLASS);
    }
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.textContent = "";
  }

  chrome.runtime.sendMessage({ type: "get-columns" }, (response) => {
    const columns = response && Number(response.columns) ? Number(response.columns) : 2;
    if (columns === 1) {
      clearColumns();
      return;
    }
    applyColumns(columns, buildCss(columns));
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === "apply-columns" && message.shouldApply) {
      applyColumns(message.columns, message.css);
      return;
    }

    if (message.type === "apply-columns" && !message.shouldApply) {
      clearColumns();
      return;
    }
  });
})();
