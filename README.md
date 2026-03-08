# YouTube Playlist Analyzer

A feature-rich Chrome Extension (Manifest V3) that helps you analyze, sort, and isolate videos within any YouTube playlist. It embeds a modern UI panel directly into the YouTube playlist sidebar.

## Features

- **Total Duration Calculation:** Instantly see the total runtime of your selected videos.
- **Range Selection:** Choose a specific range of videos (e.g., videos 1 to 10) using easy-to-use dropdowns that show video titles.
- **Visual Sorting:** Physically reorder videos on the page by:
  - **Index:** Ascending or Descending.
  - **Title:** A-Z or Z-A.
  - **Duration:** Shortest or Longest first.
- **Focus Mode:** A toggle to hide all videos on the page except for your selected range, helping you focus on specific content.
- **SPA Compatibility:** Works seamlessly with YouTube's navigation without needing to refresh the page.
- **Lightweight:** Built with vanilla JavaScript and CSS for maximum performance.

## Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the project folder.
6. Navigate to any YouTube playlist (e.g., `https://www.youtube.com/playlist?list=...`) to see the analyzer in action.

## How to Use

1. **Sort:** Use the "Sort by" dropdown at the top to change the order of the videos on the page.
2. **Range:** Select your "From" and "To" videos. The statistics will update instantly.
3. **Focus:** Toggle "Focus Selected Videos" to hide everything outside your chosen range.

## Development

The project uses:
- **Manifest V3** for modern browser standards.
- **Content Scripts** to interact with the YouTube DOM.
- **CSS Flexbox/Order** for visual reordering without breaking YouTube's internal logic.
- **MutationObservers** to detect when YouTube loads more videos as you scroll.
