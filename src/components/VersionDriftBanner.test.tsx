import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VersionDriftBanner } from "#/components/VersionDriftBanner";
import { useVersionDrift } from "#/hooks/use-version-drift";

vi.mock("#/hooks/use-version-drift", () => ({ useVersionDrift: vi.fn() }));

const mockedUseVersionDrift = vi.mocked(useVersionDrift);

describe("VersionDriftBanner", () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockReset();
  });

  it("renders nothing while the build is current", () => {
    mockedUseVersionDrift.mockReturnValue({ isStale: false, reload });
    const { container } = render(<VersionDriftBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the update and reloads on Refresh", async () => {
    mockedUseVersionDrift.mockReturnValue({ isStale: true, reload });
    render(<VersionDriftBanner />);

    expect(screen.getByRole("status")).toHaveTextContent("Update available");
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("hides when closed", async () => {
    mockedUseVersionDrift.mockReturnValue({ isStale: true, reload });
    render(<VersionDriftBanner />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
