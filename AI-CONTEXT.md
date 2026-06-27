# Qwanvas AI Context

Qwanvas projects are portable HTML files with embedded project data and optional companion CSS. AI tools should generate or edit those files outside the app, then the user imports the HTML into Qwanvas for fast manual editing.

## Output contract

Generate a complete `.html` file that contains:

- A rendered `.qwanvas-project` with one or more `.qwanvas-page` sections.
- A `<style>` block or companion `.css` file using the `.qwanvas-*` classes.
- A lossless `<script type="application/json" data-qwanvas-project>` block containing the editable project model.

The JSON block is the source of truth for re-import. The visible HTML should match it so the file remains readable and useful outside the app.

## Project JSON shape

```json
{
  "id": "project-id",
  "name": "Project name",
  "updatedAt": 1780000000000,
  "activePageId": "page-1",
  "pages": [
    {
      "id": "page-1",
      "name": "Page 1",
      "backgroundId": "blank",
      "elements": [
        {
          "id": "headline",
          "type": "text",
          "text": "Readable hook",
          "x": 50,
          "y": 34,
          "w": 78,
          "h": 18,
          "rotation": 0,
          "z": 2,
          "fontSize": 58,
          "color": "#ffffff",
          "font": "Inter",
          "bold": true,
          "italic": false
        }
      ]
    }
  ]
}
```

Supported element types:

- `text` — editable copy and typography.
- `image` — `src` should be a data URL for maximum portability.
- `shape` — simple colored rectangle/card.

Coordinates are percentages of the page: `x`, `y`, `w`, and `h` are numbers from 0–100. Pages use a 4:5 social-media ratio.

## Design guidance

- The application shell targets laptop-size screens and larger only (1024px wide and up); small-screen responsive layouts are intentionally out of scope.
- The editor UI must fit inside 100% viewport width and height with no body/app scrolling. When space is tight on supported screens, controls and the canvas should scale down or clip within their panels rather than introducing scrollbars.
- Prefer a few large elements over dense layouts.
- Keep social posts readable at phone size.
- Use strong hierarchy: one main hook, one supporting idea, one visual anchor.
- Avoid complex image editing assumptions; Qwanvas is for fast layout editing, not Photoshop-style retouching.
- Keep all important content within the page bounds.
