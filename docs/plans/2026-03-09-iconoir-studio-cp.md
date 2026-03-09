# Iconoir Icon Migration: Studio + CommonPlace

**Repo:** Travis-Gilbert/travisgilbert.me
**Depends on:** `docs/plans/2026-03-09-iconoir-migration.md` (public site spec, already committed)
**Spec file:** `docs/plans/2026-03-09-iconoir-studio-cp.md`

This spec covers the two remaining icon systems:

1. **Studio** (`/studio`): currently uses `@phosphor-icons/react` at `weight="thin"` in
   `StudioSidebar.tsx`, `StudioMobileDock.tsx`, and `WorkbenchPanel.tsx`.
   Replace with `iconoir-react` components.

2. **CommonPlace** (`/commonplace`): currently uses a hand-rolled `SidebarIcon` component
   inside `CommonPlaceSidebar.tsx` with a 16x16 viewBox and custom path data.
   Replace with a refactored `SidebarIcon` backed by Iconoir path data.

There is no `DrawOnIcon` equivalent in either app. These are static nav and UI icons only.

---

## Ground Truth Audit

### Studio icon consumers

| File | Icons used | Current weight/size |
|---|---|---|
| `src/components/studio/StudioSidebar.tsx` | `Books`, `Briefcase`, `ClockCounterClockwise`, `FileText`, `Gear`, `Moon`, `NotePencil`, `Notebook`, `Sun`, `Toolbox`, `Tray`, `VideoCamera` | `weight="thin"`, `size=16` |
| `src/components/studio/StudioMobileDock.tsx` | `ClockCounterClockwise`, `FileText`, `House`, `NotePencil`, `Briefcase`, `Toolbox` | `weight="regular"`, `size=16` |
| `src/components/studio/WorkbenchPanel.tsx` | `MagnifyingGlass`, `ListBullets`, `Tray`, `ClockCounterClockwise`, `SquaresFour`, `LinkSimple` | `size=14`, Phosphor tab icons |

### CommonPlace icon consumer

| File | Implementation |
|---|---|
| `src/components/commonplace/CommonPlaceSidebar.tsx` | `SidebarIcon` component, local function at bottom of file. 16x16 viewBox, hand-rolled `d` paths, single-path per icon. Covers 24 named icons. |

### Other CommonPlace files checked

`KnowledgeMap.tsx`, `SplitPaneContainer.tsx`, `LayoutPresetSelector.tsx` appeared in icon
searches but do not import any icon library. CommonPlace has no Phosphor dependency.
The only icon system in CommonPlace is the `SidebarIcon` function in `CommonPlaceSidebar.tsx`.

---

## Iconoir component name mapping

All `iconoir-react` component names are PascalCase derived from the SVG filename.
Examples: `search.svg` -> `Search`, `nav-arrow-left.svg` -> `NavArrowLeft`.

### Studio: Phosphor -> Iconoir

| Phosphor component | Iconoir component | Iconoir SVG source |
|---|---|---|
| `Books` | `BookStack` | `book-stack.svg` |
| `Briefcase` (sidebar) | `Kanban` | `kanban-board.svg` |
| `ClockCounterClockwise` | `ClockRotateRight` | `clock-rotate-right.svg` |
| `FileText` | `PageEdit` | `page-edit.svg` |
| `Gear` | `Settings` | `settings.svg` |
| `Moon` | `HalfMoon` | `half-moon.svg` |
| `NotePencil` | `Notes` | `notes.svg` |
| `Notebook` | `JournalPage` | `journal-page.svg` |
| `Sun` | `SunLight` | `sun-light.svg` |
| `Toolbox` | `Tools` | `tools.svg` |
| `Tray` | `Archive` | `archive.svg` |
| `VideoCamera` | `VideoCamera` | `video-camera.svg` |
| `House` | `Home` | `home.svg` |
| `MagnifyingGlass` | `Search` | `search.svg` |
| `ListBullets` | `List` | `list.svg` |
| `SquaresFour` | `CollageFrame` | `collage-frame.svg` |
| `LinkSimple` | `Link` | `link.svg` |

### CommonPlace: SidebarIcon name -> Iconoir component

