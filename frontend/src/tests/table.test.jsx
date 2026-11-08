import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "../views/Dashboard";
test("a source column named like display metadata remains visible", () => {
  const profile = {
    rows: 1,
    columns: ["__displayRow"],
    types: { __displayRow: "numeric" },
    stats: [
      {
        name: "__displayRow",
        type: "numeric",
        missing: 0,
        count: 1,
        min: 123,
        max: 123,
        median: 123,
        histogram: [],
      },
    ],
    preview: [{ __displayRow: 123 }],
    missingCells: 0,
  };
  render(<Dashboard profile={profile} onNavigate={() => {}} />);
  expect(screen.getByRole("cell", { name: "123" })).toBeInTheDocument();
});
