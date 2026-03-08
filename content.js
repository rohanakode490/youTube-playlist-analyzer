(function () {
    "use strict";

    // Configuration
    const PANEL_ID = "yt-playlist-analyzer-panel";
    const TARGET_SELECTOR =
        "ytd-playlist-header-renderer .play-menu.wide-screen-form";
    const VIDEO_LIST_SELECTOR = "ytd-playlist-video-list-renderer #contents";
    const VIDEO_ITEM_SELECTOR = "ytd-playlist-video-renderer";
    const TITLE_SELECTOR = "#video-title";
    const DURATION_SELECTOR = "ytd-thumbnail-overlay-time-status-renderer span";

    // State
    let videoData = [];
    let startIndex = 1;
    let endIndex = null;
    let panel = null;
    let observer = null;

    function parseDuration(durationStr) {
        if (!durationStr) return 0;
        const parts = durationStr.trim().split(":").map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    }

    function formatDuration(totalSeconds) {
        if (totalSeconds === 0) return "0:00";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    function extractVideoData() {
        const container = document.querySelector(VIDEO_LIST_SELECTOR);
        if (!container) return [];
        const items = container.querySelectorAll(VIDEO_ITEM_SELECTOR);
        const data = [];
        items.forEach((item) => {
            const titleEl = item.querySelector(TITLE_SELECTOR);
            const title = titleEl ? titleEl.textContent.trim() : "Untitled";
            const durationElement = item.querySelector(DURATION_SELECTOR);
            const durationText = durationElement
                ? durationElement.textContent.trim()
                : "0:00";
            data.push({ title, durationSeconds: parseDuration(durationText) });
        });
        return data;
    }

    function updateDropdowns(startSelect, endSelect, data) {
        // Only rebuild if count changed to avoid flickering or resetting user selection unnecessarily
        if (startSelect.options.length === data.length) return;

        const currentStart = startSelect.value;
        const currentEnd = endSelect.value;

        startSelect.innerHTML = "";
        endSelect.innerHTML = "";

        data.forEach((video, i) => {
            const val = i + 1;
            const text = `${val}. ${video.title}`;

            startSelect.add(new Option(text, val));
            endSelect.add(new Option(text, val));
        });

        // Restore values or set defaults
        startSelect.value = currentStart || 1;
        endSelect.value = currentEnd || data.length;

        startIndex = parseInt(startSelect.value);
        endIndex = parseInt(endSelect.value);
    }

    function updatePanel() {
        if (!panel) return;

        videoData = extractVideoData();
        const startSelect = panel.querySelector("#range-start");
        const endSelect = panel.querySelector("#range-end");

        if (videoData.length > 0) {
            updateDropdowns(startSelect, endSelect, videoData);
        }

        const startIdx = Math.max(0, startIndex - 1);
        const endIdx = Math.min(videoData.length, endIndex || videoData.length);
        const filtered = videoData.slice(startIdx, endIdx);

        const totalSeconds = filtered.reduce(
            (sum, v) => sum + v.durationSeconds,
            0,
        );

        // Update Big Stats
        const countEl = panel.querySelector(".stat-count");
        const durationEl = panel.querySelector(".stat-duration");
        if (countEl) countEl.textContent = `${filtered.length} Videos Selected`;
        if (durationEl)
            durationEl.textContent = `Total Duration: ${formatDuration(totalSeconds)}`;
    }

    function createPanel(target) {
        const existing = document.getElementById(PANEL_ID);
        if (existing) existing.remove();

        panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="stats-container">
                <div class="stat-count">0 Videos Selected</div>
                <div class="stat-duration">Duration: 0:00</div>
            </div>
            <div class="controls">
                <div class="control-group">
                    <label>From:</label>
                    <select id="range-start"></select>
                </div>
                <div class="control-group">
                    <label>To:</label>
                    <select id="range-end"></select>
                </div>
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            #${PANEL_ID} {
                margin: 16px 0;
                padding: 20px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                color: white;
                font-family: "Roboto", Arial, sans-serif;
                border: 1px solid rgba(255, 255, 255, 0.15);
                width: 100%;
                box-sizing: border-box;
            }
            #${PANEL_ID} .stats-container {
                margin-bottom: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 12px;
            }
            #${PANEL_ID} .stat-count {
                font-size: 20px;
                font-weight: 700;
                color: #fff;
                margin-bottom: 4px;
            }
            #${PANEL_ID} .stat-duration {
                font-size: 16px;
                font-weight: 500;
                color: #aaa;
            }
            #${PANEL_ID} .controls { display: flex; flex-direction: column; gap: 12px; }
            #${PANEL_ID} .control-group { display: flex; flex-direction: column; gap: 6px; }
            #${PANEL_ID} label { font-size: 13px; font-weight: 500; color: #ccc; }
            #${PANEL_ID} select {
                background: #121212;
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                width: 100%;
                outline: none;
                cursor: pointer;
            }
            #${PANEL_ID} select:focus { border-color: #fff; }
        `;

        if (!document.getElementById(`${PANEL_ID}-style`)) {
            style.id = `${PANEL_ID}-style`;
            document.head.appendChild(style);
        }

        target.after(panel);

        const startSelect = panel.querySelector("#range-start");
        const endSelect = panel.querySelector("#range-end");

        const handleChange = () => {
            startIndex = parseInt(startSelect.value) || 1;
            endIndex = parseInt(endSelect.value) || videoData.length;
            updatePanel();
        };

        startSelect.addEventListener("change", handleChange);
        endSelect.addEventListener("change", handleChange);

        updatePanel();
    }

    function init() {
        if (!window.location.pathname.includes("/playlist")) return;

        const checkExist = setInterval(() => {
            const target = document.querySelector(TARGET_SELECTOR);
            const list = document.querySelector(VIDEO_LIST_SELECTOR);
            if (target && list) {
                clearInterval(checkExist);
                createPanel(target);

                if (observer) observer.disconnect();
                observer = new MutationObserver(() => updatePanel());
                observer.observe(list, { childList: true, subtree: true });
            }
        }, 1000);
    }

    document.addEventListener("yt-navigate-finish", init);
    init();
})();
