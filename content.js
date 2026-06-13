console.log("Crunchyroll Auto-Skip script loaded");
console.log("[CRSkip] CONTENT SCRIPT LOADED", location.href);
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[CRSkip] Message received:", msg);
    sendResponse({ success: true });
});

// ── STATE ──────────────────────────────────────────────────────────────
let autoSkipEnabled = false;
let skipTypes       = { intro: true, opening: true, recap: true, credits: true };
let exclusionList   = [];
let observer        = null;

const recentlyClickedButtons = new WeakMap();
const CLICK_COOLDOWN_MS      = 3000;

// ── HELPERS ────────────────────────────────────────────────────────────
function now()            { return Date.now(); }
function normalizeText(t) { return (t || "").trim().toLowerCase(); }

function isWithinCooldown(btn) {
    const t = recentlyClickedButtons.get(btn);
    return Boolean(t && now() - t < CLICK_COOLDOWN_MS);
}
function markClicked(btn) { recentlyClickedButtons.set(btn, now()); }

function isVisible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
        s.display    !== "none"   &&
        s.visibility !== "hidden" &&
        s.opacity    !== "0"      &&
        r.width  > 0 &&
        r.height > 0
    );
}

// ── EXCLUSION CHECK ────────────────────────────────────────────────────
function getCurrentAnimeName() {
    const og = document.querySelector('meta[property="og:title"]');
    if (og) return normalizeText(og.getAttribute("content") || "");
    const parts = normalizeText(document.title).split(/[–\-|]/);
    return parts.length > 1 ? normalizeText(parts[parts.length - 1]) : normalizeText(document.title);
}

function getCurrentEpisode() {
    const urlMatch   = window.location.pathname.match(/episode[- _](\d+)/i);
    if (urlMatch) return parseInt(urlMatch[1], 10);
    const titleMatch = document.title.match(/episode\s+(\d+)/i);
    if (titleMatch) return parseInt(titleMatch[1], 10);
    return null;
}

function isExcluded() {
    if (!exclusionList.length) return false;
    const animeName = getCurrentAnimeName();
    const episode   = getCurrentEpisode();
    for (const rule of exclusionList) {
        const ruleAnime = normalizeText(rule.anime);
        if (!ruleAnime || !animeName.includes(ruleAnime)) continue;
        if (!rule.episode || rule.episode === "*") return true;
        if (episode === parseInt(rule.episode, 10)) return true;
    }
    return false;
}

// ── SKIP TYPE CHECK ────────────────────────────────────────────────────
function isSkipLikeButton(btn) {
    if (!btn) return false;

    const ariaLabel   = normalizeText(btn.getAttribute("aria-label") || "");
    const textContent = normalizeText(btn.textContent || "");
    const testId      = normalizeText(btn.getAttribute("data-testid") || "");

    // Hard guard — never auto-skip to next episode
    if (ariaLabel.includes("next episode") || testId.includes("next-episode")) return false;

    const has = (keyword) => ariaLabel.includes(keyword) || textContent.includes(keyword);

    if (has("skip intro")   && skipTypes.intro)   return true;
    if (has("skip opening") && skipTypes.opening) return true;
    if (has("skip recap")   && skipTypes.recap)   return true;
    if (has("skip credits") && skipTypes.credits) return true;

    return false;
}

// ── BUTTON COLLECTION ──────────────────────────────────────────────────
function getSkipButtons() {
    const candidates = new Set();

    document.querySelectorAll('button[aria-label*="Skip"], button[aria-label*="skip"]')
        .forEach(b => candidates.add(b));

    document.querySelectorAll('[data-testid="skip-intro-icon"]').forEach(icon => {
        const btn = icon.closest("button");
        if (btn) candidates.add(btn);
    });

    document.querySelectorAll("button").forEach(b => {
        if (isSkipLikeButton(b)) candidates.add(b);
    });

    return Array.from(candidates);
}

// ── CORE CLICK LOGIC ───────────────────────────────────────────────────
function clickSkipButtons() {
    if (!autoSkipEnabled) return;
    if (isExcluded())     return;

    for (const btn of getSkipButtons()) {
        if (!isVisible(btn))       continue;
        if (!isSkipLikeButton(btn)) continue;
        if (isWithinCooldown(btn)) continue;

        btn.click();
        markClicked(btn);
        console.log("[CRSkip] Clicked:", btn.getAttribute("aria-label") || btn.textContent?.trim());
    }
}

// ── OBSERVER ───────────────────────────────────────────────────────────
function startObserver() {
    if (observer) return;
    observer = new MutationObserver(clickSkipButtons);
    observer.observe(document.documentElement || document.body, {
        childList:       true,
        subtree:         true,
        attributes:      true,
        attributeFilter: ["aria-label", "class", "style", "hidden"]
    });
}

function stopObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
}

// ── STATE APPLICATION ──────────────────────────────────────────────────
// Mirrors the working version's flat applyAutoSkipState — just also stores
// skipTypes and exclusionList before deciding to start/stop.
function applyState(enabled, types, exclusions) {
    autoSkipEnabled = Boolean(enabled);
    if (types      !== undefined) skipTypes     = types;
    if (exclusions !== undefined) exclusionList = Array.isArray(exclusions) ? exclusions : [];

    console.log(`[CRSkip] Auto-Skip ${autoSkipEnabled ? "Enabled" : "Disabled"}`);

    if (autoSkipEnabled) {
        startObserver();
        clickSkipButtons();
    } else {
        stopObserver();
    }
}

// ── INIT ───────────────────────────────────────────────────────────────
function init() {
    chrome.storage.sync.get(["autoSkipEnabled", "skipTypes", "exclusionList"], (data) => {
        applyState(
            Boolean(data.autoSkipEnabled),
            data.skipTypes     ?? { intro: true, opening: true, recap: true, credits: true },
            data.exclusionList ?? []
        );
    });
}

// Live updates from popup
chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    applyState(
        message.autoSkipEnabled,
        message.skipTypes,
        message.exclusionList
    );
});

// Fallback poll
setInterval(clickSkipButtons, 1500);

init();