| `SidebarIcon name=` | Iconoir component | Iconoir SVG source | Notes |
|---|---|---|---|
| `capture` | `Plus` | `plus.svg` | Capture / add actions |
| `molecule` | `Atom` | `atom.svg` | Object palette entry |
| `note-pencil` | `EditPencil` | `edit-pencil.svg` | Compose action |
| `timeline` | `ClockRotateRight` | `clock-rotate-right.svg` | Timeline view |
| `filter` | `FilterList` | `filter-list.svg` | Filter view |
| `graph` | `Network` | `network.svg` | Connection graph |
| `frame` | `CollageFrame` | `collage-frame.svg` | Layout frames |
| `calendar` | `Calendar` | `calendar.svg` | Calendar view |
| `scatter` | `Binocular` | `binocular.svg` | Loose ends / scatter view |
| `book` | `BookStack` | `book-stack.svg` | Notebooks parent |
| `briefcase` | `Kanban` | `kanban-board.svg` | Projects parent |
| `engine` | `Settings` | `settings.svg` | System section |
| `bell` | `Bell` | `bell.svg` | Notifications |
| `sparkle` | `MagicWand` | `magic-wand.svg` | Resurface / magic view |
| `gear` | `Settings` | `settings.svg` | Settings item |
| `book-open` | `OpenBook` | `open-book.svg` | Open reading |
| `person` | `ProfileCircle` | `profile-circle.svg` | Person entity type |
| `map-pin` | `MapPin` | `map-pin.svg` | Place entity type |
| `building` | `Building` | `building.svg` | Organization type |
| `lightbulb` | `LightBulbOn` | `light-bulb-on.svg` | Idea entity type |
| `quote` | `MessageText` | `message-text.svg` | Quote entity type |
| `code` | `Code` | `code.svg` | Code entity type |
| `check-circle` | `CheckCircle` | `check-circle.svg` | Done / resolved state |
| `arrow-left` | `NavArrowLeft` | `nav-arrow-left.svg` | Back to main site |
| `plus` | `Plus` | `plus.svg` | Add action |

---

## Batch S0 -- Install `iconoir-react`

**Gate:** `npm run build` passes

```bash
npm install iconoir-react
```

Verify `"iconoir-react": "^7.x.x"` was added to `package.json`.

`iconoir-react` components accept these props:
- `width` / `height` (pixels, default 24)
- `strokeWidth` (default 1.5)
- `color` (default `"currentColor"`)

There is no `weight` prop (unlike Phosphor). Iconoir's single style is equivalent to
Phosphor's `"thin"` to `"regular"` range at small sizes.

---

## Batch S1 -- Migrate `StudioSidebar.tsx`

**File:** `src/components/studio/StudioSidebar.tsx`
**Depends on:** Batch S0
**Gate:** `npm run build` passes; sidebar renders with all icons visible

### Import change

Remove:
```tsx
import {
  Books,
  Briefcase,
  ClockCounterClockwise,
  FileText,
  Gear,
  Moon,
  NotePencil,
  Notebook,
  Sun,
  Toolbox,
  Tray,
  VideoCamera,
} from '@phosphor-icons/react';
```

Add:
```tsx
import {
  BookStack,
  Kanban,
  ClockRotateRight,
  PageEdit,
  Settings,
  HalfMoon,
  Notes,
  JournalPage,
  SunLight,
  Tools,
  Archive,
  VideoCamera,
} from 'iconoir-react';
```

### `iconByName` map change

Replace:
```tsx
const iconByName = {
  'file-text': FileText,
  'note-pencil': NotePencil,
  video: VideoCamera,
  'book-open': Books,
  notebook: Notebook,
  wrench: Toolbox,
  briefcase: Briefcase,
  gear: Gear,
  tray: Tray,
  timeline: ClockCounterClockwise,
} as const;
```

With:
```tsx
const iconByName = {
  'file-text': PageEdit,
  'note-pencil': Notes,
  video: VideoCamera,
  'book-open': BookStack,
  notebook: JournalPage,
  wrench: Tools,
  briefcase: Kanban,
  gear: Settings,
  tray: Archive,
  timeline: ClockRotateRight,
} as const;
```

### Timeline and theme toggle icons

