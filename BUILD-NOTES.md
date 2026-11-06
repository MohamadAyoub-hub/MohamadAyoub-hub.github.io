# The Data Room

This is the static GitHub Pages package for Mohamad Ayoub's portfolio. Copy index.html and the entire assets folder to the site root, preserving paths and filename case. The package includes Three.js r187 and its MIT license.

For a local 3D preview, run python -m http.server 8000 in the extracted folder and open http://localhost:8000. Opening index.html directly still gives access to the static walkthrough, sample values and date filter.

## The live workflow

- Scroll moves the records through the ledger, Python staging, validation, SQL relationships and the 3D reporting chart. The 3D viewer stops drawing once offscreen. Both themes support the viewer and the motion control.
- Select a sample order in the ledger to follow it. Validation routes held rows to a separate amber lane. The SQL scene and reporting total include approved rows only.
- The date filter shows USD 120.00 on October 1, USD 89.00 on October 2, USD 58.00 on October 5 and USD 267.00 for all dates. The report scene shows the full sample total. Its chapter also has a full Power BI-style preview.
- The animated wallpaper and the original package pricing are included. The static walkthrough stays available when motion is paused, the visitor requests reduced motion or WebGL is unavailable.

## Verification

Chrome checked the live workflow, scroll-linked geometry, exception controls, date filter, sample report and motion settings at desktop and mobile widths.
