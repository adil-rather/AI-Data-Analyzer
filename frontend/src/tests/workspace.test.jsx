import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

const profile = {
  datasetId: "sample",
  name: "Retail sales",
  source: "sample",
  rows: 3,
  columns: ["sales", "region"],
  types: { sales: "numeric", region: "categorical" },
  stats: [
    {
      name: "sales",
      type: "numeric",
      count: 3,
      missing: 0,
      mean: 2,
      min: 1,
      max: 3,
      median: 2,
      histogram: [{ start: 1, end: 3, count: 3 }],
    },
    {
      name: "region",
      type: "categorical",
      count: 3,
      missing: 0,
      unique: 2,
      top: [{ value: "North", count: 2 }],
    },
  ],
  preview: [
    { sales: 1, region: "North" },
    { sales: 2, region: "South" },
    { sales: 3, region: "North" },
  ],
  missingCells: 0,
};

test("sample load opens a usable overview and clear removes dataset", async () => {
  window.location.hash = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === "/api/session")
        return new Response(JSON.stringify({ profile: null }));
      if (url === "/api/samples")
        return new Response(
          JSON.stringify([
            {
              id: "retail_sales",
              name: "Retail sales",
              description: "Synthetic retail",
              rows: 730,
              columns: 6,
            },
          ]),
        );
      if (url === "/api/sample") return new Response(JSON.stringify(profile));
      if (url === "/api/dataset") return new Response(null, { status: 204 });
      throw new Error("Unexpected route " + url);
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Bring your data into focus." }),
  ).toBeInTheDocument();
  await user.click(
    await screen.findByRole("button", { name: /Load Retail sales/i }),
  );
  expect(
    await screen.findByRole("heading", { name: "Overview", level: 1 }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("tab", { name: "Column profiles" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear data" }));
  await user.click(screen.getByRole("button", { name: "Delete dataset" }));
  expect(
    await screen.findByRole("heading", { name: "Bring your data into focus." }),
  ).toBeInTheDocument();
  vi.unstubAllGlobals();
});