Replace:
```tsx
<ClockCounterClockwise size={16} weight="thin" aria-hidden="true" />
```
With:
```tsx
<ClockRotateRight width={16} height={16} aria-hidden="true" />
```

Replace:
```tsx
{themeMode === 'dark' ? (
  <Sun size={16} weight="thin" aria-hidden="true" />
) : (
  <Moon size={16} weight="thin" aria-hidden="true" />
)}
```
With:
```tsx
{themeMode === 'dark' ? (
  <SunLight width={16} height={16} aria-hidden="true" />
) : (
  <HalfMoon width={16} height={16} aria-hidden="true" />
)}
```

### Nav item icon render

Find:
```tsx
<Icon size={16} weight="thin" aria-hidden="true" />
```
Replace with:
```tsx
<Icon width={16} height={16} aria-hidden="true" />
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] All 10 nav sections render icons (Essays, Field Notes, Videos, Shelf, Notebooks, Toolkit, Projects, Settings, Stash, Timeline)
- [ ] Theme toggle (Sun/Moon) renders correctly
- [ ] Active route highlights correctly (icon inherits `currentColor`)
- [ ] No TypeScript errors on `iconByName` map type

---

## Batch S2 -- Migrate `StudioMobileDock.tsx`

**File:** `src/components/studio/StudioMobileDock.tsx`
**Depends on:** Batch S1
**Gate:** `npm run build` passes; mobile dock renders at viewport < lg breakpoint

### Import change

Remove:
```tsx
import {
  ClockCounterClockwise,
  FileText,
  House,
  NotePencil,
  Briefcase,
  Toolbox,
} from '@phosphor-icons/react';
```

Add:
```tsx
import {
  ClockRotateRight,
  PageEdit,
  Home,
  Notes,
  Kanban,
  Tools,
} from 'iconoir-react';
```

### `MOBILE_DOCK_ITEMS` update

```tsx
const MOBILE_DOCK_ITEMS = [
  { key: 'home',     href: '/studio',             label: 'Home',      icon: Home },
  { key: 'essays',   href: '/studio/essays',       label: 'Essays',    icon: PageEdit },
  { key: 'notes',    href: '/studio/field-notes',  label: 'Notes',     icon: Notes },
  { key: 'projects', href: '/studio/projects',     label: 'Projects',  icon: Kanban },
  { key: 'timeline', href: '/studio/timeline',     label: 'Timeline',  icon: ClockRotateRight },
  { key: 'workbench', href: '',                    label: 'Workbench', icon: Tools },
] as const;
```

### Icon render in `.map()`

Replace:
```tsx
icon: <Icon size={16} weight="regular" aria-hidden="true" />,
```
With:
```tsx
icon: <Icon width={16} height={16} aria-hidden="true" />,
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] Mobile dock renders at viewport < 1024px with all 6 tab icons
- [ ] Workbench tab triggers `onOpenWorkbench` callback (unchanged)
- [ ] Active tab highlights via `data-active` styling (unchanged)

---

## Batch S3 -- Migrate `WorkbenchPanel.tsx` tabs

**File:** `src/components/studio/WorkbenchPanel.tsx`
**Depends on:** Batch S2
**Gate:** `npm run build` passes; workbench panel tab row renders

### Import change

Find the existing Phosphor import block in `WorkbenchPanel.tsx`:
```tsx
import {
  MagnifyingGlass,
  ListBullets,
  Tray,
  ClockCounterClockwise,
  SquaresFour,
  LinkSimple,
  type Icon as PhosphorIconType,
} from '@phosphor-icons/react';
```

Replace with:
```tsx
import {
  Search,
  List,
  Archive,
  ClockRotateRight,
  CollageFrame,
  Link,
} from 'iconoir-react';
import type { SVGProps, FC } from 'react';

type IconoirIconType = FC<SVGProps<SVGSVGElement> & {
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
}>;
```

### `TAB_CONFIG` update

Replace:
```tsx
const TAB_CONFIG: Record<EditorPanelMode, { Icon: PhosphorIconType; label: string }> = {
  research: { Icon: MagnifyingGlass,       label: 'Research' },
  outline:  { Icon: ListBullets,           label: 'Outline'  },
  stash:    { Icon: Tray,                  label: 'Stash'    },
  history:  { Icon: ClockCounterClockwise, label: 'History'  },
  collage:  { Icon: SquaresFour,           label: 'Collage'  },
  links:    { Icon: LinkSimple,            label: 'Links'    },
};
```

