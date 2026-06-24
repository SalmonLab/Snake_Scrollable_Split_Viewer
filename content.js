(() => {
  const STYLE_ID = "splitstream-snake-style";
  const ROOT_CLASS = "splitstream-root";
  const BODY_CLASS = "splitstream-root-active";
  const SIDE_PADDING_PX = 30;
  const SEPARATOR_PX = 4;

  const state = {
    active: false,
    scrollBase: 0,
    maxBaseScroll: 0,
    viewportHeight: 0,
    root: null,
    primaryScroller: null,
    leftInner: null,
    rightInner: null,
    styleEl: null,
    wheelHandler: null,
    resizeHandler: null,
    scrollHandler: null,
    syncFromPrimary: false,
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
    styleEl.textContent = `
      .${ROOT_CLASS} {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        box-sizing: border-box !important;
        gap: ${SEPARATOR_PX}px !important;
        padding: 0 ${SIDE_PADDING_PX}px !important;
        overflow: hidden !important;
      }

      .${BODY_CLASS} {
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
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
        background: rgba(148, 163, 184, 0.35) !important;
        align-self: stretch !important;
      }

      .${ROOT_CLASS} .splitstream-scroll {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
      }

      .${ROOT_CLASS} .splitstream-scroll-right {
        overflow-y: hidden !important;
        pointer-events: none !important;
        scrollbar-width: none !important;
      }

      .${ROOT_CLASS} .splitstream-scroll-right::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
      }

      .${ROOT_CLASS} .splitstream-scroll::-webkit-scrollbar {
        width: 8px !important;
        height: 8px !important;
      }

      .${ROOT_CLASS} .splitstream-scroll {
        scrollbar-width: thin !important;
      }

      .${ROOT_CLASS} .splitstream-pane-inner {
        position: relative !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        transform: translateY(0px) !important;
        will-change: transform !important;
      }

      .${ROOT_CLASS} .splitstream-clone-root {
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      .${ROOT_CLASS} .splitstream-clone-root * {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    `;
    document.documentElement.appendChild(styleEl);
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

  function createCloneFragment() {
    const fragment = document.createElement("div");
    fragment.className = "splitstream-clone-root";
    const children = Array.from(document.body.childNodes);
    children.forEach((node) => {
      fragment.appendChild(node.cloneNode(true));
    });
    removeBlockedNodes(fragment);
    return fragment;
  }

  function createColumn(index) {
    const column = document.createElement("div");
    column.className = "splitstream-column";

    const scroller = document.createElement("div");
    scroller.className = index === 0
      ? "splitstream-scroll splitstream-scroll-left"
      : "splitstream-scroll splitstream-scroll-right";

    const inner = document.createElement("div");
    inner.className = "splitstream-pane-inner";
    inner.appendChild(createCloneFragment());

    scroller.appendChild(inner);
    column.appendChild(scroller);

    if (index === 0) {
      state.leftInner = inner;
      state.primaryScroller = scroller;
      state.scrollHandler = onPrimaryScroll;
    } else {
      state.rightInner = inner;
    }

    return column;
  }

  function applySyncedScroll() {
    if (!state.active || !state.primaryScroller) return;

    const clamped = clamp(state.scrollBase, 0, state.maxBaseScroll);
    state.scrollBase = clamped;

    if (!state.syncFromPrimary) {
      state.primaryScroller.scrollTop = clamped;
    }

    if (state.leftInner) {
      state.leftInner.style.transform = "translateY(0px)";
    }

    if (state.rightInner) {
      const offset = -(state.scrollBase + state.viewportHeight);
      state.rightInner.style.transform = `translateY(${offset}px)`;
    }
  }

  function onPrimaryScroll() {
    if (!state.active || !state.primaryScroller || state.syncFromPrimary) return;
    state.syncFromPrimary = true;
    const next = clamp(
      state.primaryScroller.scrollTop,
      0,
      state.maxBaseScroll
    );
    if (next !== state.scrollBase) {
      state.scrollBase = next;
      applySyncedScroll();
    }
    state.syncFromPrimary = false;
  }

  function onWheel(event) {
    if (!state.active || !state.primaryScroller) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!event.deltaY) return;

    event.preventDefault();

    const next = clamp(
      state.primaryScroller.scrollTop + event.deltaY,
      0,
      state.maxBaseScroll
    );
    if (next !== state.scrollBase) {
      state.scrollBase = next;
      applySyncedScroll();
    }
  }

  function updateGeometry() {
    if (!state.active || !state.primaryScroller) return;
    state.viewportHeight = state.primaryScroller.clientHeight;
    state.maxBaseScroll = Math.max(0, state.primaryScroller.scrollHeight - state.primaryScroller.clientHeight);
    state.scrollBase = clamp(state.scrollBase, 0, state.maxBaseScroll);
    state.primaryScroller.scrollTop = clamp(state.primaryScroller.scrollTop, 0, state.maxBaseScroll);
    applySyncedScroll();
  }

  function activateHandlers() {
    if (state.wheelHandler) {
      window.removeEventListener("wheel", state.wheelHandler, { capture: true });
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }

    state.wheelHandler = onWheel;
    window.addEventListener("wheel", state.wheelHandler, { capture: true, passive: false });

    state.resizeHandler = () => {
      requestAnimationFrame(updateGeometry);
    };
    window.addEventListener("resize", state.resizeHandler);

    if (state.primaryScroller) {
      state.primaryScroller.removeEventListener("scroll", onPrimaryScroll);
      state.primaryScroller.addEventListener("scroll", onPrimaryScroll, { passive: true });
    }
  }

  function removeHandlers() {
    if (state.primaryScroller) {
      state.primaryScroller.removeEventListener("scroll", onPrimaryScroll);
    }
    if (state.wheelHandler) {
      window.removeEventListener("wheel", state.wheelHandler, { capture: true });
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }

    state.wheelHandler = null;
    state.resizeHandler = null;
    state.scrollHandler = null;
    state.primaryScroller = null;
    state.leftInner = null;
    state.rightInner = null;
  }

  function clearSplit() {
    removeHandlers();
    removeStyle();

    if (!state.active) {
      state.active = false;
      state.maxBaseScroll = 0;
      state.viewportHeight = 0;
      state.scrollBase = 0;
      state.root = null;
      return;
    }

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

    state.active = false;
    state.root = null;
    state.maxBaseScroll = 0;
    state.viewportHeight = 0;
    state.scrollBase = 0;
  }

  function applySplit() {
    const body = document.body;
    if (!body) return;

    const originalHTML = body.innerHTML;
    const originalClass = body.className || "";
    const originalStyle = body.getAttribute("style") || "";

    if (state.active) {
      clearSplit();
    } else {
      removeHandlers();
      removeStyle();
    }

    state.savedBodyHTML = originalHTML;
    state.savedBodyClassName = originalClass;
    state.savedBodyStyle = originalStyle;

    setStyle();

    body.classList.add(BODY_CLASS);
    state.active = true;
    state.scrollBase = 0;
    state.maxBaseScroll = 0;
    state.viewportHeight = 0;

    const root = document.createElement("div");
    root.className = ROOT_CLASS;
    root.appendChild(createColumn(0));

    const separator = document.createElement("div");
    separator.className = "splitstream-separator";
    root.appendChild(separator);

    root.appendChild(createColumn(1));

    body.innerHTML = "";
    body.appendChild(root);
    state.root = root;

    requestAnimationFrame(() => {
      if (!state.primaryScroller) return;
      activateHandlers();
      state.primaryScroller.scrollTop = 0;
      updateGeometry();
    });
  }

  function initFromSettings() {
    chrome.runtime.sendMessage({ type: "get-columns" }, (response) => {
      const columns = response && Number(response.columns) === 2 ? 2 : 1;
      if (columns !== 2) {
        clearSplit();
        return;
      }
      applySplit();
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "apply-columns") return;

    if (!message.shouldApply || Number(message.columns) !== 2) {
      clearSplit();
      return;
    }

    applySplit();
  });

  initFromSettings();
})();
