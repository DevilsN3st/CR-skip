const DEFAULTS = { intro: true, opening: true, recap: true, credits: true };

let state = {
    enabled:          false,
    skipTypes:        { ...DEFAULTS },
    autoNext:         false,
    nextEarlySeconds: 0
};

// ── SAVE ───────────────────────────────────────────────────────────────
function save() {
    chrome.storage.sync.set({
        autoSkipEnabled:  state.enabled,
        skipTypes:        state.skipTypes,
        autoNextEnabled:  state.autoNext,
        nextEarlySeconds: state.nextEarlySeconds
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        if (!tab?.id) return;

        if (!tab.url?.includes("crunchyroll.com")) {
            return;
        }

        chrome.tabs.sendMessage(tab.id, {
            autoSkipEnabled: state.enabled,
            skipTypes: state.skipTypes,
            autoNextEnabled: state.autoNext,
            nextEarlySeconds: state.nextEarlySeconds
        });
    });
    
}

// ── RENDER ─────────────────────────────────────────────────────────────
function render() {
    // Master toggle
    document.getElementById("masterToggle").checked = state.enabled;
    const dot = document.getElementById("statusDot");
    dot.className = "status-dot" + (state.enabled ? " on" : "");
    const status = document.getElementById("statusText");
    status.textContent = state.enabled ? "Active" : "Inactive";
    status.style.color = state.enabled ? "var(--on)" : "var(--muted)";

    // Chips — explicit class set, no toggle
    document.querySelectorAll(".chip").forEach(chip => {
        const type = chip.getAttribute("data-type");
        if (state.skipTypes[type]) {
            chip.classList.add("active");
        } else {
            chip.classList.remove("active");
        }
    });

}


// ── EVENTS ─────────────────────────────────────────────────────────────
document.getElementById("masterToggle").addEventListener("change", function () {
    state.enabled = this.checked;
    render();
    save();
});

document.getElementById("chipContainer").addEventListener("click", function (e) {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const type = chip.getAttribute("data-type");
    state.skipTypes[type] = !state.skipTypes[type];
    render();
    save();
});


// ── INIT ───────────────────────────────────────────────────────────────
chrome.storage.sync.get(
    ["autoSkipEnabled", "skipTypes", "autoNextEnabled", "nextEarlySeconds"],
    function (data) {
        state.enabled          = Boolean(data.autoSkipEnabled);
        state.skipTypes        = Object.assign({ ...DEFAULTS }, data.skipTypes || {});
        state.autoNext         = Boolean(data.autoNextEnabled);
        state.nextEarlySeconds = Number(data.nextEarlySeconds) || 0;
        render();
    }
);