With:
```tsx
const TAB_CONFIG: Record<EditorPanelMode, { Icon: IconoirIconType; label: string }> = {
  research: { Icon: Search,           label: 'Research' },
  outline:  { Icon: List,             label: 'Outline'  },
  stash:    { Icon: Archive,          label: 'Stash'    },
  history:  { Icon: ClockRotateRight, label: 'History'  },
  collage:  { Icon: CollageFrame,     label: 'Collage'  },
  links:    { Icon: Link,             label: 'Links'    },
};
```

### Tab render update

Find where the tab Icon renders:
```tsx
<Icon size={14} weight={isActive ? 'bold' : 'regular'} />
```

Iconoir has no `weight` prop. Use `strokeWidth` to signal the active state:
```tsx
<Icon width={14} height={14} strokeWidth={isActive ? 2 : 1.5} />
```

### Verification checklist

- [ ] `npm run build` passes
- [ ] All 6 workbench tabs render (Research, Outline, Stash, History, Collage, Links)
- [ ] Active tab icon appears slightly heavier (`strokeWidth=2`)
- [ ] No TypeScript errors on `TAB_CONFIG` type

---

## Batch S4 -- Remove `@phosphor-icons/react` if no longer needed

**Depends on:** Batch S3
**Gate:** zero grep hits; clean build

After Batches S1-S3, confirm no remaining Phosphor imports anywhere in Studio:

```bash
grep -r "@phosphor-icons/react" src/components/studio/
grep -r "@phosphor-icons/react" src/app/\(studio\)/
```

Also check `src/components/TopNav.tsx` -- it imports `MagnifyingGlass` for the site search button.
If that has not yet been migrated as part of the public site spec, add it here:

```tsx
// Remove
import { MagnifyingGlass } from '@phosphor-icons/react';

// Add
import { Search } from 'iconoir-react';
```

Replace:
```tsx
<MagnifyingGlass size={16} weight="regular" />
```
With:
```tsx
<Search width={16} height={16} />
```

Once all usages are gone, remove the package:
```bash
npm uninstall @phosphor-icons/react
```

### Verification checklist

- [ ] `grep -r "@phosphor-icons/react" src/` returns zero results
- [ ] `npm run build` passes
- [ ] `package.json` no longer lists `@phosphor-icons/react`

---

## Batch CP0 -- Refactor `CommonPlaceSidebar.tsx` `SidebarIcon`

**File:** `src/components/commonplace/CommonPlaceSidebar.tsx`
**Depends on:** Batch S0 (`iconoir-react` already installed)
**Gate:** `npm run build` passes; CommonPlace sidebar renders all icons

### Strategy

CommonPlace's `SidebarIcon` is a self-contained local function at the bottom of
`CommonPlaceSidebar.tsx`. It uses a 16x16 viewBox with hand-drawn path data.

Rather than adding 25 individual named imports at the top of an already large file,
the cleanest approach is the same path-data extraction technique used on the public site:
extract Iconoir `d` path strings into a local lookup map, keep the `SidebarIcon` API
unchanged, and update the viewBox from 16x16 to 24x24.

This means `<SidebarIcon name="graph" />` call sites need zero changes.

### `SidebarIcon` replacement

Replace the entire `SidebarIcon` function and its comment block with the following.
Note: `ChevronIcon` is NOT replaced -- leave it as-is.

