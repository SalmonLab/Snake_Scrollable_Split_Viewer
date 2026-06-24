(function () {
  const STYLE_ID = "splitstream-column-style";
  const TAG_CLASS = "splitstream-root";
  const TARGET_CLASS = "splitstream-target";
  const FALLBACK_CLASS = "splitstream-fallback";
  const SIDE_PADDING_PX = 30;
  const SEPARATOR_PX = 4;
  const TARGET_RECHECK_DELAY_MS = 1200;
  const VERIFY_DELAY_MS = 800;
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
  let mutationObserver = null;
  let retargetTimer = null;
  let verifyTimer = null;
  let verifyAttempts = 0;
  let activeColumns = 2;
  let mode = "native";
  let fallbackState = null;
  let wheelHandler = null;
  let wheelTarget = null;

  function getTextLength(el) {
    return (el.textContent || "").trim().length;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) return false;
    if (style.position === "fixed" || style.position === "sticky") return false;
    if (rect.width < 200 || rect.height < 100) return false;
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

  function normalizeOverflow(value) {
    return (value || "").toLowerCase().trim();
  }

  function isScrollable(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = window.getComputedStyle(el);
    const overflowY = normalizeOverflow(style.overflowY);
    const overflow = normalizeOverflow(style.overflow);
    const scrollableOverflow = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay" ||
      overflow === "auto" || overflow === "scroll" || overflow === "overlay";
    if (!scrollableOverflow) return false;
    return el.scrollHeight > el.clientHeight + 1;
  }

  function findScrollRoot(primaryTarget) {
    const checked = new Set();
    const candidates = [];
    if (primaryTarget) {
      let node = primaryTarget;
      while (node && node !== document.documentElement.parentElement) {
        candidates.push(node);
        checked.add(node);
        if (node === document.body) break;
        node = node.parentElement;
      }
    }
    const root = document.documentElement;
    const body = document.body;
    if (root && !checked.has(root)) candidates.push(root);
    if (body && !checked.has(body)) candidates.push(body);

    for (const candidate of candidates) {
      if (isScrollable(candidate)) return candidate;
    }
    if (root && root.scrollHeight > window.innerHeight * 2) return root;
    if (body && body.scrollHeight > window.innerHeight * 2) return body;
    return null;
  }

  function getTargetSelector(target) {
    if (!target || target === document.documentElement) return `html.${TAG_CLASS}.${TARGET_CLASS}`;
    if (target === document.body) return `body.${TAG_CLASS}.${TARGET_CLASS}`;
    return `.${TAG_CLASS} .${TARGET_CLASS}`;
  }

  function getVisibleFlowNodes(target) {
    if (!target) return [];
    const selectors = [
      "p", "h1", "h2", "h3", "h4", "h5", "h6", "li",
      "pre", "figure", "blockquote", "table", "section", "ul", "ol", "div"
    ];
    return Array.from(target.querySelectorAll(selectors.join(",")))
      .filter((el) => {
        if (!el || !el.getBoundingClientRect) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width < 16 || rect.height < 8) return false;
        if (rect.top < -window.innerHeight || rect.top > window.innerHeight * 2) return false;
        if (style.position === "fixed" || style.position === "sticky") return false;
        return true;
      })
      .slice(0, 240);
  }

  function estimateLaneCount(target) {
    const nodes = getVisibleFlowNodes(target);
    if (!nodes.length) return 0;
    const lefts = nodes.map((el) => Math.round(el.getBoundingClientRect().left)).sort((a, b) => a - b);
    const bins = [];
    for (const left of lefts) {
      let matched = false;
      for (const bin of bins) {
        if (Math.abs(left - bin.anchor) <= 60) {
          bin.count += 1;
          bin.anchor = Math.round((bin.anchor + left) / 2);
          matched = true;
          break;
        }
      }
      if (!matched) bins.push({ anchor: left, count: 1 });
    }
    return bins.filter((bin) => bin.count >= 3).length || 0;
  }

  function shouldFallback(target) {
    if (!target) return true;
    if (target === document.body || target === document.documentElement) return false;
    const lanes = estimateLaneCount(target);
    if (lanes === 0) return false;
    if (lanes > activeColumns + 1) return true;
    return false;
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
    if (!candidates.length) return document.body;
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
    if (retargetTimer) clearTimeout(retargetTimer);
    retargetTimer = setTimeout(() => {
      if (mode !== "native") return;
      const next = findSplitTarget() || document.body;
      if (!next) return;
      const nextTarget = next.isConnected ? next : document.body;
      if (!nextTarget) return;
      if (!nextTarget.classList.contains(TARGET_CLASS) || currentTarget !== nextTarget) {
        if (currentTarget && currentTarget !== nextTarget) currentTarget.classList.remove(TARGET_CLASS);
        nextTarget.classList.add(TARGET_CLASS);
        currentTarget = nextTarget;
      }
      const styleEl = document.getElementById(STYLE_ID);
      if (styleEl) styleEl.textContent = buildCss(activeColumns);
    }, TARGET_RECHECK_DELAY_MS);
  }

  function restoreFromFallback() {
    if (!fallbackState || !fallbackState.active) return;
    if (fallbackState.previousTarget) {
      fallbackState.previousTarget.classList.remove(TARGET_CLASS);
    }
    if (fallbackState.scrollRoot && fallbackState.scrollRoot.classList.contains(TARGET_CLASS)) {
      fallbackState.scrollRoot.classList.remove(TARGET_CLASS);
    }
    fallbackState = null;
  }

  function buildCss(columns) {
    const targetWidth = mode === "fallback" ? "100%" : `calc(100% - ${SIDE_PADDING_PX * 2}px)`;
    const targetSelector = getTargetSelector(currentTarget);
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

      ${targetSelector} {
        position: relative !important;
        display: block !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        -webkit-column-count: ${columns} !important;
        column-count: ${columns} !important;
        -webkit-column-fill: auto !important;
        column-fill: auto !important;
        height: calc(100vh - ${SIDE_PADDING_PX * 2}px) !important;
        -webkit-column-gap: ${SEPARATOR_PX}px !important;
        column-gap: ${SEPARATOR_PX}px !important;
        -webkit-column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
        column-rule: ${SEPARATOR_PX}px solid rgba(148, 163, 184, 0.35) !important;
        width: ${targetWidth} !important;
        max-width: none !important;
        box-sizing: border-box !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        overflow-wrap: anywhere !important;
        min-height: 0 !important;
      }

      .${TAG_CLASS} .${TARGET_CLASS} > * {
        max-width: 100% !important;
        width: auto !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        box-sizing: border-box !important;
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

  function applyStyles(columns) {
    const styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.type = "text/css";
      document.head.appendChild(style);
    }
    const nextStyle = document.getElementById(STYLE_ID);
    if (nextStyle) nextStyle.textContent = buildCss(columns);
  }

  function applySplitTarget() {
    const target = findSplitTarget() || document.body;
    if (!target) return null;
    if (currentTarget && currentTarget !== target) currentTarget.classList.remove(TARGET_CLASS);
    target.classList.add(TARGET_CLASS);
    currentTarget = target;
    return target;
  }

  function syncWheelToTarget(target) {
    if (wheelHandler && wheelTarget === target) return;
    if (wheelHandler) {
      window.removeEventListener("wheel", wheelHandler, { capture: true });
      wheelHandler = null;
      wheelTarget = null;
    }
    wheelHandler = (event) => {
      if (!(mode === "native" || mode === "fallback")) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (!target || !target.scrollTo) return;
      const maxY = target.scrollHeight - target.clientHeight;
      if (maxY <= 1) return;
      target.scrollTop = Math.min(Math.max(0, target.scrollTop + event.deltaY), maxY);
      if (target === document.documentElement) {
        window.scrollTo(0, target.scrollTop);
      }
    };
    wheelTarget = target;
    window.addEventListener("wheel", wheelHandler, { capture: true, passive: false });
  }

  function clearTargetMode() {
    if (currentTarget) currentTarget.classList.remove(TARGET_CLASS);
    else document.querySelectorAll(`.${TARGET_CLASS}`).forEach((target) => target.classList.remove(TARGET_CLASS));
    currentTarget = null;
    mode = "native";
    document.documentElement.classList.remove(FALLBACK_CLASS);
    document.body.classList.remove(FALLBACK_CLASS);
  }

  function verifyAndFallback(columns) {
    if (verifyTimer) clearTimeout(verifyTimer);
    verifyTimer = setTimeout(() => {
      if (mode !== "native") return;
      if (shouldFallback(currentTarget)) {
        applyFallback(columns);
        return;
      }
      verifyAttempts += 1;
      if (verifyAttempts < 4) verifyAndFallback(columns);
    }, VERIFY_DELAY_MS);
  }

  function applyNative(columns) {
    if (mode === "fallback") restoreFromFallback();
    mode = "native";
    document.documentElement.classList.remove(FALLBACK_CLASS);
    document.body.classList.remove(FALLBACK_CLASS);
    const target = applySplitTarget();
    if (!target) return;
    syncWheelToTarget(target);
    applyStyles(columns);
    verifyAttempts = 0;
    verifyAndFallback(columns);
  }

  function applyFallback(columns) {
    const fallbackTarget = findScrollRoot(currentTarget) || currentTarget || document.scrollingElement || document.documentElement;
    if (!fallbackTarget) return;

    if (!fallbackState || !fallbackState.active || fallbackState.scrollRoot !== fallbackTarget) {
      fallbackState = {
        active: true,
        scrollRoot: fallbackTarget,
        previousTarget: currentTarget
      };
    }

    if (mode === "fallback" && currentTarget !== fallbackTarget) {
      restoreFromFallback();
    }

    if (currentTarget && currentTarget !== fallbackTarget) {
      currentTarget.classList.remove(TARGET_CLASS);
    }

    currentTarget = fallbackTarget;
    mode = "fallback";
    verifyAttempts = 0;
    syncWheelToTarget(fallbackTarget);

    document.documentElement.classList.add(FALLBACK_CLASS);
    document.body.classList.add(FALLBACK_CLASS);
    fallbackTarget.classList.add(TAG_CLASS);
    fallbackTarget.classList.add(TARGET_CLASS);
    applyStyles(columns);
  }

  function applyColumns(columns) {
    activeColumns = Number(columns) || activeColumns || 2;
    const docEl = document.documentElement;
    const body = document.body;
    if (!docEl || !body) return;
    docEl.classList.add(TAG_CLASS);
    body.classList.add(TAG_CLASS);
    applyNative(activeColumns);

    if (!mutationObserver && body) {
      mutationObserver = new MutationObserver(() => {
        scheduleRetarget();
      });
      mutationObserver.observe(body, { childList: true, subtree: true });
    }
    scheduleRetarget();
  }

  function clearColumns() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (retargetTimer) {
      clearTimeout(retargetTimer);
      retargetTimer = null;
    }
    if (verifyTimer) {
      clearTimeout(verifyTimer);
      verifyTimer = null;
    }
    if (wheelHandler) {
      window.removeEventListener("wheel", wheelHandler, { capture: true });
      wheelHandler = null;
      wheelTarget = null;
    }
    verifyAttempts = 0;
    mode = "native";
    restoreFromFallback();
    if (currentTarget) currentTarget.classList.remove(TARGET_CLASS);
    currentTarget = null;
    document.querySelectorAll(`.${TARGET_CLASS}`).forEach((target) => target.classList.remove(TARGET_CLASS));

    const docEl = document.documentElement;
    const body = document.body;
    if (docEl) {
      docEl.classList.remove(TAG_CLASS);
      docEl.classList.remove(FALLBACK_CLASS);
    }
    if (body) {
      body.classList.remove(TAG_CLASS);
      body.classList.remove(FALLBACK_CLASS);
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
    applyColumns(columns);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === "apply-columns" && message.shouldApply) {
      if (message.columns === 1) {
        clearColumns();
      } else {
        applyColumns(message.columns);
      }
      return;
    }
    if (message.type === "apply-columns" && !message.shouldApply) {
      clearColumns();
    }
  });
})();
