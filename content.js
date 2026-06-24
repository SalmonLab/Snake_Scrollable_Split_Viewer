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
    panes: [],
    wheelHandler: null,
    resizeHandler: null,
    rafSyncId: null,
    styleEl: null,
    primaryScroller: null,
    syncingFromPrimary: false,
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
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .${ROOT_CLASS} .splitstream-separator {
        width: ${SEPARATOR_PX}px !important;
        min-width: ${SEPARATOR_PX}px !important;
        max-width: ${SEPARATOR_PX}px !important;
        align-self: stretch !important;
        background: rgba(148, 163, 184, 0.35) !important;
      }

      .${ROOT_CLASS} .splitstream-scroll {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        box-sizing: border-box !important;
      }

      .${ROOT_CLASS} .splitstream-scroll:not(.splitstream-scroll-primary) {
        overflow-y: hidden !important;
        overflow-x: hidden !important;
        pointer-events: none !important;
      }

      .${ROOT_CLASS} .splitstream-scroll:not(.splitstream-scroll-primary)::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
      }

      .${ROOT_CLASS} .splitstream-scroll-primary::-webkit-scrollbar {
        width: 8px !important;
        height: 8px !important;
      }

      .${ROOT_CLASS} .splitstream-scroll-primary {
        scrollbar-width: thin !important;
      }

      .${ROOT_CLASS} .splitstream-pane-inner {
        position: relative !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        transform: translateY(0px);
        will-change: transform !important;
      }

      .${ROOT_CLASS} .splitstream-pane-clone {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      .${ROOT_CLASS} .splitstream-pane-clone img,
      .${ROOT_CLASS} .splitstream-pane-clone video,
      .${ROOT_CLASS} .splitstream-pane-clone iframe,
      .${ROOT_CLASS} .splitstream-pane-clone canvas {
        max-width: 100% !important;
        height: auto !important;
      }

      .${ROOT_CLASS} .splitstream-pane-clone * {
        max-width: 100% !important;
        width: auto !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
    `;
    state.styleEl = styleEl;
  }

  function removeStyle() {
    if (!state.styleEl) return;
    state.styleEl.remove();
    state.styleEl = null;
  }

  function removeBlockedNodes(root) {
    const blocked = root.querySelectorAll("script, noscript");
    blocked.forEach((item) => item.remove());
  }

  function createClonedContent() {
    const clone = document.createElement("div");
    clone.className = "splitstream-pane-clone";

    const bodyAttributes = document.body.attributes;
    for (let i = 0; i < bodyAttributes.length; i++) {
      const attr = bodyAttributes[i];
      if (attr.name !== "id" && attr.name !== "class") {
        clone.setAttribute(attr.name, attr.value);
      }
    }

    clone.setAttribute("style", "margin:0 !important;padding:0 !important;display:block !important;");

    Array.from(document.body.childNodes).forEach((node) => {
      clone.appendChild(node.cloneNode(true));
    });

    removeBlockedNodes(clone);
    return clone;
  }

  function createColumn(index) {
    const column = document.createElement("div");
    column.className = "splitstream-column";

    const scroller = document.createElement("div");
    scroller.className = "splitstream-scroll";
    if (index === state.columns - 1) {
      scroller.className += " splitstream-scroll-primary";
    }
    scroller.setAttribute("data-splitstream-column", String(index));

    const inner = document.createElement("div");
    inner.className = "splitstream-pane-inner";
    inner.appendChild(createClonedContent());

    scroller.appendChild(inner);
    column.appendChild(scroller);

    state.panes.push({ column, scroller, inner, index });
    return column;
  }

  function applySyncedScroll() {
    if (!state.active || !state.primaryScroller) return;

    const clamped = clamp(state.scrollBase, 0, state.maxBaseScroll);
    state.scrollBase = clamped;

    state.panes.forEach((pane) => {
      const isPrimary = pane.index === (state.columns - 1);
      const phase = pane.index * state.viewportHeight;
      const targetOffset = isPrimary
        ? -phase
        : -state.scrollBase - phase;
      pane.inner.style.transform = `translateY(${targetOffset}px)`;
    });

    if (!state.syncingFromPrimary) {
      state.primaryScroller.scrollTop = clamped;
    }
  }

  function onPrimaryScroll() {
    if (!state.active || !state.primaryScroller || state.syncingFromPrimary) return;

    const next = clamp(state.primaryScroller.scrollTop, 0, state.maxBaseScroll);
    if (next === state.scrollBase) return;

    state.scrollBase = next;
    state.syncingFromPrimary = true;
    applySyncedScroll();
    state.syncingFromPrimary = false;
  }

  function syncLoop() {
    if (!state.active || !state.primaryScroller) {
      state.rafSyncId = null;
      return;
    }

    clampBaseScroll();
    const next = clamp(state.primaryScroller.scrollTop, 0, state.maxBaseScroll);
    if (next !== state.scrollBase) {
      state.scrollBase = next;
      state.syncingFromPrimary = true;
      applySyncedScroll();
      state.syncingFromPrimary = false;
    }
    state.rafSyncId = requestAnimationFrame(syncLoop);
  }

  function onWheel(event) {
    if (!state.active || !state.primaryScroller) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!event.deltaY) return;

    event.preventDefault();
    const next = clamp(
      state.primaryScroller.scrollTop + event.deltaY,
      0,
      state.maxBaseScroll
    );
    state.primaryScroller.scrollTop = next;
    onPrimaryScroll();
  }

  function clampBaseScroll() {
    if (!state.primaryScroller) {
      state.maxBaseScroll = 0;
      state.scrollBase = 0;
      return;
    }

    const contentMax = Math.max(
      0,
      state.primaryScroller.scrollHeight - state.primaryScroller.clientHeight - Math.max(1, state.viewportHeight * state.columns) + state.viewportHeight
    );
    state.maxBaseScroll = clamp(contentMax, 0, contentMax);
    state.scrollBase = clamp(state.scrollBase, 0, state.maxBaseScroll);
    state.primaryScroller.scrollTop = clamp(state.primaryScroller.scrollTop, 0, state.maxBaseScroll);
  }

  function activateSyncHandlers() {
    if (state.wheelHandler) {
      window.removeEventListener("wheel", state.wheelHandler, { capture: true });
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }

    state.wheelHandler = onWheel;
    window.addEventListener("wheel", state.wheelHandler, { capture: true, passive: false });

    state.resizeHandler = () => updateGeometry();
    window.addEventListener("resize", state.resizeHandler);
    if (state.rafSyncId) {
      cancelAnimationFrame(state.rafSyncId);
      state.rafSyncId = null;
    }
    state.rafSyncId = requestAnimationFrame(syncLoop);
  }

  function removeSyncHandlers() {
    if (state.primaryScroller) {
      state.primaryScroller.removeEventListener("scroll", onPrimaryScroll);
      state.primaryScroller = null;
    }
    if (state.wheelHandler) {
      window.removeEventListener("wheel", state.wheelHandler, { capture: true });
      state.wheelHandler = null;
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
      state.resizeHandler = null;
    }
    if (state.rafSyncId) {
      cancelAnimationFrame(state.rafSyncId);
      state.rafSyncId = null;
    }
  }

  function clearSplit() {
    removeSyncHandlers();
    removeStyle();

    if (!state.active) {
      state.panes = [];
      state.maxBaseScroll = 0;
      state.viewportHeight = 0;
      state.scrollBase = 0;
      return;
    }

    state.panes = [];
    state.scrollBase = 0;
    state.viewportHeight = 0;
    state.maxBaseScroll = 0;
    state.active = false;

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
  }

  function updateGeometry() {
    if (!state.active || !state.primaryScroller) return;
    state.viewportHeight = window.innerHeight;
    clampBaseScroll();
    state.syncingFromPrimary = true;
    applySyncedScroll();
    state.syncingFromPrimary = false;
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
      removeSyncHandlers();
      removeStyle();
      state.panes = [];
      state.maxBaseScroll = 0;
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
      state.primaryScroller = container.querySelector(`.splitstream-scroll-primary`);
      if (state.primaryScroller) {
        state.primaryScroller.scrollTop = 0;
        state.primaryScroller.addEventListener("scroll", onPrimaryScroll, { passive: true });
      }
      updateGeometry();
      activateSyncHandlers();
    });
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
