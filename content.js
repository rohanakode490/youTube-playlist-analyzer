(function () {
    "use strict";

    // Configuration
    const PANEL_ID = "yt-playlist-analyzer-panel";
    const VIDEO_LIST_SELECTOR = "ytd-playlist-video-list-renderer #contents";
    const VIDEO_ITEM_SELECTOR = "ytd-playlist-video-renderer";
    const TITLE_SELECTOR = "#video-title";
    const DURATION_SELECTOR = "ytd-thumbnail-overlay-time-status-renderer span";

    // State
    let videoData = []; // Array of { title, durationSeconds }
    let sortOption = "default"; // default, title-asc, title-desc, duration-asc, duration-desc
    let startIndex = 1; // 1-based
    let endIndex = Infinity;
    let panel = null;
    let isPanelVisible = true;
    let observer = null;

    // Helper: parse duration string "MM:SS" or "H:MM:SS" to seconds
    function parseDuration(durationStr) {
        if (!durationStr) return 0;
        const parts = durationStr.trim().split(":").map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        return 0;
    }

    // Helper: format seconds to HH:MM:SS or MM:SS
    function formatDuration(totalSeconds) {
        if (totalSeconds === 0) return "0:00";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, "0")}`;
        }
    }

    // Extract video data from the current playlist DOM
    function extractVideoData() {
        const container = document.querySelector(VIDEO_LIST_SELECTOR);
        if (!container) return [];

        const items = container.querySelectorAll(VIDEO_ITEM_SELECTOR);
        const data = [];

        items.forEach((item) => {
            const titleElement = item.querySelector(TITLE_SELECTOR);
            const title = titleElement ? titleElement.textContent.trim() : "Untitled";

            const durationElement = item.querySelector(DURATION_SELECTOR);
            const durationText = durationElement
                ? durationElement.textContent.trim()
                : "0:00";
            const durationSeconds = parseDuration(durationText);

            data.push({ title, durationSeconds });
        });

        return data;
    }

    // Sort videoData based on current sortOption
    function sortData(data) {
        const sorted = [...data];
        switch (sortOption) {
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
            default: // 'default' – keep original YouTube order (as extracted)
                // No sorting, use original order from DOM
                break;
        }
        return sorted;
    }

    // Get filtered data based on current range
    function getFilteredData(sortedData) {
        const start = Math.max(0, startIndex - 1); // convert to 0-based
        const end = Math.min(sortedData.length, endIndex);
        return sortedData.slice(start, end);
    }

    // Compute stats from filtered data
    function computeStats(filteredData) {
        const count = filteredData.length;
        const totalSeconds = filteredData.reduce(
            (sum, v) => sum + v.durationSeconds,
            0,
        );
        return { count, totalSeconds };
    }

    // Render the video list inside the panel (optional)
    function renderVideoList(container, filteredData) {
        const listHtml = filteredData
            .map((video, idx) => {
                const duration = formatDuration(video.durationSeconds);
                return `<div class="video-item">${startIndex + idx}. ${video.title} (${duration})</div>`;
            })
            .join("");
        container.innerHTML =
            listHtml || '<div class="video-item">No videos in range</div>';
    }

    // Update panel UI with current data
    function updatePanel() {
        if (!panel) return;

        // Get fresh data from DOM
        videoData = extractVideoData();

        // Sort and filter
        const sorted = sortData(videoData);
        const filtered = getFilteredData(sorted);
        const stats = computeStats(filtered);

        // Update stats display
        const statsEl = panel.querySelector(".stats");
        statsEl.textContent = `Videos: ${stats.count}  |  Total: ${formatDuration(stats.totalSeconds)}`;

        // Update list
        const listContainer = panel.querySelector(".video-list");
        renderVideoList(listContainer, filtered);

        // Update range inputs max
        const startInput = panel.querySelector("#range-start");
        const endInput = panel.querySelector("#range-end");
        startInput.max = videoData.length;
        endInput.max = videoData.length;
        if (endIndex > videoData.length) {
            endIndex = videoData.length;
            endInput.value = endIndex;
        }
    }

    // Create the floating panel UI
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;

        panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = `
      <div class="panel-header">
        <h3>Playlist Analyzer</h3>
        <button id="close-panel">×</button>
      </div>
      <div class="stats">Videos: 0  |  Total: 0:00</div>
      <div class="sort-section">
        <label>Sort by:</label>
        <select id="sort-select">
          <option value="default">Default (YouTube order)</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
          <option value="duration-asc">Duration (shortest first)</option>
          <option value="duration-desc">Duration (longest first)</option>
        </select>
      </div>
      <div class="range-section">
        <label>Range:</label>
        <input type="number" id="range-start" min="1" value="1" step="1">
        <span> to </span>
        <input type="number" id="range-end" min="1" value="Infinity" step="1">
        <button id="apply-range">Apply</button>
      </div>
      <div class="video-list-container">
        <div class="video-list"></div>
      </div>
    `;

        // Add styles
        const style = document.createElement("style");
        style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 350px;
        max-height: 80vh;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-family: Roboto, Arial, sans-serif;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #${PANEL_ID} .panel-header {
        background: #f1f1f1;
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #ddd;
      }
      #${PANEL_ID} .panel-header h3 {
        margin: 0;
        font-size: 16px;
      }
      #${PANEL_ID} #close-panel {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
      }
      #${PANEL_ID} .stats {
        padding: 10px 12px;
        background: #f9f9f9;
        border-bottom: 1px solid #eee;
        font-weight: 500;
      }
      #${PANEL_ID} .sort-section, #${PANEL_ID} .range-section {
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
      }
      #${PANEL_ID} label {
        font-weight: 500;
        margin-right: 6px;
      }
      #${PANEL_ID} select, #${PANEL_ID} input[type="number"] {
        padding: 4px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      #${PANEL_ID} input[type="number"] {
        width: 60px;
      }
      #${PANEL_ID} #apply-range {
        margin-left: 8px;
        padding: 4px 10px;
        background: #065fd4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      #${PANEL_ID} #apply-range:hover {
        background: #0b4f8c;
      }
      #${PANEL_ID} .video-list-container {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
        padding: 8px 12px;
        background: #fff;
      }
      #${PANEL_ID} .video-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      #${PANEL_ID} .video-item {
        padding: 6px 0;
        border-bottom: 1px solid #f0f0f0;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;

        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Event listeners
        document.getElementById("close-panel").addEventListener("click", () => {
            panel.remove();
            panel = null;
        });

        const sortSelect = document.getElementById("sort-select");
        sortSelect.addEventListener("change", (e) => {
            sortOption = e.target.value;
            updatePanel();
        });

        const startInput = document.getElementById("range-start");
        const endInput = document.getElementById("range-end");
        const applyBtn = document.getElementById("apply-range");

        function applyRange() {
            let start = parseInt(startInput.value, 10);
            let end = parseInt(endInput.value, 10);

            if (isNaN(start) || start < 1) start = 1;
            if (isNaN(end) || end < 1) end = videoData.length;

            start = Math.min(start, videoData.length);
            end = Math.min(end, videoData.length);
            if (start > end) start = end;

            startIndex = start;
            endIndex = end;

            startInput.value = start;
            endInput.value = end;

            updatePanel();
        }

        applyBtn.addEventListener("click", applyRange);

        // Optional: live update as you type (debounced)
        let timeout;
        startInput.addEventListener("input", () => {
            clearTimeout(timeout);
            timeout = setTimeout(applyRange, 500);
        });
        endInput.addEventListener("input", () => {
            clearTimeout(timeout);
            timeout = setTimeout(applyRange, 500);
        });

        // Initialize with current data
        updatePanel();
    }

    // Initialize the extension on playlist pages
    function init() {
        if (!window.location.pathname.includes("/playlist")) return;

        // Wait for playlist container to exist
        const checkExist = setInterval(() => {
            const container = document.querySelector(VIDEO_LIST_SELECTOR);
            if (container) {
                clearInterval(checkExist);
                createPanel();

                // Observe playlist container for changes (new videos loaded)
                if (observer) observer.disconnect();
                observer = new MutationObserver(() => {
                    updatePanel();
                });
                observer.observe(container, { childList: true, subtree: true });
            }
        }, 500);
    }

    // YouTube is a SPA; listen for navigation events
    document.addEventListener("yt-navigate-finish", init);

    // Initial run
    init();
})();
