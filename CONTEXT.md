# Qwanvas

Qwanvas is an offline-first creation tool for lightweight social-media visuals and slide decks, using portable HTML/CSS project files that AI tools can generate or edit outside the app.

## Language

**Project**:
An editable saved work containing one or more pages for a social-media visual.
_Avoid_: File, document, spec

**Page**:
A single visual canvas in a project, exported as one image or one slide in a deck.
_Avoid_: Image, artboard, frame

**Deck**:
A project with multiple ordered pages intended to be exported together.
_Avoid_: Carousel, PDF

**Canvas**:
The editing surface for one page.
_Avoid_: Editor, slide, board

**Element**:
An editable item placed on a canvas, such as text, an image, or a shape.
_Avoid_: Block, layer, object

**Template**:
A reusable starting layout that defines the initial arrangement and visual style of a page or deck.
_Avoid_: Theme, preset, draft

**Draft**:
An AI-generated starting point represented as a portable project file and imported into the app for editing.
_Avoid_: Final, template

**Project File**:
A portable HTML file that contains a rendered project plus embedded editable project data.
_Avoid_: JSON export, document, spec

**Style File**:
A CSS file that controls the visual presentation of a project file.
_Avoid_: Theme, template

**Manual Edit**:
A direct user change to elements on the canvas.
_Avoid_: Tweak, adjustment

**AI Edit**:
A user-requested change generated outside the app and applied by importing an updated project file.
_Avoid_: In-app prompt, generation

**Local Library**:
The browser-stored collection of projects and reusable assets available offline.
_Avoid_: Backend, database, cloud storage

**Export**:
A rendered output of one page or deck for sharing outside the app.
_Avoid_: Save, publish

## Relationships

- A **Project** contains one or more **Pages**.
- A **Deck** is a **Project** with multiple ordered **Pages**.
- A **Page** has exactly one **Canvas**.
- A **Canvas** contains zero or more **Elements**.
- A **Draft** can create a new **Project** from a **Project File**.
- A **Project File** may reference or embed a **Style File**.
- A **Manual Edit** or an **AI Edit** changes a **Project**.
- The **Local Library** stores **Projects** and reusable assets.
- An **Export** is produced from a **Page** or **Deck**.

## Example dialogue

> **Dev:** "When the user asks AI for a LinkedIn post, do we call AI inside Qwanvas?"
> **Domain expert:** "No — AI creates or edits a **Project File** outside the app. The user imports it, then edits the **Pages** and **Elements** on the **Canvas**."

## Flagged ambiguities

- "image" was used to mean both a whole exported visual and an inserted picture; resolved: use **Page** for the whole visual and **Element** for an inserted image item.
- "slide" and "carousel" were used interchangeably; resolved: use **Page** for one canvas and **Deck** for multiple ordered pages.
- "template" and "draft" were mixed; resolved: a **Template** is reusable structure, while a **Draft** is AI-generated project content.
- "AI" was used to mean an in-app prompt flow and an external file-generation workflow; resolved: **AI Edit** happens outside the app through **Project Files**.