```tsx
/* -------------------------------------------------
   Sidebar icons: Iconoir path data, 24x24 viewBox.
   Paths sourced from iconoir-icons/iconoir @ icons/regular/*.svg
   viewBox 0 0 24 24 | strokeWidth 1.5
   ------------------------------------------------- */

const CP_ICON_PATHS: Record<string, string[]> = {
  // plus.svg
  'capture': [
    'M6 12H12M18 12H12M12 12V6M12 12V18',
  ],

  // atom.svg
  'molecule': [
    'M4.40434 13.6099C3.51517 13.1448 3 12.5924 3 12C3 10.3431 7.02944 9 12 9C16.9706 9 21 10.3431 21 12C21 12.7144 20.2508 13.3705 19 13.8858',
    'M12 11.01L12.01 10.9989',
    'M16.8827 6C16.878 4.97702 16.6199 4.25309 16.0856 3.98084C14.6093 3.22864 11.5832 6.20912 9.32664 10.6379C7.07005 15.0667 6.43747 19.2668 7.91374 20.019C8.44117 20.2877 9.16642 20.08 9.98372 19.5',
    'M9.60092 4.25164C8.94056 3.86579 8.35719 3.75489 7.91369 3.98086C6.43742 4.73306 7.06999 8.93309 9.32658 13.3619C11.5832 17.7907 14.6092 20.7712 16.0855 20.019C17.3977 19.3504 17.0438 15.9577 15.3641 12.1016',
  ],

  // edit-pencil.svg
  'note-pencil': [
    'M14.363 5.652L3.794 16.22C3.59 16.425 3.472 16.697 3.465 16.984L3.4 19.6L6.04 19.535C6.327 19.528 6.598 19.41 6.802 19.206L17.37 8.637M14.363 5.652L16.773 3.242C17.164 2.851 17.797 2.851 18.187 3.242L20.758 5.813C21.149 6.203 21.149 6.836 20.758 7.227L18.348 9.637L14.363 5.652',
  ],

  // clock-rotate-right.svg
  'timeline': [
    'M12 6L12 12L18 12',
    'M21.8883 10.5C21.1645 5.68874 17.013 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C16.1006 22 19.6248 19.5318 21.1679 16',
    'M17 16H21.4C21.7314 16 22 16.2686 22 16.6V21',
  ],

  // filter-list.svg
  'filter': [
    'M3 6H21',
    'M7 12L17 12',
    'M11 18L13 18',
  ],

  // network.svg
  'graph': [
    'M6.5 7V10.5C6.5 11.6046 7.39543 12.5 8.5 12.5H15.5C16.6046 12.5 17.5 11.6046 17.5 10.5V7',
    'M12 12.5V17',
  ],

  // collage-frame.svg
  'frame': [
    'M19.4 20H4.6C4.26863 20 4 19.7314 4 19.4V4.6C4 4.26863 4.26863 4 4.6 4H19.4C19.7314 4 20 4.26863 20 4.6V19.4C20 19.7314 19.7314 20 19.4 20Z',
    'M11 12V4',
    'M4 12H20',
  ],

  // calendar.svg
  'calendar': [
    'M15 4V2M15 4V6M15 4H10.5M3 10V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V10H3Z',
    'M3 10V6C3 4.89543 3.89543 4 5 4H7',
    'M7 2V6',
    'M21 10V6C21 4.89543 20.1046 4 19 4H18.5',
  ],

  // binocular.svg
  'scatter': [
    'M21.5 14L20 9C20 9 19.5 7 17.5 7C17.5 7 17.5 5 15.5 5C13.5 5 13.5 7 13.5 7H10.5C10.5 7 10.5 5 8.5 5C6.5 5 6.5 7 6.5 7C4.5 7 4 9 4 9L2.5 14',
    'M6 20C8.20914 20 10 18.2091 10 16C10 13.7909 8.20914 12 6 12C3.79086 12 2 13.7909 2 16C2 18.2091 3.79086 20 6 20Z',
    'M18 20C20.2091 20 22 18.2091 22 16C22 13.7909 20.2091 12 18 12C15.7909 12 14 13.7909 14 16C14 18.2091 15.7909 20 18 20Z',
    'M12 16C13.1046 16 14 15.1046 14 14C14 12.8954 13.1046 12 12 12C10.8954 12 10 12.8954 10 14C10 15.1046 10.8954 16 12 16Z',
  ],

  // book-stack.svg
  'book': [
    'M5 19.5V5C5 3.89543 5.89543 3 7 3H18.4C18.7314 3 19 3.26863 19 3.6V21',
    'M9 7L15 7',
    'M6.5 15L19 15',
    'M6.5 18L19 18',
    'M6.5 21L19 21',
    'M6.5 18C5.5 18 5 17.3284 5 16.5C5 15.6716 5.5 15 6.5 15',
    'M6.5 21C5.5 21 5 20.3284 5 19.5C5 18.6716 5.5 18 6.5 18',
  ],

  // kanban-board.svg
  'briefcase': [
    'M3 3.6V20.4C3 20.7314 3.26863 21 3.6 21H20.4C20.7314 21 21 20.7314 21 20.4V3.6C21 3.26863 20.7314 3 20.4 3H3.6C3.26863 3 3 3.26863 3 3.6Z',
    'M6 6L6 16',
    'M10 6V9',
    'M14 6V13',
    'M18 6V11',
  ],

  // settings.svg
  'engine': [
    'M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z',
    'M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z',
  ],

  // bell.svg
  'bell': [
    'M18 8.4C18 6.70261 17.3679 5.07475 16.2426 3.87452C15.1174 2.67428 13.5913 2 12 2C10.4087 2 8.88258 2.67428 7.75736 3.87452C6.63214 5.07475 6 6.70261 6 8.4C6 15.8667 3 18 3 18H21C21 18 18 15.8667 18 8.4Z',
    'M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21',
  ],

  // magic-wand.svg
  'sparkle': [
    'M3 21L12 12',
    'M9.5 6.5L10 2L10.5 6.5L15 7L10.5 7.5L10 12L9.5 7.5L5 7L9.5 6.5Z',
    'M16.5 15.5L17 13L17.5 15.5L20 16L17.5 16.5L17 19L16.5 16.5L14 16L16.5 15.5Z',
  ],

  // settings.svg (same as engine)
  'gear': [
    'M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z',
    'M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z',
  ],

  // open-book.svg
  'book-open': [
    'M12 21V7C12 5.89543 12.8954 5 14 5H21.4C21.7314 5 22 5.26863 22 5.6V18.7143',
    'M12 21V7C12 5.89543 11.1046 5 10 5H2.6C2.26863 5 2 5.26863 2 5.6V18.7143',
    'M14 19L22 19',
    'M10 19L2 19',
    'M12 21C12 19.8954 12.8954 19 14 19',
    'M12 21C12 19.8954 11.1046 19 10 19',
  ],

  // profile-circle.svg
  'person': [
    'M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z',
    'M4.271 18.3457C4.271 18.3457 6.50002 15.5 12 15.5C17.5 15.5 19.7291 18.3457 19.7291 18.3457',
    'M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12Z',
  ],

  // map-pin.svg
  'map-pin': [
    'M20 10C20 14.4183 12 22 12 22C12 22 4 14.4183 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10Z',
    'M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z',
  ],

  // building.svg
  'building': [
    'M1 22H23',
    'M5 22V5C5 4.44772 5.44772 4 6 4H18C18.5523 4 19 4.44772 19 5V22',
    'M9 22V17H15V22',
    'M9 8H10',
    'M14 8H15',
    'M9 12H10',
    'M14 12H15',
  ],

  // light-bulb-on.svg
  'lightbulb': [
    'M21 2L20 3',
    'M3 2L4 3',
    'M21 16L20 15',
    'M3 16L4 15',
    'M9 18H15',
    'M10 21H14',
    'M11.9998 3C7.9997 3 5.95186 4.95029 5.99985 8C6.02324 9.48689 6.4997 10.5 7.49985 11.5C8.5 12.5 9 13 8.99985 15H14.9998C15 13.0001 15.5 12.5 16.4997 11.5001L16.4998 11.5C17.4997 10.5 17.9765 9.48689 17.9998 8C18.0478 4.95029 16 3 11.9998 3Z',
  ],

  // message-text.svg
  'quote': [
    'M7 12L17 12',
    'M7 8L13 8',
    'M3 20.2895V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15C21 16.1046 20.1046 17 19 17H7.96125C7.35368 17 6.77906 17.2762 6.39951 17.7506L4.06852 20.6643C3.71421 21.1072 3 20.8567 3 20.2895Z',
  ],

  // code.svg
  'code': [
    'M7 8L3 12L7 16',
    'M17 8L21 12L17 16',
    'M14 4L10 20',
  ],

  // check-circle.svg
  'check-circle': [
    'M7 12.5L10 15.5L17 8.5',
    'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
  ],

  // nav-arrow-left.svg
  'arrow-left': [
    'M15 6L9 12L15 18',
  ],

  // plus.svg
  'plus': [
    'M6 12H12M18 12H12M12 12V6M12 12V18',
  ],
};

function SidebarIcon({ name }: { name: string }) {
  const paths = CP_ICON_PATHS[name] ?? CP_ICON_PATHS['note-pencil'];

  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.7 }}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
```

