# UI

Styling, components, and accessibility. Layer and file rules are in
[architecture.md](architecture.md); file placement is in [recipes.md](recipes.md#hook-or-component).

## Stack

| Need                                                    | Use                                                       |
| ------------------------------------------------------- | --------------------------------------------------------- |
| Styling                                                 | Tailwind CSS v4 (`@tailwindcss/vite`), themed in CSS      |
| Interactive primitives (menu, dialog, listbox, tabs, …) | Headless UI (`@headlessui/react`), styled with Tailwind   |
| Component variants (`size`, `intent`, …)                | `class-variance-authority` (`cva`)                        |
| Merging class names                                     | `cn()` in `src/lib/cn.ts` (`clsx` + `tailwind-merge`)     |
| Forms                                                   | TanStack Form (see [conventions.md](conventions.md))      |
| Tables and long lists                                   | TanStack Table, TanStack Virtual                          |
| Icons                                                   | One icon set, imported per icon (tree-shaken); no sprites |

Tailwind and Headless UI are not installed yet. The first change that needs them adds them, wires
the Vite plugin, and moves the design tokens below into `src/styles.css`. Existing BEM classes in
`src/styles.css` (`.version-banner…`) are legacy: convert a component to Tailwind when you next
change it, and delete its CSS in the same change.

## Design language lives in tokens

The design language is defined once, as Tailwind theme variables in `src/styles.css`. Components
use the semantic utilities those tokens generate, never raw palette values or arbitrary hex.

```css
@import "tailwindcss";

@theme {
  /* Semantic colors: components use these, never `bg-gray-900` or `bg-[#111827]`. */
  --color-surface: oklch(0.99 0 0);
  --color-surface-raised: oklch(1 0 0);
  --color-fg: oklch(0.21 0.02 265);
  --color-fg-muted: oklch(0.55 0.02 265);
  --color-accent: oklch(0.55 0.2 265);
  --color-accent-fg: oklch(0.99 0 0);
  --color-danger: oklch(0.58 0.22 27);
  --color-border: oklch(0.92 0.01 265);

  --font-sans: "Inter Variable", system-ui, sans-serif;
  --radius-card: 0.625rem;
}

/* Dark mode swaps token values; components don't change. */
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: oklch(0.17 0.02 265);
    --color-surface-raised: oklch(0.21 0.02 265);
    --color-fg: oklch(0.97 0 0);
    --color-fg-muted: oklch(0.7 0.02 265);
    --color-border: oklch(0.3 0.02 265);
  }
}
```

Rules:

- A new color, radius, shadow, or font is a new token, not an arbitrary value (`bg-[#…]`,
  `rounded-[7px]`). Arbitrary values are for one-off layout math only.
- Name tokens by role (`accent`, `danger`, `surface-raised`), not by hue (`blue`, `gray-900`).
  Changing the brand should be a token edit, not a find-and-replace.
- No inline `style={{…}}` for anything a utility covers. No new global CSS classes.

## Components

- **Primitives** (`Button`, `Input`, `Dialog`, `Menu`, …) wrap Headless UI or native elements,
  own their Tailwind classes, and expose variants through `cva`. Feature components compose
  primitives; they don't restyle them from outside beyond layout (`className` for margin, width,
  grid placement).
- Accept `className` and merge it last with `cn()` so callers can adjust layout.
- Props describe intent (`intent="danger"`), not appearance (`red`).

```tsx
import { Button as HeadlessButton, type ButtonProps } from "@headlessui/react";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "#/lib/cn";

const button = cva(
  "inline-flex items-center gap-2 rounded-card font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:opacity-50",
  {
    variants: {
      intent: {
        primary: "bg-accent text-accent-fg data-hover:bg-accent/90",
        secondary: "border border-border bg-surface-raised text-fg data-hover:bg-surface",
        danger: "bg-danger text-accent-fg data-hover:bg-danger/90",
      },
      size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm" },
    },
    defaultVariants: { intent: "primary", size: "md" },
  },
);

export function Button({
  intent,
  size,
  className,
  ...props
}: ButtonProps & VariantProps<typeof button> & { className?: string }) {
  return <HeadlessButton className={cn(button({ intent, size }), className)} {...props} />;
}
```

```ts
// src/lib/cn.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Style Headless UI state through its `data-*` attributes (`data-open:`, `data-focus:`,
`data-selected:`, `data-disabled:`), not through render props, so styles stay in `className`.

## Accessibility baseline

Headless UI covers keyboard and ARIA for its widgets. Everything else is on us:

- Use the semantic element first: `<button>` for actions, `<a>`/`<Link>` for navigation, `<form>`
  with `<label>`s, headings in order. No clickable `<div>`s.
- Every interactive element has a visible focus style (`focus-visible:`) and an accessible name.
  Icon-only buttons get `aria-label`; decorative SVGs get `aria-hidden="true"`.
- Async status (saving, errors, banners) is announced with `role="status"` / `aria-live`.
- Text meets WCAG AA contrast against its token background, in light and dark.
- Motion respects `motion-safe:` / `motion-reduce:`.
- Layouts work at 320px wide and at 200% zoom without horizontal scroll.
