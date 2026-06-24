(function () {
  const STYLE_ID = "splitstream-column-style";
  const TAG_CLASS = "splitstream-root";
  const TARGET_CLASS = "splitstream-target";
  const SIDE_PADDING_PX = 30;
  const SEPARATOR_PX = 4;
  const TARGET_RECHECK_DELAY_MS = 1200;
  const TARGET_SELECTORS = [
    "main",
    '[role="main"]',
    "article",
    "main article",
    '[itemprop="articleBody"]',
    ".note-content",
    ".article-content",
    ".post-content",
    "#contents",
    "[id*='content']",
    "[class*='content']"
  ];
  let currentTarget = null;
  let retargetTimer = null;
  let mutationObserver = null;
  let activeColumns = 2;

  function getTextLength(el) {
    return (el.textContent || "").trim().length;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) {
      return false;
    }
    if (style.position === "fixed" || style.position === "sticky") {
      return false;
    }
    if (rect.width < 200 || rect.height < 100) {
      return false;
    }
    return true;
  }

  function scoreCandidate(el) {
    let score = 0;
    const rect = el.getBoundingClientRect();
    const textLength = getTextLength(el);
    score += rect.width * rect.height;
    score += textLength * 1.5;
    if (el.tagName === "MAIN") score += 50000;
    if (el.tagName === "ARTICLE") score += 25000;
    if (el.matches?.("[role='main']")) score += 50000;
    if (el.id) score += 1000;
    if (el.className && /content|article|post/i.test(el.className)) score += 5000;
    return score;
  }

  function findSplitTarget() {
    const candidates = [];
    const seen = new Set();

    for (const selector of TARGET_SELECTORS) {
      const nodes = document.querySelectorAll(selector);
      for (const el of nodes) {
        if (!el || seen.has(el)) continue;
        if (!isVisible(el)) continue;
        candidates.push(el);
        seen.add(el);
      }
    }

    if (!candidates.length) {
      return document.body;
    }

    let best = candidates[0];
    let bestScore = -Infinity;
    for (const el of candidates) {
      const score = scoreCandidate(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  function scheduleRetarget() {
    if (retargetTimer) {
      clearTimeout(retargetTimer);
    }

    retargetTimer = setTimeout(() => {
      const next = findSplitTarget() || document.body;
      if (!next) {
        return;
      }

      const nextTarget = next.isConnected ? next : document.body;
      if (!nextTarget) {
        return;
      }

      if (!nextTarget.classList.contains(TARGET_CLASS) || currentTarget !== nextTarget) {
        if (currentTarget && currentTarget !== nextTarget) {
          currentTarget.classList.remove(TARGET_CLASS);
        }
        nextTarget.classList.add(TARGET_CLASS);
        currentTarget = nextTarget;
      }

      const styleEl = document.getElementById(STYLE_ID);
      if (styleEl) {
        styleEl.textContent = buildCss(activeColumns);
      }
    }, TARGET_RECHECK_DELAY_MS);
  }

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
        overflow-y: auto !important;
        overflow-x: hidden !important;
        width: 100vw !important;
        min-width: 100vw !important;
      }

      .${TAG_CLASS} .${TARGET_CLASS} {
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

      .${TAG_CLASS} .${TARGET_CLASS} * {
        max-width: 100% !important;
        width: 100% !important;
        min-width: 0 !important;
        overflow: visible !important;
      }

      .${TAG_CLASS} .${TARGET_CLASS} img,
      .${TAG_CLASS} .${TARGET_CLASS} video,
      .${TAG_CLASS} .${TARGET_CLASS} iframe,
      .${TAG_CLASS} .${TARGET_CLASS} canvas {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
  }

  function applySplitTarget() {
    const target = findSplitTarget() || document.body;
    if (!target) return null;

    if (currentTarget && currentTarget !== target) {
      currentTarget.classList.remove(TARGET_CLASS);
    }
    target.classList.add(TARGET_CLASS);
    currentTarget = target;
    return target;
  }

  function applyColumns(columns, cssText) {
    activeColumns = Number(columns) || activeColumns || 2;
    const docEl = document.documentElement;
    const body = document.body;
    if (!docEl || !body) return;

    docEl.classList.add(TAG_CLASS);
    body.classList.add(TAG_CLASS);
    const initialTarget = applySplitTarget();
    if (!initialTarget) return;
    if (!mutationObserver && body) {
      mutationObserver = new MutationObserver(() => {
        scheduleRetarget();
      });
      mutationObserver.observe(body, {
        childList: true,
        subtree: true
      });
    }
    scheduleRetarget();

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.type = "text/css";
      document.head.appendChild(style);
    }

    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) {
      styleEl.textContent = buildCss(activeColumns);
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
    if (currentTarget) {
      currentTarget.classList.remove(TARGET_CLASS);
      currentTarget = null;
    } else {
      const splitTargets = document.querySelectorAll(`.${TARGET_CLASS}`);
      splitTargets.forEach((el) => el.classList.remove(TARGET_CLASS));
    }
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.textContent = "";
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (retargetTimer) {
      clearTimeout(retargetTimer);
      retargetTimer = null;
    }
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