### What changes

- `viewBox` changes from `"0 0 16 16"` to `"0 0 24 24"` (Iconoir native)
- `strokeWidth` changes from `1.4` to `1.5` (Iconoir native)
- Single `<path d={d}>` becomes a mapped array of paths
- Fallback remains `'note-pencil'` (same logic, new data)
- `ChevronIcon` is NOT touched

### Verification checklist

- [ ] `npm run build` passes
- [ ] CommonPlace sidebar renders all nav section icons
- [ ] Expandable groups (Notebooks, Projects) still show `ChevronIcon`
- [ ] Object palette button renders `molecule` (atom) icon
- [ ] Compose button renders `note-pencil` (edit-pencil) icon
- [ ] Back-to-site link renders `arrow-left` icon
- [ ] No TypeScript errors

---

## Batch CP1 -- Verify all `SidebarIcon name=` values are mapped

**File:** `src/components/commonplace/CommonPlaceSidebar.tsx`
**Depends on:** Batch CP0

Run:
```bash
grep -o 'name="[^"]*"' src/components/commonplace/CommonPlaceSidebar.tsx | sort | uniq
```

Cross-reference every result against the keys of `CP_ICON_PATHS`. Any name not present
will fall back silently to `note-pencil`. If the `SIDEBAR_SECTIONS` definition in
`src/lib/commonplace.ts` uses icon names beyond this list, add them to `CP_ICON_PATHS`
with appropriate Iconoir path data.

