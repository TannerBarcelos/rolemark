import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "#/components/ui/Button";

describe("Button", () => {
  it("calls onPress when clicked", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("is operable from the keyboard", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const onPress = vi.fn();
    render(
      <Button isDisabled onPress={onPress}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("applies the intent variant and lets className override it", () => {
    render(
      <Button intent="danger" className="px-8">
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("bg-danger", "px-8");
    expect(button).not.toHaveClass("px-4");
  });
});
