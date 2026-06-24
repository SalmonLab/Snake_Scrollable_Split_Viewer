(() => {
  const STYLE_ID = "splitstream-snake-style";
  const ROOT_CLASS = "splitstream-root";
  const BODY_CLASS = "splitstream-root-active";
  const SIDE_PADDING_PX = 30;
  const SEPARATOR_PX = 4;

  const state = {
    active: false,
    columns: 2,
    scrollBase: 0,
    viewportHeight: 0,
    maxBaseScroll: 0,
    singleMaxScroll: 0,
    root: null,
    panes: [],
    wheelHandler: null,
    resizeHandler: null,
    styleEl: null,
    savedBodyHTML: "",
    savedBodyClassName: "",
    savedBodyStyle: "",
  };

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function setStyle() {
    if (state.styleEl) return;
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.documentElement.appendChild(styleEl);
    styleEl.textContent = `
      html, body {
        margin: 0 !important;
      }

      .${ROOT_CLASS} {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        align-items: stretch !important;
        box-sizing: border-box !important;
        padding: 0 ${SIDE_PADDING_PX}px !important;
        gap: ${SEPARATOR_PX}px !important;
        overflow: hidden !important;
        background: transparent !important;
      }

      .${BODY_CLASS} {
        width: 100vw !important;
        height: 100vh !important;
        overflow: hidden !important;
        padding: 0 !important;
      }

      .${ROOT_CLASS} .splitstream-column {
        position: relative !important;
        flex: 1 1 0 !important;
        min-width: 0 !important;
        max-width: none !important;
        min-height: 0 !important;
        overflow: hidden !important;
        background: transparent !important;
      }

      .${ROOT_CLASS} .splitstream-separator {
        width: ${SEPARATOR_PX}px !important;
        min-width: ${SEPARATOR_PX}px !important;
        max-width: ${SEPARATOR_PX}px !important;
        align-self: stretch !important;
        background: rgba(148, 163, 184, 0.35) !important;
      }

      .${ROOT_CLASS} .splitstream-scroll {
        position: absolute !important;
        inset: 0 !important;
        overflow: hidden !important;
        width: 100% !important;
        height: 100% !important;
      }

      .${ROOT_CLASS} .splitstream-scroll > * {
        margin: 0 !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        box-sizing: border-box !important;
      }

      .${ROOT_CLASS} .splitstream-scroll body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-height: 0 !important;
        box-sizing: border-box !important;
      }

      .${ROOT_CLASS} .splitstream-scroll img,
      .${ROOT_CLASS} .splitstream-scroll video,
      .${ROOT_CLASS} .splitstream-scroll iframe,
      .${ROOT_CLASS} .splitstream-scroll canvas {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
    state.styleEl = styleEl;
  }

  function removeStyle() {
    if (!state.styleEl) return;
    state.styleEl.remove();
    state.styleEl = null;
  }

  function isScrollElement(el) {
    return el && el.nodeType === Node.ELEMENT_NODE && el.classList && el.classList.contains("splitstream-scroll");
  }

  function removeBlockedNodes(root) {
    const blocked = root.querySelectorAll("script, noscript");
    blocked.forEach((item) => {
      item.remove();
    });
  }

  function createColumn(index) {
    const column = document.createElement("div");
    column.className = "splitstream-column";

    const scroller = document.createElement("div");
    scroller.className = "splitstream-scroll";
    scroller.setAttribute("data-splitstream-column", String(index));

    const clone = document.body.cloneNode(true);
    removeBlockedNodes(clone);
    clone.setAttribute("style", "margin:0 !important;padding:0 !important;");
    scroller.appendChild(clone);
    column.appendChild(scroller);
    state.panes.push({ column, scroller });

    return column;
  }

  function clampBaseScroll() {
    const maxScroll = Math.max(
      0,
      state.singleMaxScroll - (state.columns - 1) * state.viewportHeight
    );
    state.maxBaseScroll = clamp(state.maxBaseScroll, 0, maxScroll);
    state.scrollBase = clamp(state.scrollBase, 0, maxScroll);
    if (state.maxBaseScroll !== maxScroll) {
      state.maxBaseScroll = maxScroll;
    }
  }

  function applySyncedScroll() {
    state.panes.forEach((pane, index) => {
      const target = clamp(
        state.scrollBase + index * state.viewportHeight,
        0,
        state.singleMaxScroll
      );
      pane.scroller.scrollTop = target;
    });
  }

  function updateGeometry() {
    if (!state.active) return;
    state.viewportHeight = window.innerHeight;
    state.singleMaxScroll = 0;
    if (!state.panes.length || !state.panes[0].scroller.firstElementChild) return;
    const ref = state.panes[0].scroller.firstElementChild;
    state.singleMaxScroll = Math.max(0, ref.scrollHeight - state.viewportHeight);
    clampBaseScroll();
    applySyncedScroll();
  }

  function onWheel(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!event.deltaY) return;
    event.preventDefault();
    const next = clamp(state.scrollBase + event.deltaY, 0, state.maxBaseScroll);
    if (next === state.scrollBase) return;
    state.scrollBase = next;
    applySyncedScroll();
  }

  function activateScrollSync() {
    if (state.wheelHandler) {
      window.removeEventListener("wheel", state.wheelHandler, { capture: true });
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }

    state.wheelHandler = onWheel;
    window.addEventListener("wheel", state.wheelHandler, { capture: true, passive: false });

    state.resizeHandler = () => {
      updateGeometry();
    };
    window.addEventListener("resize", state.resizeHandler);
  }

  function disableScrollSync() {
    if (state.wheelHandler) {
      window.removeEventListener("wheel", state.wheelHandler, { capture: true });
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }
    state.wheelHandler = null;
    state.resizeHandler = null;
  }

  function clearSplit() {
    disableScrollSync();
    removeStyle();

    if (!state.active) {
      state.panes = [];
      state.maxBaseScroll = 0;
      state.singleMaxScroll = 0;
      state.scrollBase = 0;
      state.viewportHeight = 0;
      return;
    }

    state.panes = [];
    state.active = false;
    state.scrollBase = 0;
    state.viewportHeight = 0;
    state.maxBaseScroll = 0;
    state.singleMaxScroll = 0;

    const body = document.body;
    if (body) {
      body.classList.remove(BODY_CLASS);
      body.innerHTML = state.savedBodyHTML;
      body.className = state.savedBodyClassName;
      if (state.savedBodyStyle) {
        body.setAttribute("style", state.savedBodyStyle);
      } else {
        body.removeAttribute("style");
      }
    }
    // no additional root cleanup required
  }

  function applySplit(columns) {
    const body = document.body;
    if (!body) return;

    const originalHTML = body.innerHTML;
    const originalClass = body.className || "";
    const originalStyle = body.getAttribute("style") || "";

    if (state.active) {
      clearSplit();
    } else {
      disableScrollSync();
      removeStyle();
      state.panes = [];
      state.maxBaseScroll = 0;
      state.singleMaxScroll = 0;
      state.scrollBase = 0;
      state.viewportHeight = 0;
    }

    state.savedBodyHTML = originalHTML;
    state.savedBodyClassName = originalClass;
    state.savedBodyStyle = originalStyle;

    state.columns = Number(columns) || 2;
    state.active = true;
    state.scrollBase = 0;

    setStyle();

    body.classList.add(BODY_CLASS);

    const container = document.createElement("div");
    container.className = ROOT_CLASS;

    for (let i = 0; i < state.columns; i++) {
      if (i > 0) {
        const separator = document.createElement("div");
        separator.className = "splitstream-separator";
        container.appendChild(separator);
      }
      container.appendChild(createColumn(i));
    }

    body.innerHTML = "";
    body.appendChild(container);

    requestAnimationFrame(() => {
      updateGeometry();
      applyScrollSync();
    });

    activateScrollSync();
    updateGeometry();
  }

  function applyScrollSync() {
    if (!state.active) return;
    const reference = state.panes.length ? state.panes[0].scroller : null;
    if (!reference || !reference.firstElementChild) {
      return;
    }
    state.viewportHeight = window.innerHeight;
    state.singleMaxScroll = Math.max(0, reference.firstElementChild.scrollHeight - state.viewportHeight);
    state.maxBaseScroll = Math.max(
      0,
      state.singleMaxScroll - (state.columns - 1) * state.viewportHeight
    );
    applySyncedScroll();
  }

  chrome.runtime.sendMessage({ type: "get-columns" }, (response) => {
    const columns = response && Number(response.columns) ? Number(response.columns) : 2;
    if (columns === 1) {
      clearSplit();
      return;
    }
    applySplit(columns);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === "apply-columns") {
      if (!message.shouldApply || message.columns === 1) {
        clearSplit();
      } else {
        applySplit(message.columns);
      }
    }
  });
})();