Expected names from the audit: `capture`, `molecule`, `note-pencil`, `timeline`, `filter`,
`graph`, `frame`, `calendar`, `scatter`, `book`, `briefcase`, `engine`, `bell`, `sparkle`,
`gear`, `book-open`, `person`, `map-pin`, `building`, `lightbulb`, `quote`, `code`,
`check-circle`, `arrow-left`, `plus`.

### Verification checklist

- [ ] All `name=` values from the grep are present in `CP_ICON_PATHS`
- [ ] No fallback icon visible in sidebar (would appear as a pencil where another icon is expected)
- [ ] `npm run build` passes

---

## Commit sequence

```
Batch S0:  deps: install iconoir-react
Batch S1:  feat(studio): migrate StudioSidebar icons to iconoir-react
Batch S2:  feat(studio): migrate StudioMobileDock icons to iconoir-react
Batch S3:  feat(studio): migrate WorkbenchPanel tab icons to iconoir-react
Batch S4:  chore(studio): remove @phosphor-icons/react
Batch CP0: feat(commonplace): migrate SidebarIcon to Iconoir path data (24x24)
Batch CP1: chore(commonplace): verify all SidebarIcon name values are mapped
```

---

## Notes

### Why different strategies for Studio vs CommonPlace

Studio uses `iconoir-react` React components (named imports, render directly) because
it already has a React icon library pattern and the ergonomics are identical to Phosphor.

CommonPlace uses the path-data extraction strategy (same as the public site SketchIcon)
because `SidebarIcon` is a local utility function -- not a named-import pattern. Switching
to 25 individual named imports at the top of a 22KB file would be noisy. The local map
keeps all the data colocated and the call sites clean.

### ChevronIcon is not migrated

The `ChevronIcon` in `CommonPlaceSidebar.tsx` is a hand-rolled 12x12 SVG that handles
expand/collapse rotation via inline `style`. It is a UI control, not a semantic icon,
and has no Iconoir equivalent. Leave it as-is.

### strokeWidth at rendered size 16

Both systems render at 16px physical size with a 24x24 viewBox. Iconoir's `strokeWidth=1.5`
at 24x24 scales to approximately 1.0 effective pixels at 16px. This is marginally thinner
than the previous hand-drawn paths (1.4 in a 16x16 box, effective 1.4px). On retina screens
the difference is invisible. If strokes look too thin on 1x displays, set `strokeWidth={1.75}`
or `strokeWidth={2}` in the SVG wrapper of `SidebarIcon`.
