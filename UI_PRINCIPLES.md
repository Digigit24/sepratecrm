# UI Principles & Component Architecture
> A complete knowledge base for building consistent UI across applications.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [App Layout Structure](#app-layout-structure)
3. [Design Tokens & Theming](#design-tokens--theming)
4. [Typography](#typography)
5. [Sidebar — UniversalSidebar](#sidebar--universalsidebar)
6. [Header — UniversalHeader](#header--universalheader)
7. [SideDrawer — Draggable Width Sheet Panel](#sidedrawer--draggable-width-sheet-panel)
8. [Sheet Component (Base Slide-Over)](#sheet-component-base-slide-over)
9. [Bottom Drawer (Vaul)](#bottom-drawer-vaul)
10. [Hover & Interaction Effects](#hover--interaction-effects)
11. [Shadcn UI Configuration](#shadcn-ui-configuration)
12. [Spacing & Sizing System](#spacing--sizing-system)
13. [Z-Index Hierarchy](#z-index-hierarchy)
14. [Border Radius System](#border-radius-system)
15. [Core Conventions & Rules](#core-conventions--rules)
16. [Provider Hierarchy](#provider-hierarchy)

---

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | react-router-dom v6 |
| UI Library | Shadcn UI (baseColor: `slate`, cssVariables: `true`) |
| Primitives | @radix-ui |
| Styling | Tailwind CSS v3 + tailwindcss-animate |
| Theming | next-themes (storageKey: `celiyo-theme`) |
| Icons | lucide-react |
| State | zustand + @tanstack/react-query + SWR |
| Forms | react-hook-form + zod |
| Bottom Drawer | vaul |
| Side Panels | Radix Dialog via `sheet.tsx` |
| Real-time | Pusher + Laravel Echo |
| Notifications | sonner + shadcn Toaster |
| Class Utility | clsx + tailwind-merge via `cn()` |

---

## App Layout Structure

### Root Hierarchy

```tsx
// main.tsx
<ThemeProvider defaultTheme="light" enableSystem={false} storageKey="celiyo-theme">
  <App />
</ThemeProvider>
```

```tsx
// App.tsx — full provider hierarchy
<SWRConfig>
  <QueryClientProvider>
    <TooltipProvider>
      <Toaster />          {/* shadcn toast */}
      <Sonner />           {/* sonner toast */}
      <WebSocketProvider>
        <BrowserRouter>
          <ProtectedRoute>
            <RealtimeChatProvider>
              <ThemeSync />  {/* reads user.preferences.theme → setTheme(), renders null */}
              <div className="flex h-screen overflow-hidden bg-background">
                <UniversalSidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <UniversalHeader />
                  <main className="flex-1 overflow-auto">
                    <Routes />
                  </main>
                </div>
              </div>
            </RealtimeChatProvider>
          </ProtectedRoute>
        </BrowserRouter>
      </WebSocketProvider>
    </TooltipProvider>
  </QueryClientProvider>
</SWRConfig>
```

### Layout Classes (Critical)

| Element | Classes |
|---|---|
| Root wrapper | `flex h-screen overflow-hidden bg-background` |
| Content column (right of sidebar) | `flex flex-col flex-1 overflow-hidden` |
| Main scrollable area | `flex-1 overflow-auto` |

**Rule:** Never put `overflow-auto` on the root. Only the `<main>` scrolls. Sidebar and header are fixed in height.

---

## Design Tokens & Theming

### Theme Engine

- `next-themes` v0.3.0 with `attribute="class"` — adds/removes `.dark` on `<html>`
- Tailwind `darkMode: ["class"]`
- All colors via HSL CSS variables — **never hardcode hex or rgb in components**
- Exception: status indicators (`bg-emerald-500`, `bg-red-500`, etc.) may use direct Tailwind color classes

### Bootstrap Order

1. `main.tsx` → `<ThemeProvider defaultTheme="light" enableSystem={false} storageKey="celiyo-theme">`
2. next-themes reads `localStorage["celiyo-theme"]`
3. On app load post-auth: `<ThemeSync />` reads `user.preferences.theme` → `setTheme()`
4. User toggles → `setTheme()` + `authService.updateUserPreferences()` (persists to backend)
5. `enableSystem={false}` — OS dark mode is intentionally ignored

### CSS Variables — Light (`:root`)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 220 14% 10%;
  --card: 0 0% 100%;
  --card-foreground: 220 14% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 14% 10%;
  --primary: 220 14% 10%;
  --primary-foreground: 210 40% 98%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 220 14% 10%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --accent: 220 14% 96%;
  --accent-foreground: 220 14% 10%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 220 14% 10%;
  --radius: 0.5rem;
  --sidebar-active-bg: 220 14% 95%;
  --sidebar-active-border: 221 83% 53%;   /* blue accent */
}
```

### CSS Variables — Dark (`.dark`)

```css
.dark {
  --background: 224 15% 6%;
  --foreground: 210 40% 98%;
  --card: 224 15% 8%;
  --card-foreground: 210 40% 98%;
  --popover: 224 15% 8%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 220 14% 10%;
  --secondary: 217 19% 14%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 19% 14%;
  --muted-foreground: 215 20% 55%;
  --accent: 217 19% 14%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 63% 31%;
  --destructive-foreground: 210 40% 98%;
  --border: 217 19% 14%;
  --input: 217 19% 14%;
  --ring: 212 27% 84%;
  --sidebar-active-bg: 217 19% 16%;
  --sidebar-active-border: 213 94% 68%;   /* lighter blue */
}
```

### Tailwind Color Token Mapping (`tailwind.config.ts`)

```ts
colors: {
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  secondary: {
    DEFAULT: "hsl(var(--secondary))",
    foreground: "hsl(var(--secondary-foreground))",
  },
  destructive: {
    DEFAULT: "hsl(var(--destructive))",
    foreground: "hsl(var(--destructive-foreground))",
  },
  muted: {
    DEFAULT: "hsl(var(--muted))",
    foreground: "hsl(var(--muted-foreground))",
  },
  accent: {
    DEFAULT: "hsl(var(--accent))",
    foreground: "hsl(var(--accent-foreground))",
  },
  card: {
    DEFAULT: "hsl(var(--card))",
    foreground: "hsl(var(--card-foreground))",
  },
  popover: {
    DEFAULT: "hsl(var(--popover))",
    foreground: "hsl(var(--popover-foreground))",
  },
}
```

### Sidebar-Specific CSS Utilities (`globals.css`)

```css
@layer utilities {
  .sidebar-active {
    background-color: hsl(var(--sidebar-active-bg));
    border-left: 2px solid hsl(var(--sidebar-active-border));
  }
  .sidebar-active-icon {
    color: hsl(var(--sidebar-active-border));
  }
}
```

---

## Typography

### Body Base

```css
body {
  @apply bg-background text-foreground;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}
```

OpenType contextual alternates for improved legibility. Uses Tailwind's default system font stack.

### Text Scale

| Class | Size | Usage |
|---|---|---|
| `text-[9px]` | 9px | Notification badge count |
| `text-[10px]` | 10px | Sidebar section labels |
| `text-[11px]` | 11px | WebSocket status text, avatar initials |
| `text-xs` | 12px | Header subtitles, descriptions |
| `text-[13px]` | 13px | All sidebar/nav menu items |
| `text-sm` | 14px | Page titles, body text, form labels |
| `text-base` | 16px | Sheet/drawer titles |
| `text-lg` | 18px | Modal/sheet headings |

### Font Weight Scale

| Class | Usage |
|---|---|
| `font-medium` | Menu items, nav text |
| `font-semibold` | Page titles, section headers, drawer titles |
| `tracking-widest` | Sidebar section labels (uppercase) |
| `tracking-tight` | Drawer/panel titles |

---

## Sidebar — UniversalSidebar

### Widths

| State | Class | px |
|---|---|---|
| Desktop expanded | `w-60` | 240px |
| Desktop collapsed | `w-16` | 64px |
| Mobile overlay | `w-64` | 256px |

### Collapse Transition

```css
transition-all duration-300
```

### Height

- Desktop: `h-screen`
- Mobile overlay sidebar: `h-full`

### Logo Area

```
h-14   /* always matches header height */
border-b border-border/40
```

- Shows tenant logo image → falls back to icon inside `bg-foreground rounded-lg`
- Always `h-14` regardless of collapse state for perfect header alignment

### Section Labels

```tsx
{/* Expanded */}
<span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
  SECTION NAME
</span>

{/* Collapsed — replaced by divider */}
<div className="w-5 h-px bg-border" />
```

### Menu Item — Default (Leaf Node)

```
flex items-center gap-3 h-9 px-3 rounded-lg
text-[13px] font-medium text-muted-foreground
hover:text-foreground hover:bg-muted/80
transition-all duration-150
```

### Menu Item — Active State

```
text-foreground sidebar-active -ml-0.5 pl-[10px]
```

Active icon class: `sidebar-active-icon`

> The `sidebar-active` utility adds `border-left: 2px solid` using CSS var. The `-ml-0.5 pl-[10px]` compensates so the visual left edge stays flush.

### Child Menu Item (Under Collapsible)

```tsx
{/* Container */}
<div className="ml-3 pl-3 border-l border-border/60 space-y-0.5">

{/* Item */}
<Link className="flex items-center gap-3 h-8 px-3 rounded-lg text-[13px]
  text-muted-foreground hover:text-foreground hover:bg-muted/80
  transition-all duration-150" />

{/* Active child item */}
className="text-foreground sidebar-active font-medium -ml-[13px] pl-[23px]"
```

> The `-ml-[13px] pl-[23px]` on active child cancels the parent `ml-3` so the active border aligns with the left edge of the sidebar.

### Collapsible Parent (Has Children)

```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger>
    {/* Chevron */}
    <ChevronDown className={cn(
      "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
      !isOpen && "-rotate-90"
    )} />
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* child items */}
  </CollapsibleContent>
</Collapsible>
```

### Mobile Behavior

```tsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
  onClick={() => setMobileOpen(false)} />

{/* Mobile sidebar */}
<div className={cn(
  "fixed top-0 left-0 h-full w-64 bg-background border-r border-border/40 z-50",
  "transition-transform duration-300 shadow-xl",
  mobileOpen ? "translate-x-0" : "-translate-x-full"
)} />

{/* Desktop sidebar — hidden on mobile */}
<aside className="hidden lg:block ..." />
```

### Collapse Button (Bottom of Sidebar)

```
w-full flex items-center gap-3 h-9 px-3 rounded-lg
text-[13px] font-medium text-muted-foreground
hover:text-foreground hover:bg-muted/80
transition-all duration-150
```

Icons: `PanelLeftClose` when expanded, `PanelLeft` when collapsed (from lucide-react).

---

## Header — UniversalHeader

### Container

```
h-14 border-b border-border bg-background px-4 md:px-5
flex items-center justify-between
```

**Rule:** Header height `h-14` must always match the sidebar logo area height `h-14`.

### Left Side

```tsx
{/* Mobile hamburger — lg:hidden */}
<button className="p-1.5 rounded-lg hover:bg-accent lg:hidden">
  <Menu className="h-5 w-5" />
</button>

{/* Page title */}
<span className="text-sm font-semibold text-foreground">{pageTitle}</span>

{/* Greeting — hidden on xs */}
<span className="text-xs text-muted-foreground hidden sm:block">
  {username}, {getTimeBasedGreeting()}
</span>
```

**Greeting logic:**

```ts
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}
```

### Right Side (gap-1.5)

#### 1. WebSocket Status Dot

```tsx
<div className={cn(
  "h-1.5 w-1.5 rounded-full",
  status === 'open'       && "bg-emerald-500",
  status === 'connecting' && "bg-amber-500 animate-pulse",
  status === 'error'      && "bg-red-500",
  status === 'closed'     && "bg-gray-300",
)} />
<span className="text-[11px] text-muted-foreground hidden md:inline">
  {status === 'open' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
</span>
```

#### 2. Notifications Bell

```
relative p-2 rounded-lg hover:bg-accent transition-colors
```

Badge: `absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center`

#### 3. Settings Button

```
p-2 rounded-lg hover:bg-accent transition-colors
```

#### 4. Theme Toggle

```tsx
<button onClick={handleThemeToggle} className="p-2 rounded-lg hover:bg-accent transition-colors relative">
  {/* Sun — visible in light, hidden in dark */}
  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
  {/* Moon — hidden in light, visible in dark */}
  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
</button>
```

**Toggle logic:**

```ts
const handleThemeToggle = () => {
  const newTheme = resolvedTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
  authService.updateUserPreferences({ theme: newTheme }); // persist to backend
};
```

#### 5. Profile Dropdown

```
flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors
```

- Avatar: `w-6 h-6 rounded-full bg-accent flex items-center justify-center`
  - First letter of name: `text-[11px] font-medium text-foreground`
- Username label: `hidden md:inline text-xs text-foreground`
- Uses Shadcn `<DropdownMenu>` with `align="end"` and `w-52`
- Items: Profile / Settings / Logout with `cursor-pointer`

---

## SideDrawer — Draggable Width Sheet Panel

This is the **custom application-level component** (`src/components/SideDrawer.tsx`) built on top of the base `Sheet` component. It adds draggable resizing, localStorage persistence, mode badges, header actions, and a configurable footer.

### Props Interface

```ts
export interface SideDrawerProps {
  // Core state
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Header
  title: string;
  description?: string;
  mode?: 'view' | 'edit' | 'create';
  headerActions?: DrawerHeaderAction[];

  // Loading
  isLoading?: boolean;
  loadingText?: string;

  // Content
  children: React.ReactNode;

  // Footer
  footerButtons?: DrawerActionButton[];
  footerAlignment?: 'left' | 'right' | 'center' | 'between';

  // Size
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';

  // Behavior
  showBackButton?: boolean;   // mobile: shows ChevronLeft instead of X
  preventClose?: boolean;     // blocks ESC, overlay click, and close button

  // Resizing
  resizable?: boolean;        // default: true
  minWidth?: number;          // default: 320
  maxWidth?: number;          // default: 1200
  storageKey?: string;        // localStorage key — auto-derived from title if omitted

  // Callbacks
  onClose?: () => void;

  // Custom classes
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
}
```

### Size Presets (px)

| size | px |
|---|---|
| `sm` | 384 |
| `md` | 448 |
| `lg` | 672 (default) |
| `xl` | 768 |
| `2xl` | 896 |

### Header Action Type

```ts
export type DrawerHeaderAction = {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  disabled?: boolean;
};
```

### Footer Button Type

```ts
export type DrawerActionButton = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
  className?: string;
};
```

### Draggable Width — How It Works

The resize handle is a `1px` wide div pinned to the left edge of the drawer. On `mousedown`, native `mousemove` and `mouseup` events are added to `document` (not the element) so dragging outside the handle still works.

```tsx
{/* Resize Handle — left edge of drawer */}
{resizable && !isMobile && (
  <div
    className={cn(
      "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize",
      "hover:bg-primary/20 active:bg-primary/30 transition-colors z-50",
      isResizing && "bg-primary/30"
    )}
    onMouseDown={handleMouseDown}
  >
    {/* Visual grip indicator */}
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-primary/50 rounded-r" />
  </div>
)}
```

```ts
const handleMouseDown = (e: React.MouseEvent) => {
  if (!resizable) return;
  e.preventDefault();
  setIsResizing(true);

  const startX = e.clientX;
  const startWidth = drawerWidth;

  const handleMouseMove = (e: MouseEvent) => {
    // Reverse delta: drawer is on the right, dragging left increases width
    const delta = startX - e.clientX;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
    setDrawerWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    saveWidth(drawerWidth); // persist to localStorage
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

### Width Applied to SheetContent

```tsx
<SheetContent
  style={{
    maxWidth: isMobile ? '100vw' : `${drawerWidth}px`,
    transition: isResizing ? 'none' : 'max-width 0.2s ease-in-out',
    // 'none' during drag = no lag; smooth ease when programmatically changed
  }}
/>
```

### Width Persistence (localStorage)

- Storage key auto-derived: `sidedrawer-width-${title.toLowerCase().replace(/\s+/g, '-')}`
- Or provide a custom `storageKey` prop
- On init: reads from localStorage, validates against `[minWidth, maxWidth]`, falls back to preset
- On resize end (`mouseup`): saved with `localStorage.setItem`

### Mode Badges

| mode | light classes | dark classes |
|---|---|---|
| `create` | `bg-emerald-50 text-emerald-700 ring-emerald-600/20` | `bg-emerald-500/10 text-emerald-400 ring-emerald-500/20` |
| `edit` | `bg-blue-50 text-blue-700 ring-blue-600/20` | `bg-blue-500/10 text-blue-400 ring-blue-500/20` |
| `view` | `bg-gray-50 text-gray-600 ring-gray-500/20` | `bg-gray-500/10 text-gray-400 ring-gray-500/20` |

Badge class: `inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0 ring-1 ring-inset`

### Loading State

```tsx
<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
  <div className="flex flex-col items-center gap-3 text-muted-foreground">
    <Loader2 className="h-8 w-8 animate-spin" />
    <p className="text-sm font-medium">{loadingText}</p>
  </div>
</div>
```

### Header Layout

```tsx
{/* Header container */}
<div className="flex-shrink-0 border-b border-border/60">
  <div className="px-5 py-4 flex items-center justify-between gap-3">

    {/* Left: mobile back button + title + mode badge */}
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {/* Mobile back */}
      {isMobile && showBackButton && (
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      {/* Title */}
      <SheetTitle className="text-base font-semibold tracking-tight truncate" />
      {/* Mode badge */}
    </div>

    {/* Right: header actions + close button */}
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* Action buttons: h-8 w-8 ghost icon buttons */}
      {/* Divider between actions and close: w-px h-5 bg-border/60 mx-1 */}
      {/* Close: h-8 w-8 ghost icon, desktop only */}
    </div>

  </div>
</div>
```

### Content Area

```tsx
<div className="flex-1 min-h-0 relative">
  <ScrollArea className="h-full">
    <div className="px-5 py-5">
      {children}
    </div>
  </ScrollArea>
</div>
```

### Footer

```tsx
<div className="flex-shrink-0 border-t border-border/60">
  <div className="px-5 py-3">
    <div className={cn(
      "flex flex-col-reverse sm:flex-row flex-wrap gap-2",
      footerAlignmentClasses[footerAlignment]
    )}>
      {/* Buttons: w-full sm:w-auto sm:min-w-[100px] */}
    </div>
  </div>
</div>
```

Footer alignment classes:
```ts
const footerAlignmentClasses = {
  left: 'justify-start',
  right: 'justify-end',
  center: 'justify-center',
  between: 'justify-between',
};
```

### Full Usage Example

```tsx
import { SideDrawer } from '@/components/SideDrawer';
import { Edit, Trash } from 'lucide-react';

<SideDrawer
  open={open}
  onOpenChange={setOpen}
  title="Edit Contact"
  mode="edit"
  size="xl"
  resizable
  storageKey="contact-edit-drawer"
  isLoading={isLoading}
  headerActions={[
    {
      icon: Trash,
      label: "Delete",
      onClick: handleDelete,
      variant: "ghost",
    },
  ]}
  footerButtons={[
    {
      label: "Cancel",
      variant: "outline",
      onClick: () => setOpen(false),
    },
    {
      label: "Save Changes",
      variant: "default",
      loading: isSaving,
      onClick: handleSave,
    },
  ]}
  footerAlignment="right"
>
  <YourFormContent />
</SideDrawer>
```

---

## Sheet Component (Base Slide-Over)

The raw Shadcn Sheet (`src/components/ui/sheet.tsx`) — built on `@radix-ui/react-dialog`. Use `SideDrawer` for complex feature panels; use `Sheet` directly for simple overlays.

### Import

```tsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter, SheetClose
} from "@/components/ui/sheet"
```

### Basic Usage

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetTrigger asChild><Button>Open</Button></SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Panel Title</SheetTitle>
      <SheetDescription>Subtitle text</SheetDescription>
    </SheetHeader>
    {/* Content */}
    <SheetFooter>
      <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Sides & Animation

| side | enter | exit | default width |
|---|---|---|---|
| `right` | `slide-in-from-right` | `slide-out-to-right` | `w-3/4 sm:max-w-sm` |
| `left` | `slide-in-from-left` | `slide-out-to-left` | `w-3/4 border-r sm:max-w-sm` |
| `top` | `slide-in-from-top` | `slide-out-to-top` | `inset-x-0 top-0 border-b` |
| `bottom` | `slide-in-from-bottom` | `slide-out-to-bottom` | `inset-x-0 bottom-0 border-t` |

All sides:
```
data-[state=open]:animate-in   data-[state=open]:duration-500
data-[state=closed]:animate-out data-[state=closed]:duration-300
transition ease-in-out
```

### SheetContent Base Classes

```
fixed z-50 gap-4 bg-background p-6 shadow-lg
```

### Overlay

```
fixed inset-0 z-50 bg-black/80
data-[state=open]:animate-in  data-[state=open]:fade-in-0
data-[state=closed]:animate-out data-[state=closed]:fade-out-0
```

### Auto Close Button

Radix adds an `X` button at `absolute right-4 top-4`:
```tsx
<SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70
  ring-offset-background transition-opacity hover:opacity-100
  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
  <X className="h-4 w-4" />
</SheetPrimitive.Close>
```

> In `SideDrawer`, this default button is hidden via `[&>button]:hidden` and replaced with a custom close button in the header.

### Sub-Component Classes

| Component | Classes |
|---|---|
| `SheetHeader` | `flex flex-col space-y-2 text-center sm:text-left` |
| `SheetTitle` | `text-lg font-semibold text-foreground` |
| `SheetDescription` | `text-sm text-muted-foreground` |
| `SheetFooter` | `flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2` |

---

## Bottom Drawer (Vaul)

For mobile-friendly bottom sheets with drag-to-dismiss. Uses the `vaul` library.

### Import

```tsx
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
  DrawerDescription, DrawerFooter, DrawerClose
} from "@/components/ui/drawer"
```

### Usage

```tsx
<Drawer>  {/* shouldScaleBackground=true by default */}
  <DrawerTrigger asChild><Button>Open</Button></DrawerTrigger>
  <DrawerContent>  {/* drag handle built-in at top */}
    <DrawerHeader>
      <DrawerTitle>Title</DrawerTitle>
      <DrawerDescription>Subtitle</DrawerDescription>
    </DrawerHeader>
    {/* Content */}
    <DrawerFooter>
      <DrawerClose asChild><Button variant="outline">Cancel</Button></DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

### Key Details

- `shouldScaleBackground={true}` — background content scales down when drawer opens
- Drag handle: `mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted`
- Content: `fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background`
- Overlay: `fixed inset-0 z-50 bg-black/80`
- All pointer/touch drag-to-close is handled internally by vaul

### Snap Points (Advanced)

```tsx
<Drawer snapPoints={[0.4, 1]} activeSnapPoint={snap} setActiveSnapPoint={setSnap}>
```

### When to Use What

| Situation | Component |
|---|---|
| Feature panel / detail view (desktop) | `SideDrawer` (right side, resizable) |
| Simple slide-over (desktop) | `Sheet` |
| Mobile action sheet / options | `Drawer` (bottom, vaul) |
| Mobile full screen panel | `SideDrawer` (100vw on mobile) |

---

## Hover & Interaction Effects

**Rule:** Every interactive element must have a transition. Never bare `hover:` without `transition-colors` or `transition-all`.

### Pattern Reference

| Element | Classes |
|---|---|
| Sidebar menu item | `hover:text-foreground hover:bg-muted/80 transition-all duration-150` |
| Header icon buttons | `hover:bg-accent transition-colors` |
| Header profile button | `hover:bg-accent transition-colors` |
| Mobile close button | `hover:bg-accent` |
| Sidebar collapse button | `hover:text-foreground hover:bg-muted/80 transition-all duration-150` |
| Sheet/Drawer header close | `hover:text-foreground` (button already has `transition-colors`) |
| Resize handle | `hover:bg-primary/20 active:bg-primary/30 transition-colors` |

### Color Tokens for Hover

| Token | Appearance | Used on |
|---|---|---|
| `hover:bg-muted/80` | Soft gray at 80% opacity | Sidebar items |
| `hover:bg-accent` | Same gray, full opacity | Header buttons |
| `hover:text-foreground` | Text darkens to full foreground | Text alongside muted |
| `hover:bg-primary/20` | Primary color at 20% opacity | Resize handles |

---

## Shadcn UI Configuration

### `components.json`

```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### `cn()` Utility (`src/lib/utils.ts`)

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Always use `cn()` for class merging.** Never concatenate class strings with template literals or `+`.

```tsx
// ✅ Correct
className={cn("base-class", isActive && "active-class", className)}

// ❌ Wrong
className={"base-class " + (isActive ? "active-class" : "")}
```

---

## Spacing & Sizing System

### Component Heights

| Component | Class | px |
|---|---|---|
| Sidebar + Header logo area | `h-14` | 56px |
| Sidebar parent menu item | `h-9` | 36px |
| Sidebar child menu item | `h-8` | 32px |
| Header icon buttons | `h-8 w-8` (in drawers) or `p-2` | ~32px |
| Header profile avatar | `w-6 h-6` | 24px |
| Notification badge | `h-3.5 w-3.5` | 14px |
| WebSocket dot | `h-1.5 w-1.5` | 6px |
| Section label divider (collapsed) | `h-px` | 1px |
| Resize handle grip indicator | `w-1 h-16` | 4×64px |

### Padding Scale Used

| Usage | Class |
|---|---|
| Sidebar menu item padding | `px-3` |
| Header horizontal padding | `px-4 md:px-5` |
| Drawer header | `px-5 py-4` |
| Drawer content | `px-5 py-5` |
| Drawer footer | `px-5 py-3` |
| Header action buttons | `p-2` |
| Profile button | `px-2 py-1.5` |

---

## Z-Index Hierarchy

| Layer | z-index | Element |
|---|---|---|
| Mobile sidebar backdrop | `z-40` | `fixed inset-0 bg-black/40` |
| Mobile sidebar, sheets, drawers, dropdowns | `z-50` | All overlay UI |
| Resize handle on drawer | `z-50` | Sits on top of drawer content |

---

## Border Radius System

Configured via CSS var: `--radius: 0.5rem`

| Tailwind Token | CSS Value | Used On |
|---|---|---|
| `rounded-lg` | `var(--radius)` = 0.5rem | Menu items, buttons, cards |
| `rounded-md` | `calc(var(--radius) - 2px)` | Inputs, smaller buttons |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Close button (Sheet), small elements |
| `rounded-full` | 9999px | Avatars, badges, status dots |
| `rounded-t-[10px]` | 10px | Vaul bottom drawer top corners |
| `rounded-r` | `var(--radius)` | Resize handle grip |

---

## Core Conventions & Rules

1. **Always use `cn()`** for class merging — never string concatenation.

2. **CSS variables for all colors** — never hardcode hex/rgb in components (exception: Tailwind semantic status colors like `bg-emerald-500`, `bg-red-500`, `bg-amber-500`).

3. **Sidebar height = Header height = `h-14`** — these must always be kept aligned.

4. **Menu item heights**: parent nav = `h-9`, child nav = `h-8`.

5. **All nav/menu text**: `text-[13px]`.

6. **Side panels**: use `SideDrawer` (or `Sheet`) for desktop detail/form views; use `Drawer` (bottom, vaul) for mobile action sheets.

7. **Hover must always have a transition**: `transition-colors` or `transition-all duration-150`. Never bare hover.

8. **Mobile breakpoint = `lg:` (1024px)** for sidebar show/hide. `md:` (768px) for header text visibility.

9. **No OS/system theme**: `enableSystem={false}`. App controls light/dark entirely.

10. **Theme persisted in two places**: `localStorage["celiyo-theme"]` (client) + `user.preferences.theme` (backend). Both stay in sync.

11. **Sheet/SideDrawer default close button is always suppressed** (`[&>button]:hidden`) and replaced with a custom close button in the header, ensuring consistent positioning and styling.

12. **Draggable drawer width**: disable transitions during resize (`transition: none` when `isResizing`), re-enable on release. This prevents visual lag.

13. **ScrollArea wraps all drawer/panel content** — never let internal content handle its own scrolling against the panel's `flex-1`.

14. **`flex-shrink-0` on header and footer** of any panel — prevents content from compressing them.

15. **`min-h-0` on the content flex child** — required in flex column layouts for `overflow` to work correctly.

---

## Provider Hierarchy

When building a new app with this UI system, the provider order matters:

```
ThemeProvider (next-themes)
  └── SWRConfig
        └── QueryClientProvider (@tanstack/react-query)
              └── TooltipProvider (Radix)
                    ├── <Toaster /> (shadcn, position: bottom-right)
                    ├── <Sonner /> (sonner, richColors: true)
                    └── BrowserRouter
                          └── ProtectedRoute
                                └── RealtimeChatProvider
                                      ├── <ThemeSync /> (null-render, syncs backend pref)
                                      └── Layout
                                            ├── <UniversalSidebar />
                                            └── Content
                                                  ├── <UniversalHeader />
                                                  └── <main> (scroll area)
                                                        └── <Routes />
```

---

## File Structure Reference

```
src/
├── main.tsx                          # Entry — ThemeProvider wraps App
├── App.tsx                           # Provider hierarchy + layout + routes
├── globals.css                       # CSS vars (light/dark), sidebar-active utilities
├── components/
│   ├── UniversalSidebar.tsx          # Sidebar — collapsible, mobile overlay, sections
│   ├── UniversalHeader.tsx           # Header — 56px, theme toggle, notifications, profile
│   ├── SideDrawer.tsx                # Draggable resizable sheet panel (custom component)
│   ├── ThemeSync.tsx                 # Syncs user pref → next-themes on mount, renders null
│   └── ui/
│       ├── theme-provider.tsx        # Thin next-themes wrapper
│       ├── sheet.tsx                 # Base slide-over (Radix Dialog)
│       ├── drawer.tsx                # Bottom sheet (vaul)
│       ├── button.tsx                # Shadcn Button
│       ├── scroll-area.tsx           # Shadcn ScrollArea
│       ├── collapsible.tsx           # Shadcn Collapsible (sidebar sections)
│       ├── dropdown-menu.tsx         # Shadcn DropdownMenu (profile, actions)
│       └── ... (50+ shadcn components)
├── context/
│   ├── WebSocketProvider.tsx         # socketStatus, newMessageCount, Pusher
│   └── RealtimeChatProvider.tsx      # Pusher channel subscriptions
└── lib/
    └── utils.ts                      # cn() = clsx + tailwind-merge
```
