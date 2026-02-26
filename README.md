# 🎓 LearnPath — Complete Developer & User Guide

> **Your personal learning progress tracker — built with HTML, CSS & React.**
> From first click to full mastery, this guide takes you step by step.
> Fully readable on mobile. No laptop required.

---

## 📋 Table of Contents

| # | Section | What's Inside |
|---|---------|---------------|
| 1 | [App Overview](#-section-1--app-overview) | What it does, the hierarchy, key features |
| 2 | [Full Workflow](#-section-2--full-workflow-start-to-finish) | Step-by-step flow from open to saved |
| 3 | [Tech Stack](#-section-3--tech-stack-explained) | Every technology used and why |
| 4 | [App Structure](#-section-4--full-application-structure) | Files, components, architecture |
| 5 | [Best Practices](#-section-5--best-practices-used) | Patterns, conventions, optimisations |
| 6 | [Topics Covered](#-section-6--key-topics-you-will-master) | Skills this app teaches |
| 7 | [JSON Format & Sample](#-section-7--json-format--full-import-sample) | Schema + complete importable roadmap |
| 8 | [Mastery Path](#-section-8--step-by-step-mastery-path) | Staged learning plan with tasks |
| 9 | [Mobile Learning](#-section-9--mobile-friendly-learning-guide) | Phone tools, tips, daily routine |
| 10 | [Troubleshooting](#-section-10--troubleshooting--faq) | Common questions answered |
| 11 | [Feature Ideas](#-section-11--extension-ideas) | What to build next |

---

## 🧭 Section 1 — App Overview

### What is LearnPath?

**LearnPath** is a browser-based learning progress tracker. It lets you organise *any subject* into a structured, visual hierarchy — then tick items off as you learn them.

Everything runs in three plain files. No server. No login. No cloud. 100% private.

---

### The 5-Level Hierarchy

```
Roadmap
└── Phase
    └── Section
        └── Topic
            └── Subtopic  ← the leaf node you check off
```

| Level | Example | Role |
|-------|---------|------|
| **Roadmap** | "Web Dev Journey" | Top-level container |
| **Phase** | "Phase 1: Foundations" | Major milestone |
| **Section** | "HTML Basics" | Topic group |
| **Topic** | "Semantic Tags" | Individual subject |
| **Subtopic** | "`<header>`, `<nav>`, `<main>`" | Granular item (checkable) |

---

### Key Features

| Feature | What It Does |
|---------|--------------|
| 🏗️ **Build Phase (Visual UI)** | Create phase structure without writing JSON |
| ✏️ **Edit Phase** | Modify any saved phase at any time |
| 📤 **JSON Upload** | Import a pre-written roadmap in seconds |
| 📊 **Live Progress** | Real-time % per phase and roadmap-wide |
| ☑️ **Smart Checkboxes** | Tick subtopics — parents auto-update |
| 💾 **Export / Import** | Back up and restore progress as JSON |
| 🔍 **Global Search** | Find any topic across all phases instantly |
| ✏️ **Node-Level Edit** | Rename any node inline |
| 📴 **100% Offline** | Works with no internet after first load |

---

## 🔄 Section 2 — Full Workflow: Start to Finish

### Step 1 — App Loads

When you open `index.html`:

1. React mounts `<App />` via `ReactDOM.render()`
2. A `useEffect` fires immediately and calls `StorageService.loadRoadmaps()`
3. `loadRoadmaps()` reads `"learning_tracker_roadmaps_v1"` from `localStorage`
4. Each phase's raw JSON is passed through `buildTree()` → reconstructs `TreeNode` objects in memory
5. `applyCompletionMap()` restores which checkboxes were ticked
6. State is set → React re-renders → your data appears

---

### Step 2 — Creating a Roadmap

Click **New Roadmap** → type a name → click **Create**.

```
handleCreateRoadmap(name)
    ↓
{ id: generateRoadmapId(), name, phases: [] }
    ↓
setRoadmaps([...prev, newRoadmap])
    ↓
Auto-save fires → localStorage updated
```

---

### Step 3 — Adding a Phase

#### Method A — Visual Builder (No JSON needed)

1. Click the **⧉ sitemap icon** in the Phases sidebar card
2. Enter **Phase Name** and optional **Description**
3. Click **Add Section** → add **Topics** → add **Subtopics**
4. Click **Create Phase**

```
BuildPhaseModal serialises builder state
    ↓
{ phase, title, sections: [ { title, topics: [ ... ] } ] }
    ↓
handleBuildPhase(phaseData)
    ↓
buildTree(phaseData) → TreeNode tree
    ↓
Phase appended to active roadmap
```

#### Method B — JSON Upload

Click **Upload JSON** → select a `.json` file → done.

The `FileReader` API reads it, `JSON.parse()` processes it, `buildTree()` builds the tree. Same pipeline as Method A.

---

### Step 4 — Editing a Saved Phase

Each phase in the sidebar shows three icons:

| Icon | Action |
|------|--------|
| ✏️ Edit (pencil-square) | Opens EditPhaseModal — pre-filled with current structure |
| 🖊 Rename (pen) | Quick rename only |
| 🗑 Delete (trash) | Permanently removes the phase |

**What happens when you save edits:**

```
handleSaveEditedPhase(phaseData, index)
    ↓
buildTree(phaseData) — fresh tree from new structure
    ↓
serializeCompletionMap(oldRoot) — saves old ✓ states
    ↓
applyCompletionMap(newRoot, oldMap) — restores matching positions
    ↓
roadmaps state updated → auto-save fires
```

> **💡 Progress is preserved** for items that stay in the same structural position.

---

### Step 5 — Checking Off Items

Click any checkbox in the tree:

```
handleCheckNode(node)
    ↓
setNodeAndChildren(node, !node.completed)  — toggles node + all descendants
    ↓
updateParents(node)  — walks up: all siblings done? parent = complete
    ↓
setRoadmaps([...roadmaps])  — triggers re-render
    ↓
Auto-save fires
```

---

### Step 6 — Progress Calculation

Progress is **always computed live** — never pre-stored.

```javascript
// On any TreeNode:
calculateProgress() {
  const leaves = getAllLeafNodes(this);
  return (leaves.filter(n => n.completed).length / leaves.length) * 100;
}
```

The `ProgressCircle` is a pure SVG component that draws a circle arc using `stroke-dashoffset` based on the `%` prop.

---

### Step 7 — Export & Import

#### Exporting
```
Header → Export
    ↓
StorageService.exportProgress(roadmaps)
    ↓
JSON blob → Blob URL → browser download trigger
    ↓
URL.revokeObjectURL() — cleans up memory
```

#### Importing
```
Header → Import → paste or upload JSON
    ↓
StorageService.validateImport(data)
    ↓
Choose: Merge (add to current) or Overwrite (replace all)
    ↓
Roadmaps/phases loaded into state → auto-save fires
```

---

## ⚙️ Section 3 — Tech Stack Explained

### Overview

| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | — | App skeleton and entry point |
| CSS3 | — | All styling (~2,000 lines) |
| React | 18 (CDN) | UI framework |
| Babel Standalone | CDN | Transpiles JSX in the browser |
| Font Awesome | 6 (CDN) | Icon library |
| Google Fonts (Inter) | CDN | Typography |
| localStorage API | Browser | Data persistence |
| FileReader API | Browser | Reading uploaded JSON files |
| Blob + URL API | Browser | Generating downloadable exports |
| Clipboard API | Browser | Copy-to-clipboard feature |

---

### 1. HTML5

The entire app lives in a **single `index.html`**. Key decisions:

- `<!DOCTYPE html>` — standards mode, not quirks mode
- CDN `<link>` tags for fonts and icons — no local dependencies
- `<div id="root">` — the single mount point React takes over
- `<script type="text/babel">` — tells Babel to compile JSX at runtime

---

### 2. CSS3

All styles live in `style.css`. Key techniques:

```css
/* Theme system via custom properties */
:root {
  --primary:    #6366f1;  /* indigo */
  --secondary:  #10b981;  /* emerald */
  --accent:     #f59e0b;  /* amber */
  --bg-main:    #1e1e1e;
  --border:     #444444;
}
```

| CSS Technique | Where Used |
|---------------|-----------|
| CSS Custom Properties | Theme colours, spacing, border-radius |
| Flexbox | Header, sidebar, phase items, modal footers |
| CSS Grid | 2-column form layouts, stats panels |
| `position: sticky` | Header stays visible when tree scrolls |
| `stroke-dashoffset` | SVG progress circle animation |
| `@keyframes` | Toast slide-in, transitions |
| `@media` queries | Responsive breakpoints at 600px, 768px, 1024px |
| `z-index` layering | Header (100), modals (200), toasts (300) |

---

### 3. React 18

Loaded from `unpkg.com` CDN — no npm, no webpack, no build step.

| React Feature | Used For |
|---------------|----------|
| `React.useState` | All UI state — roadmaps array, modal visibility, active phase |
| `React.useEffect` | Storage sync, event listeners, scroll handler, ESC key |
| `React.useRef` | ID counters in modals, file input refs |
| Conditional rendering | `{condition && <Component />}`, ternary operators |
| Derived state | `activeRoadmap` and `phases` computed on every render |
| Callback props | All CRUD operations passed as `onDelete`, `onEdit`, `onSave` |
| Event delegation | `e.stopPropagation()` on action buttons inside clickable rows |

---

### 4. Babel Standalone

Normally, JSX requires a build tool. Here:

```html
<script type="text/babel">
  // JSX works here — Babel compiles it in the browser
  const App = () => <div>Hello</div>;
</script>
```

This removes all toolchain complexity. Perfect for learning and single-file apps.

---

### 5. localStorage

```javascript
// Write
localStorage.setItem('learning_tracker_roadmaps_v1', JSON.stringify(data));

// Read
const raw = localStorage.getItem('learning_tracker_roadmaps_v1');
const data = JSON.parse(raw);

// Clear
localStorage.removeItem('learning_tracker_roadmaps_v1');
```

> ⚠️ **Limit:** ~5 MB per origin. Cleared when you clear browser data. Always export backups!

---

### 6. FileReader API (Upload)

```javascript
const reader = new FileReader();
reader.onload = (e) => {
  const json = JSON.parse(e.target.result);
  onUpload(json);
};
reader.readAsText(file);
```

---

### 7. Blob + URL API (Export / Download)

```javascript
const blob = new Blob(
  [JSON.stringify(data, null, 2)],
  { type: 'application/json' }
);
const url = URL.createObjectURL(blob);
link.href = url;
link.download = 'learning-progress.json';
link.click();
URL.revokeObjectURL(url); // free memory
```

---

### 8. Clipboard API

```javascript
// Modern approach (requires HTTPS)
await navigator.clipboard.writeText(content);

// Fallback for older browsers
const textarea = document.createElement('textarea');
textarea.value = content;
document.body.appendChild(textarea);
textarea.select();
document.execCommand('copy');
document.body.removeChild(textarea);
```

---

## 🗂️ Section 4 — Full Application Structure

### File Structure

```
learnpath/
├── index.html     ← Entry point, CDN links, <div id="root">
├── style.css      ← All styling (~2,000 lines)
└── app.js         ← All logic and UI (~3,100 lines)
```

---

### `app.js` — Section Map

| Section Banner | Contents |
|----------------|----------|
| `// UTILITY FUNCTIONS` | `generateId`, `generateRoadmapId`, `detectNodeType` |
| `// COPY UTILITY FUNCTIONS` | `formatCopyContent`, `copyToClipboard` |
| `// TREE BUILDER` | `TreeNode` class + `buildTree()` factory |
| `// STORAGE SERVICE` | `save`, `load`, `export`, `import`, `validate`, `clear` |
| `// INFO MODAL` | Extended metadata modal (objectives, assignments) |
| `// EDIT MODAL` | Inline node title editor |
| `// TREE NODE COMPONENT` | Recursive component rendering one node + children |
| `// PROGRESS CIRCLE` | SVG donut chart component |
| `// PHASE LIST ITEM` | One row in the sidebar phases list |
| `// ROADMAP LIST ITEM` | One row in the sidebar roadmaps list |
| `// CREATE ROADMAP MODAL` | Modal to name a new roadmap |
| `// RENAME ROADMAP MODAL` | Reusable rename dialog (used for phases too) |
| `// BUILD PHASE MODAL` | Visual phase builder (blank slate) |
| `// EDIT PHASE MODAL` | Visual phase editor (pre-populated) |
| `// UPLOAD MODAL` | Drag-and-drop / click JSON uploader |
| `// IMPORT MODAL` | Multi-mode progress import |
| `// DELETE CONFIRMATION MODAL` | Delete all progress dialog |
| `// SMALL CONFIRM MODAL` | Reusable yes/no confirmation |
| `// GLOBAL SEARCH RESULTS` | Full-screen search overlay |
| `// TOAST` | Auto-dismissing notification |
| `// MAIN APP` | Root component — all state, handlers, render |
| `ReactDOM.render(...)` | Entry point — mounts App into DOM |

---

### The `TreeNode` Class

This is the **core data model**. Everything in the app revolves around it.

```javascript
class TreeNode {
  constructor(data, parentId, level, index) {
    this.id          // "1.2.3" — positional, dot-notation
    this.type        // "phase" | "section" | "topic" | "subtopic"
    this.title       // display name
    this.data        // raw JSON reference (for info modal / edits)
    this.level       // depth: 0 = phase root
    this.children    // TreeNode[]
    this.completed   // boolean — progress state
    this.expanded    // boolean — tree expand/collapse
    this.parent      // parent TreeNode (enables walking up)
    this.highlighted // temporary — search result flash
  }
}
```

**Key Methods:**

| Method | Returns | Purpose |
|--------|---------|---------|
| `isLeaf()` | `boolean` | True if no children — these are the checkable nodes |
| `calculateProgress()` | `0–100` | `completedLeaves / totalLeaves * 100` |
| `getCompletionState()` | `"complete"` \| `"partial"` \| `"incomplete"` | For checkbox rendering |
| `getAllDescendants()` | `TreeNode[]` | Flattens entire subtree |

---

### Data Flow Diagram

```
User Action
    ↓
React Event Handler (in App)
    ↓
State Update (setRoadmaps / setActive...)
    ↓
React Re-render
    ↓
useEffect watches roadmaps
    ↓
StorageService.saveRoadmaps()
    ↓
localStorage.setItem(key, JSON.stringify(data))
```

---

## ✅ Section 5 — Best Practices Used

### 1. Immutable State Updates

React requires state to be **replaced**, not mutated:

```javascript
// ✅ Correct — new array
setRoadmaps(prev => prev.map(r =>
  r.id === targetId ? { ...r, name: newName } : r
));

// ❌ Wrong — mutates existing array
roadmaps[0].name = newName;
setRoadmaps(roadmaps); // React won't re-render
```

> **Exception:** `TreeNode` objects themselves are mutated (`node.completed = true`) before calling `setRoadmaps([...roadmaps])`. Deep-cloning 1,000 nodes on every tick would be too slow.

---

### 2. Derived State — No Duplication

`activeRoadmap` and `phases` are **computed on every render**, never stored separately:

```javascript
// Always in sync — no stale state risk
const activeRoadmap = roadmaps.find(r => r.id === activeRoadmapId) || null;
const phases = activeRoadmap ? activeRoadmap.phases : [];
```

---

### 3. `useRef` for Synchronous Counters

The phase builder uses `useRef` — not `useState` — for ID generation:

```javascript
const idRef = React.useRef(1000);
const newId = () => `bn-${idRef.current++}`;
```

> **Why not `useState`?** State updates are asynchronous and batched. Calling `setCount(count + 1)` three times in a loop gives three nodes with the **same** ID. `useRef.current` mutates synchronously.

---

### 4. Event Propagation Control

Phase list items are clickable rows (selecting the phase). But their action buttons must not also trigger the row:

```javascript
// ✅ Prevent the click from bubbling to the parent row
onClick={(e) => {
  e.stopPropagation();
  onDelete(index);
}}
```

---

### 5. Callback Props Pattern

No component touches shared state directly. Data flows **down via props**; events flow **up via callbacks**:

```
App (owns state)
├── PhaseListItem receives: onDelete, onRename, onEdit
├── BuildPhaseModal receives: onCreate
└── EditPhaseModal receives: onSave
         ↓
    Calls callback
         ↓
    App updates state
```

---

### 6. Progress Preservation During Edits

When you restructure a phase, items in the same position keep their ✓:

```javascript
// 1. Snapshot the old completion state
const oldMap = StorageService.serializeCompletionMap(oldPhase.root);
// { "1.1": { completed: true }, "1.2": { completed: false }, ... }

// 2. Build the new tree
const newRoot = buildTree(updatedPhaseData);
// New IDs are positional: "1.1", "1.2", "1.2.1", etc.

// 3. Apply old state — position-matching items keep their progress
StorageService.applyCompletionMap(newRoot, oldMap);
```

---

### 7. Service Object Pattern

All storage logic is grouped in one place:

```javascript
const StorageService = {
  saveRoadmaps(roadmaps)   { /* ... */ },
  loadRoadmaps()           { /* ... */ },
  exportProgress(roadmaps) { /* ... */ },
  validateImport(data)     { /* ... */ },
  clearAllProgress()       { /* ... */ },
};
```

UI components never call `localStorage` directly — only `StorageService` does.

---

### 8. Graceful Error Handling

Every user-triggered operation is wrapped:

```javascript
try {
  const json = JSON.parse(e.target.result);
  onUpload(json);
} catch (error) {
  addToast('Invalid JSON file. Please check the format.', 'error');
}
```

Failures show typed toast notifications (`'error'`, `'success'`) — users always know what happened.

---

## 📚 Section 6 — Key Topics You Will Master

Building and studying LearnPath teaches you these skills:

### Web Fundamentals

| Topic | What You Learn |
|-------|---------------|
| **HTML Structure** | Semantic elements, CDN linking, single-page mount points |
| **CSS Variables** | Defining and consuming `:root` custom properties |
| **CSS Flexbox** | Row alignment, gap, justify-content, align-items |
| **CSS Grid** | `grid-template-columns`, `auto-fit`, `minmax()` |
| **CSS Animations** | Keyframe slide-in for toasts, `stroke-dashoffset` for circles |
| **SVG** | `<circle>`, `stroke-dasharray`, `stroke-dashoffset` |
| **Responsive Design** | `@media` queries, mobile-first approach |

### JavaScript

| Topic | What You Learn |
|-------|---------------|
| **Classes** | `constructor`, methods, `this`, instance vs. class |
| **Recursion** | `buildTree()`, `calculateProgress()`, `updateParents()` |
| **Tree Structures** | Parent refs, leaf detection, depth traversal |
| **Closures** | How callbacks capture outer variables |
| **Async Patterns** | `FileReader`, `async/await`, `navigator.clipboard` |
| **JSON** | `JSON.parse()`, `JSON.stringify()`, schema design |

### React

| Topic | What You Learn |
|-------|---------------|
| **`useState`** | Simple booleans, strings, complex object arrays |
| **`useEffect`** | Mounting, dependencies, cleanup, localStorage sync |
| **`useRef`** | DOM refs, synchronous mutable counters |
| **Conditional rendering** | `&&`, ternary, short-circuit patterns |
| **Derived state** | When to compute vs. when to store |
| **Component composition** | Modal pattern, callback props, reusable dialogs |

### Browser APIs

| Topic | What You Learn |
|-------|---------------|
| **`localStorage`** | Read, write, remove, limits |
| **`FileReader`** | Async file reading |
| **`Blob` + URL** | In-browser file downloads |
| **`Clipboard`** | Write to clipboard with fallback |
| **Drag & Drop** | HTML5 `ondrop`, `ondragover`, `ondragleave` |

---

## 📦 Section 7 — JSON Format & Full Import Sample

### The JSON Schema

Every phase is a JSON object with this structure:

```json
{
  "phase": "Phase 1",
  "title": "Foundations",
  "sections": [
    {
      "title": "HTML Basics",
      "topics": [
        {
          "title": "Document Structure",
          "subtopics": [
            { "title": "DOCTYPE declaration" },
            { "title": "html, head, body" },
            { "title": "Semantic elements" }
          ]
        }
      ]
    }
  ]
}
```

To upload **multiple phases at once**, wrap them in an array:

```json
[
  { "phase": "Phase 1", "title": "...", "sections": [ ... ] },
  { "phase": "Phase 2", "title": "...", "sections": [ ... ] }
]
```

---

### Optional Metadata Fields

Add these to any section, topic, or subtopic for richer info panels:

```json
{
  "title": "Flexbox",
  "description": "CSS layout system for one-dimensional arrangements.",
  "duration": "3 hours",
  "details": ["display: flex", "justify-content", "align-items"],
  "learningObjectives": ["Understand the flex container model"],
  "learningOutcomes": ["Build nav bars and card grids with flexbox"],
  "practicalAssignments": ["Build a 3-column card layout"],
  "assessmentIdeas": ["Quiz: which property centres items horizontally?"]
}
```

---

### ✅ Full Sample JSON — Web Development Roadmap

> 📋 **How to import:**
> 1. Copy everything below between the triple backticks
> 2. Save it as `webdev-roadmap.json`
> 3. Open LearnPath → create a roadmap → click **Upload JSON** → select the file
> 4. All 3 phases appear instantly ✨

```json
[
  {
    "phase": "Phase 1",
    "title": "Web Foundations",
    "sections": [
      {
        "title": "HTML Essentials",
        "description": "The language of the web — structure before style.",
        "topics": [
          {
            "title": "Document Structure",
            "subtopics": [
              { "title": "DOCTYPE declaration" },
              { "title": "html, head, body tags" },
              { "title": "Meta tags and charset" },
              { "title": "Viewport meta tag for mobile" }
            ]
          },
          {
            "title": "Semantic HTML",
            "subtopics": [
              { "title": "header, nav, main, footer" },
              { "title": "article, section, aside" },
              { "title": "h1–h6 heading hierarchy" },
              { "title": "p, span, div — differences" }
            ]
          },
          {
            "title": "Forms & Input",
            "subtopics": [
              { "title": "form, input, label elements" },
              { "title": "Input types: text, email, password, number" },
              { "title": "button, select, textarea" },
              { "title": "Built-in validation attributes" }
            ]
          }
        ]
      },
      {
        "title": "CSS Fundamentals",
        "description": "Styling, layout, and responsive design.",
        "topics": [
          {
            "title": "Selectors & Specificity",
            "subtopics": [
              { "title": "Element, class, ID selectors" },
              { "title": "Pseudo-classes: :hover, :focus, :nth-child" },
              { "title": "Specificity calculation" },
              { "title": "Cascade and inheritance" }
            ]
          },
          {
            "title": "Box Model",
            "subtopics": [
              { "title": "content, padding, border, margin" },
              { "title": "box-sizing: border-box" },
              { "title": "Width, height, max-width, min-height" }
            ]
          },
          {
            "title": "Flexbox",
            "subtopics": [
              { "title": "display: flex" },
              { "title": "flex-direction, flex-wrap" },
              { "title": "justify-content, align-items, align-self" },
              { "title": "flex-grow, flex-shrink, flex-basis" }
            ]
          },
          {
            "title": "CSS Grid",
            "subtopics": [
              { "title": "grid-template-columns and rows" },
              { "title": "grid-column and grid-row span" },
              { "title": "gap property" },
              { "title": "auto-fit and auto-fill with minmax()" }
            ]
          },
          {
            "title": "CSS Custom Properties",
            "subtopics": [
              { "title": "Defining variables in :root" },
              { "title": "Using var() to consume them" },
              { "title": "Updating variables for theming" }
            ]
          }
        ]
      }
    ]
  },
  {
    "phase": "Phase 2",
    "title": "JavaScript Core",
    "sections": [
      {
        "title": "Language Fundamentals",
        "topics": [
          {
            "title": "Variables & Data Types",
            "subtopics": [
              { "title": "var, let, const — differences and scoping" },
              { "title": "Primitives: string, number, boolean, null, undefined" },
              { "title": "typeof operator" },
              { "title": "Type coercion and strict equality ===" }
            ]
          },
          {
            "title": "Functions",
            "subtopics": [
              { "title": "Function declarations and expressions" },
              { "title": "Arrow functions =>" },
              { "title": "Default parameters" },
              { "title": "Rest parameters (...args)" },
              { "title": "Closures — what they are and why they matter" }
            ]
          },
          {
            "title": "Arrays & Objects",
            "subtopics": [
              { "title": "Array methods: map, filter, reduce, find" },
              { "title": "Destructuring: const { a } = obj, const [x] = arr" },
              { "title": "Object spread: { ...obj, key: value }" },
              { "title": "Optional chaining: obj?.prop?.nested" },
              { "title": "Nullish coalescing: value ?? 'default'" }
            ]
          }
        ]
      },
      {
        "title": "DOM & Events",
        "topics": [
          {
            "title": "DOM Manipulation",
            "subtopics": [
              { "title": "querySelector and querySelectorAll" },
              { "title": "createElement, appendChild, removeChild" },
              { "title": "innerHTML vs textContent" },
              { "title": "classList: add, remove, toggle, contains" }
            ]
          },
          {
            "title": "Event Handling",
            "subtopics": [
              { "title": "addEventListener and removeEventListener" },
              { "title": "Event bubbling and capturing" },
              { "title": "event.stopPropagation()" },
              { "title": "event.preventDefault()" },
              { "title": "Event delegation pattern" }
            ]
          }
        ]
      },
      {
        "title": "Async JavaScript",
        "topics": [
          {
            "title": "Promises",
            "subtopics": [
              { "title": "new Promise(resolve, reject)" },
              { "title": ".then(), .catch(), .finally()" },
              { "title": "Promise.all() — parallel execution" },
              { "title": "Promise.race() — first-to-resolve wins" }
            ]
          },
          {
            "title": "Async / Await",
            "subtopics": [
              { "title": "async function syntax" },
              { "title": "await keyword — pausing execution" },
              { "title": "try/catch with async functions" },
              { "title": "Parallel vs sequential async patterns" }
            ]
          },
          {
            "title": "Fetch API",
            "subtopics": [
              { "title": "fetch(url) basics" },
              { "title": "response.json() and response.text()" },
              { "title": "POST requests with headers and body" },
              { "title": "Error handling with response.ok check" }
            ]
          }
        ]
      }
    ]
  },
  {
    "phase": "Phase 3",
    "title": "React & Modern Tooling",
    "sections": [
      {
        "title": "React Core Concepts",
        "description": "The library that powers LearnPath.",
        "topics": [
          {
            "title": "Components & JSX",
            "subtopics": [
              { "title": "Functional component syntax" },
              { "title": "JSX expressions with {}" },
              { "title": "Props — passing data down" },
              { "title": "children prop" },
              { "title": "Rendering lists with .map() and key prop" }
            ]
          },
          {
            "title": "React Hooks",
            "subtopics": [
              { "title": "useState — local component state" },
              { "title": "useEffect — side effects and cleanup" },
              { "title": "useRef — DOM refs and mutable values" },
              { "title": "Custom hooks — extracting reusable logic" }
            ]
          },
          {
            "title": "State Patterns",
            "subtopics": [
              { "title": "Lifting state up" },
              { "title": "Derived state vs stored state" },
              { "title": "Immutable updates with spread operator" },
              { "title": "Callback props pattern" },
              { "title": "Controlled vs uncontrolled components" }
            ]
          }
        ]
      },
      {
        "title": "Component Architecture",
        "topics": [
          {
            "title": "Composition Patterns",
            "subtopics": [
              { "title": "Reusable modal pattern" },
              { "title": "Compound components" },
              { "title": "Render props pattern" },
              { "title": "When to split components" }
            ]
          },
          {
            "title": "Performance Considerations",
            "subtopics": [
              { "title": "Why derived state beats duplicate state" },
              { "title": "When mutation is acceptable (TreeNode pattern)" },
              { "title": "Avoiding unnecessary re-renders" }
            ]
          }
        ]
      },
      {
        "title": "Developer Tooling",
        "topics": [
          {
            "title": "npm & Node.js",
            "subtopics": [
              { "title": "npm init, install, run scripts" },
              { "title": "package.json and lock files" },
              { "title": "node_modules and .gitignore" }
            ]
          },
          {
            "title": "Vite Build Tool",
            "subtopics": [
              { "title": "npm create vite@latest" },
              { "title": "Dev server vs production build (npm run build)" },
              { "title": "Environment variables with .env files" }
            ]
          },
          {
            "title": "Git & GitHub",
            "subtopics": [
              { "title": "git init, add, commit, push" },
              { "title": "Branches: feature, main, merge" },
              { "title": "GitHub Pages for free hosting" },
              { "title": "Pull requests and code review" }
            ]
          }
        ]
      }
    ]
  }
]
```

---

## 🗺️ Section 8 — Step-by-Step Mastery Path

### Stage 1 — Use It As a User *(Days 1–2)*

Before reading code, **use the app** and form intuitions.

- [ ] Open `index.html` in Chrome or Firefox
- [ ] Create a roadmap → name it "My Learning Journey"
- [ ] Build a phase using the visual UI — add 2 sections, 3 topics each
- [ ] Tick off some topics — watch the progress circle change
- [ ] Export your progress → open the `.json` file in a text editor
- [ ] Reload the browser — confirm your data is still there
- [ ] Try the global search (🔍 button, bottom-right)
- [ ] **Task:** Import the Web Development JSON from Section 7

---

### Stage 2 — Read the Code Structure *(Days 3–5)*

Open `app.js` in a text editor. Use the section headers as a map.

- [ ] Read the `TreeNode` class — draw it on paper as a box with arrows
- [ ] Read `buildTree()` — trace through it with a small JSON object in your head
- [ ] Read `StorageService` — note which methods touch `localStorage` directly
- [ ] Read `PhaseListItem` — what props does it receive? What does it render?
- [ ] List every `useState` in `App` and what it represents

> **Task:** Find `handleCheckNode`. Trace every line it executes when you tick a checkbox.

---

### Stage 3 — CSS & Styling Mastery *(Days 6–10)*

- [ ] Find `:root` in `style.css` — read every variable, understand what it controls
- [ ] Change `--primary` from `#6366f1` to `#e11d48` — see the theme change
- [ ] Add `box-shadow` to `.phase-item` and observe the result
- [ ] Find `@media (max-width: 768px)` — use DevTools to resize to 400px
- [ ] Read `.build-phase-modal` — why is `max-height: 88vh` needed?

> **Task:** Add a new CSS variable `--accent2` and use it on the ProgressCircle fill.

---

### Stage 4 — React Component Mastery *(Days 11–20)*

1. Build a tiny standalone React counter in a new `index.html` — just `useState`
2. Add a new optional `subtitle` prop to `PhaseListItem` and render it
3. Study `TreeNodeComponent` — understand why it calls *itself* recursively
4. For each `useEffect` in `App`: what does it watch? What does it do? What does cleanup return?
5. Add `[darkMode, setDarkMode]` to App — a header toggle that adds a class to `<body>`

> **Task:** Create a `SmallInfoModal` that shows the phase name and description when you click the phase title in the content header.

---

### Stage 5 — Data Layer Mastery *(Days 21–28)*

1. Open DevTools → Application → Local Storage → find `learning_tracker_roadmaps_v1` → read the raw JSON
2. Manually edit the phase name in DevTools localStorage, then reload
3. Trace `StorageService.saveRoadmaps()` from the call site to `localStorage.setItem`
4. Add a `StorageService.getLastOpenedPhase()` method — stores and retrieves `activePhaseIndex`
5. Write `validatePhaseJSON(data)` — checks for required fields, throws descriptive errors

> **Task:** Add auto-backup — export progress every 5 minutes using `setInterval` inside a `useEffect`.

---

## 📱 Section 9 — Mobile-Friendly Learning Guide

### Using LearnPath on a Phone

LearnPath is **fully responsive**. On a phone:

- The sidebar stacks above the tree (not beside it)
- Phase items have comfortable tap targets
- Build Phase and Edit Phase modals scroll — all fields are reachable
- Global search works perfectly with the phone keyboard

> 💡 **Pro tip:** Add LearnPath to your Home Screen.
> - **iOS:** Share → Add to Home Screen
> - **Android:** Three-dot menu → Add to Home Screen
>
> It launches like an app — full screen, no browser UI.

---

### Running the App on a Phone

#### Option A — Open the File Directly *(Easiest)*

1. Download `index.html`, `style.css`, `app.js` to your phone
2. **Android:** Use **Kiwi Browser** or **Firefox** — both support local file opening
3. **iOS:** Use the **Files app** → long-press the `.html` file → share → open in Safari

#### Option B — GitHub Pages *(Recommended)*

1. Upload the three files to a GitHub repository
2. Go to **Settings → Pages → Deploy from main branch**
3. Visit the generated URL on any phone — works permanently, no install

#### Option C — Replit *(Fastest to Start)*

1. Go to [replit.com](https://replit.com) on your phone
2. Create a new **HTML/CSS/JS** repl
3. Copy-paste each file's contents
4. Click **Run** — use the preview pane as your app

---

### Mobile Tools by Category

#### 📝 Code Editors (Phone)

| App | Platform | Best For |
|-----|----------|---------|
| [Spck Editor](https://spck.io) | iOS & Android | Files, live preview, syntax highlight |
| [Code Editor by Panic](https://panic.com/code-editor/) | iOS | Premium, beautiful, FTP support |
| [Acode](https://acode.foxdocs.me) | Android | Full-featured, GitHub sync |
| [Replit](https://replit.com) | Both (browser) | Run code, share, collaborate |

#### 🌐 Browser Coding (No Install)

| Tool | URL | Best For |
|------|-----|---------|
| CodePen | [codepen.io](https://codepen.io) | HTML/CSS/JS experiments, live preview |
| JSFiddle | [jsfiddle.net](https://jsfiddle.net) | Quick JS/CSS testing |
| Replit | [replit.com](https://replit.com) | Full projects, Node.js, React |
| JSON Lint | [jsonlint.com](https://jsonlint.com) | Validate your JSON before importing |
| JSON Editor Online | [jsoneditoronline.org](https://jsoneditoronline.org) | Visual JSON tree explorer |

#### 🖥️ Terminal on Phone

| App | Platform | What You Can Do |
|-----|----------|----------------|
| **Termux** | Android | Real Linux terminal — run Node.js, npm, git |
| **iSH** | iOS | Alpine Linux shell — basic commands |
| **a-Shell** | iOS | JavaScript, Python, git, vim |

---

### Phone Learning Tips by Topic

#### 📌 HTML

> 📖 **Read:** [MDN Web Docs](https://developer.mozilla.org) — excellent mobile layout
>
> 🔨 **Practice:** CodePen → New Pen → write HTML in the HTML panel
>
> 📱 **App:** [Sololearn](https://www.sololearn.com) — gamified, phone-first HTML/CSS/JS course
>
> **Task:** Create a 3-card layout for sections, topics, subtopics using only HTML

---

#### 📌 CSS

> 📖 **Read:** [CSS Tricks — Complete Guide to Flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
>
> 🎬 **Watch:** Kevin Powell on YouTube (short, phone-friendly videos)
>
> 🔨 **Practice:** Fork any CSS snippet from the app on CodePen
>
> **Task:** Recreate `.phase-item` styling from memory on CodePen

---

#### 📌 JavaScript

> 📖 **Read:** [javascript.info](https://javascript.info) — best JS guide, great on mobile
>
> 📱 **App:** [Grasshopper](https://grasshopper.app) (Google) — JS fundamentals, phone-first
>
> 🔨 **Practice:** Open any page in Kiwi Browser → DevTools Console → type JS live
>
> **Task:** Write `buildTree()` from scratch on Replit using only the schema as a guide

---

#### 📌 React

> 📖 **Read:** [react.dev](https://react.dev) — official docs, excellent mobile layout
>
> 🎬 **Watch:** "React hooks explained in 15 minutes" on YouTube
>
> 🔨 **Practice:** Create a React repl on Replit → build `PhaseListItem` from memory
>
> **Task:** Build a tiny checkbox app on Replit that mirrors `handleCheckNode`

---

#### 📌 JSON & Data

> 🔨 **Validate:** [jsonlint.com](https://jsonlint.com) — paste JSON, fix errors instantly
>
> 🔍 **Explore:** [jsoneditoronline.org](https://jsoneditoronline.org) — visual tree view
>
> **Task:** Write a new phase JSON for a subject *you're* learning — cooking, finance, anything
>
> **Task:** Import it into LearnPath and start tracking your real learning

---

#### 📌 localStorage & DevTools

> 🔨 **On Android:** Use **Kiwi Browser** → three-dot menu → DevTools
>
> 🔨 **On iOS:** Pair with a Mac → Safari DevTools via USB
>
> **Task:** Open DevTools → Application → Local Storage → find the app's data key → read it
>
> **Task:** In Console: `localStorage.setItem("test", "hello")` → `localStorage.getItem("test")`

---

### 📅 30-Minute Daily Mobile Routine

| Time | Activity |
|------|----------|
| **0–5 min** | Open LearnPath, review your roadmap, plan what to study today |
| **5–15 min** | Read one concept (MDN, react.dev, javascript.info) — read, don't skim |
| **15–25 min** | Write code on Replit or CodePen — recreate something from the app |
| **25–30 min** | Update LearnPath — tick off what you learned, add notes via Edit Phase |

---

## 🔧 Section 10 — Troubleshooting & FAQ

### ❓ My data disappeared after clearing browser cache

**Cause:** `localStorage` is cleared when you clear browser data.

**Fix:** Export regularly (Header → Export) → save the `.json` to Google Drive, iCloud, or Dropbox. Import it back any time.

---

### ❓ The JSON upload fails

**Most common causes:**

1. **Invalid JSON** — use [jsonlint.com](https://jsonlint.com) to validate before uploading
2. **Missing required fields** — every phase needs `"phase"`, `"title"`, and `"sections"` keys
3. **Wrong file type** — must be a `.json` file containing valid JSON text

---

### ❓ Can I use this on multiple devices?

Not automatically — `localStorage` is per-browser, per-device.

**Workaround:**
1. **Device A:** Export → save JSON to cloud storage (Google Drive, etc.)
2. **Device B:** Download the file → Import → choose Merge or Overwrite

---

### ❓ Progress is 0% even though I ticked items

**Cause:** Progress is calculated from **leaf nodes only** — the deepest level.

- If your phase has sections and topics but **no subtopics** → topics are the leaves → ticking topics counts ✓
- If you added subtopics later → topics are no longer leaves → you must tick the subtopics

---

### ❓ Can I reorder phases?

Not in the UI yet. **Workaround:** Export → manually reorder the phases array in the JSON → Import with Overwrite.

> Drag-to-reorder is a great feature to build yourself!

---

### ❓ How do I run this without internet?

1. Download Font Awesome CSS and save it locally
2. Download the Inter font files
3. Download React, ReactDOM, and Babel scripts
4. Update all `<link>` and `<script src="">` tags in `index.html` to point to local files

The app core itself has zero network dependency beyond those CDN resources.

---

## 💡 Section 11 — Extension Ideas

### 🟢 Beginner

- Add a **colour picker** to phases — store in `phase.data.color`, show as a badge
- Add a **due date** field — display with an overdue warning in red
- Add a **notes** text area to `EditPhaseModal` — stored in `phase.data.notes`
- Show a **confetti animation** when a phase hits 100% (use `canvas-confetti` CDN)

### 🟡 Intermediate

- **Drag-to-reorder phases** using the HTML5 Drag and Drop API
- **Dark / light theme toggle** — swap `:root` CSS variables on button click
- **Streak tracker** — store last login date, count consecutive days
- **Keyboard shortcuts** — `Ctrl+K` for search, `Ctrl+E` for export (via `useEffect` + `keydown`)
- **Phase duplication** — a Clone button that deep-copies a phase's data

### 🔴 Advanced

- **Cloud sync** with Firebase Realtime Database — replace `localStorage` calls
- **Shareable URLs** — encode the roadmap JSON as base64 in the URL hash
- **Pomodoro timer** — auto-ticks subtopics after each session
- **Port to Vite + React Router** — multiple pages, proper routing
- **User auth** with Firebase Auth — multiple users, private data

---

## 🎯 Final Words

LearnPath is the perfect learning project because:

- 📦 **Small enough** to read the entire codebase in one afternoon
- 🧠 **Complex enough** to teach recursion, state management, data persistence, and architecture
- ✅ **Solves a real problem** — so you will actually use it while learning from it
- 🔧 **No build tools** — you see how React works at the browser level before adding abstraction

---

> **Your next action:**
> Import the Web Development JSON from Section 7, create a roadmap called "My Dev Journey",
> and tick off the first thing you already know.
>
> **You are already further along than you think. 🚀**

---

*LearnPath Complete Guide · Built with HTML, CSS & React · 100% Open · 100% Yours*
