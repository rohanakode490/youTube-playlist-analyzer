(function () {
    "use strict";

    // Configuration
    const PANEL_ID = "yt-playlist-analyzer-panel";
    const TARGET_SELECTOR = "ytd-playlist-header-renderer .play-menu"; // More generic to catch all screen sizes
    const VIDEO_LIST_SELECTOR = "ytd-playlist-video-list-renderer #contents";
    const VIDEO_ITEM_SELECTOR = "ytd-playlist-video-renderer";
    const TITLE_SELECTOR = "#video-title";
    const DURATION_SELECTOR =
        "ytd-thumbnail-overlay-time-status-renderer span, #text.ytd-thumbnail-overlay-time-status-renderer";

    // State
    let videoData = [];
    let sortOption = "default";
    let startIndex = 1;
    let endIndex = null;
    let isFocusMode = false;
    let panel = null;
    let observer = null;
    let lastSortOption = null;
    let lastVideoCount = 0;

    // Inject styles immediately
    (function injectStyles() {
        if (document.getElementById(`${PANEL_ID}-style`)) return;
        const style = document.createElement("style");
        style.id = `${PANEL_ID}-style`;
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
                margin: 16px 0;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding: 12px 0;
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
            #${PANEL_ID} .focus-mode-group {
                margin-top: 8px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
            }
            #${PANEL_ID} .switch-container {
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                font-size: 13px;
                color: #fff;
            }
        `;
        document.head.appendChild(style);
    })();

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
            data.push({
                title,
                durationSeconds: parseDuration(durationText),
                element: item,
            });
        });
        return data;
    }

    function sortData(data) {
        const sorted = [...data];
        if (sortOption === "default") return sorted;

        switch (sortOption) {
            case "index-desc":
                sorted.reverse();
                break;
            case "title-asc":
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case "title-desc":
                sorted.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case "duration-asc":
                sorted.sort((a, b) => a.durationSeconds - b.durationSeconds);
                break;
            case "duration-desc":
                sorted.sort((a, b) => b.durationSeconds - a.durationSeconds);
                break;
        }
        return sorted;
    }

    function updateDropdowns(startSelect, endSelect, data) {
        if (lastVideoCount === data.length && lastSortOption === sortOption) return;

        lastVideoCount = data.length;
        lastSortOption = sortOption;

        const prevStart = startIndex;
        const prevEnd = endIndex || data.length;

        startSelect.innerHTML = "";
        endSelect.innerHTML = "";

        data.forEach((video, i) => {
            const val = i + 1;
            const text = `${val}. ${video.title}`;
            startSelect.add(new Option(text, val));
            endSelect.add(new Option(text, val));
        });

        startSelect.value = prevStart <= data.length ? prevStart : 1;
        endSelect.value = prevEnd <= data.length ? prevEnd : data.length;

        startIndex = parseInt(startSelect.value) || 1;
        endIndex = parseInt(endSelect.value) || data.length;
    }

    function applyUIVisibility(allData, sortedData, filteredData) {
        const container = document.querySelector(VIDEO_LIST_SELECTOR);
        if (container) {
            container.style.display = "flex";
            container.style.flexDirection = "column";
        }

        allData.forEach((v) => {
            const sortIdx = sortedData.findIndex((s) => s.element === v.element);
            v.element.style.order = sortIdx;

            if (isFocusMode) {
                const isSelected = filteredData.some((f) => f.element === v.element);
                v.element.style.display = isSelected ? "" : "none";
            } else {
                v.element.style.display = "";
            }
        });
    }

    function updatePanel() {
        if (!panel) return;

        const rawData = extractVideoData();
        const sortedData = sortData(rawData);
        videoData = sortedData;

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

        const countEl = panel.querySelector(".stat-count");
        const durationEl = panel.querySelector(".stat-duration");
        if (countEl) countEl.textContent = `Videos Selected: ${filtered.length}`;
        if (durationEl)
            durationEl.textContent = `Total Duration: ${formatDuration(totalSeconds)}`;

        applyUIVisibility(rawData, sortedData, filtered);
    }

    function createPanel(target) {
        if (document.getElementById(PANEL_ID)) return;

        panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="controls">
                <div class="control-group">
                    <label>Sort by:</label>
                    <select id="sort-select">
                        <option value="default">Index (Ascending)</option>
                        <option value="index-desc">Index (Descending)</option>
                        <option value="title-asc">Title (A-Z)</option>
                        <option value="title-desc">Title (Z-A)</option>
                        <option value="duration-asc">Duration (Shortest first)</option>
                        <option value="duration-desc">Duration (Longest first)</option>
                    </select>
                </div>
            </div>
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
                <div class="focus-mode-group">
                    <label class="switch-container">
                        <input type="checkbox" id="focus-toggle">
                        Focus Selected Videos
                    </label>
                </div>
            </div>
        `;

        target.after(panel);

        // Reset tracking to force dropdown population
        lastVideoCount = 0;
        lastSortOption = null;

        const sortSelect = panel.querySelector("#sort-select");
        const startSelect = panel.querySelector("#range-start");
        const endSelect = panel.querySelector("#range-end");
        const focusToggle = panel.querySelector("#focus-toggle");

        sortSelect.addEventListener("change", (e) => {
            sortOption = e.target.value;
            lastSortOption = null;
            updatePanel();
        });

        const handleChange = () => {
            startIndex = parseInt(startSelect.value) || 1;
            endIndex = parseInt(endSelect.value) || videoData.length;
            updatePanel();
        };

        startSelect.addEventListener("change", handleChange);
        endSelect.addEventListener("change", handleChange);
        focusToggle.addEventListener("change", (e) => {
            isFocusMode = e.target.checked;
            updatePanel();
        });

        updatePanel();
    }

    let initAttempts = 0;
    function init() {
        if (!window.location.pathname.includes("/playlist")) {
            // Cleanup panel if navigating away
            const existing = document.getElementById(PANEL_ID);
            if (existing) existing.remove();
            panel = null;
            return;
        }

        const checkExist = setInterval(() => {
            initAttempts++;
            const targets = document.querySelectorAll(TARGET_SELECTOR);
            // YouTube often has multiple .play-menu elements (one for mobile/mini, one for desktop)
            // We want the one that is actually visible.
            let target = null;
            for (const t of targets) {
                if (t.offsetParent !== null) {
                    target = t;
                    break;
                }
            }

            const list = document.querySelector(VIDEO_LIST_SELECTOR);

            if (target && list) {
                clearInterval(checkExist);
                initAttempts = 0;
                createPanel(target);

                if (observer) observer.disconnect();
                observer = new MutationObserver(() => updatePanel());
                observer.observe(list, { childList: true, subtree: true });
            }

            // Stop trying after 10 seconds to save resources
            if (initAttempts > 20) {
                clearInterval(checkExist);
                initAttempts = 0;
            }
        }, 500);
    }

    // Listen for SPA navigation
    document.addEventListener("yt-navigate-finish", init);
    // Listen for standard load
    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        init();
    } else {
        window.addEventListener("DOMContentLoaded", init);
    }
})();
