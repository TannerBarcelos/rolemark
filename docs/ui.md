# UI

Styling, components, and accessibility. Layer and file rules are in
[architecture.md](architecture.md); file placement is in [recipes.md](recipes.md#hook-or-component).

## Stack

All of these are installed and wired.

| Need                                             | Use                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Styling                                          | Tailwind CSS v4 (`@tailwindcss/vite`), themed in `src/styles.css`     |
| Interactive components (every widget: see below) | React Aria Components (`react-aria-components`), styled with Tailwind |
| Component variants (`intent`, `size`, …)         | `tailwind-variants` (`tv`)                                            |
| Merging class names outside a `tv` call          | `cn()` from `#/lib/cn` (`clsx` + `tailwind-merge`)                    |
| Forms: state, validation, submission             | TanStack Form + Zod, rendering React Aria fields                      |
| Tables and long lists                            | TanStack Table (logic) + React Aria `Table` (a11y), TanStack Virtual  |

React Aria Components covers the full widget set: buttons, text fields, number fields, search,
checkbox/radio/switch, select, combobox/autocomplete, menu, listbox, grid list, tag group, tabs,
dialog/modal/popover/tooltip, disclosure, date and time pickers, calendar, range calendar, color
pickers, slider, progress/meter, table, tree, drag and drop, and file trigger/drop zone. Toast
ships as `UNSTABLE_Toast`/`UNSTABLE_ToastRegion`: wrap it in one primitive so an API change touches
one file. Don't add another component library or hand-roll a widget it provides.

Existing BEM classes in `src/styles.css` (`.version-banner…`) are legacy: convert a component to
Tailwind when you next change it, and delete its CSS in the same change.

## Design language lives in tokens

The design language is defined once, as Tailwind theme variables in the `@theme` block of
`src/styles.css`. Components use the semantic utilities those tokens generate (`bg-surface`,
`text-fg-muted`, `rounded-card`), never raw palette values or arbitrary hex. Dark mode redefines
the same variables under `prefers-color-scheme: dark`; components don't change.

- A new color, radius, shadow, or font is a new token, not an arbitrary value (`bg-[#…]`,
  `rounded-[7px]`). Arbitrary values are for one-off layout math only.
- Name tokens by role (`accent`, `danger`, `surface-raised`), not by hue (`blue`, `gray-900`).
  Changing the brand should be a token edit, not a find-and-replace.
- No inline `style={{…}}` for anything a utility covers. No new global CSS classes.

## Components

Primitives live in `src/components/ui/` (`Button.tsx`, `TextField.tsx`, `Dialog.tsx`, …), one
React Aria component each. Feature components live in `src/components/` and compose primitives.
`src/components/ui/Button.tsx` is the reference implementation; copy its shape.

- A primitive wraps one React Aria component, owns its Tailwind classes, and exposes variants
  through `tv`. Feature components don't restyle primitives beyond layout (`className` for margin,
  width, grid placement).
- Props describe intent (`intent="danger"`), not appearance (`red`). Keep React Aria's prop names
  (`onPress`, `isDisabled`, `onChange`) instead of inventing new ones.
- React Aria's `className` can be a function of render state. Pass it through
  `composeRenderProps` and let `tv` merge it, so callers can still override:

  ```tsx
  className={composeRenderProps(className, (className) => button({ intent, size, className }))}
  ```

- Style state with React Aria's data attributes, not `:hover` / `:focus` or render-prop
  booleans: `data-hovered:`, `data-pressed:`, `data-focus-visible:`, `data-selected:`,
  `data-disabled:`, `data-invalid:`, `data-open:`, `data-entering:`/`data-exiting:`. They behave the
  same for mouse, touch, and keyboard.
- Use `onPress`, not `onClick`, on React Aria buttons and links.
- For router links, use TanStack Router's `Link` for plain navigation. When a React Aria component
  takes an `href` (menu items, tabs, `Link`), register the router once with `RouterProvider` from
  `react-aria-components` so those navigate client-side.

## Accessibility baseline

React Aria handles keyboard, focus, and ARIA for its widgets. The rest is on us:

- Use the semantic element or matching React Aria component. No clickable `<div>`s.
- Every interactive element has a visible focus style (`data-focus-visible:`) and an accessible
  name. Icon-only buttons get `aria-label`; decorative SVGs get `aria-hidden="true"`.
- Form fields use React Aria's `Label`, `Text slot="description"`, and `FieldError` so labels,
  help text, and errors are wired up automatically.
- Async status (saving, errors, banners) is announced with `role="status"` / `aria-live`, or the
  toast primitive.
- Text meets WCAG AA contrast against its token background, in light and dark.
- Motion respects `motion-safe:` / `motion-reduce:`.
- Layouts work at 320px wide and at 200% zoom without horizontal scroll.
- Every new primitive gets a keyboard test ([testing.md](testing.md)).
