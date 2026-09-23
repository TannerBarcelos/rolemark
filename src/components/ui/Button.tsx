import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";
import { type VariantProps, tv } from "tailwind-variants";

// State styles use React Aria's data attributes (data-hovered, data-pressed, data-focus-visible,
// data-disabled), which behave consistently across mouse, touch, and keyboard.
const button = tv({
  base: "inline-flex cursor-default items-center justify-center gap-2 rounded-card font-medium outline-none transition-colors data-disabled:opacity-50 data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-accent",
  variants: {
    intent: {
      primary: "bg-accent text-accent-fg data-hovered:bg-accent/90 data-pressed:bg-accent/80",
      secondary:
        "border border-border bg-surface-raised text-fg data-hovered:bg-surface data-pressed:bg-border",
      danger: "bg-danger text-accent-fg data-hovered:bg-danger/90 data-pressed:bg-danger/80",
    },
    size: {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
    },
  },
  defaultVariants: { intent: "primary", size: "md" },
});

export type ButtonProps = AriaButtonProps & VariantProps<typeof button>;

export function Button({ intent, size, className, ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(className, (className) => button({ intent, size, className }))}
    />
  );
}
