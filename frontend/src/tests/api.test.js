import { afterEach, expect, test, vi } from "vitest";
import { api } from "../api";
afterEach(() => vi.unstubAllGlobals());

test("server field validation becomes a readable message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ["body", "periods"],
              msg: "Input should be greater than or equal to 1",
            },
          ],
        }),
        { status: 422 },
      ),
    ),
  );
  await expect(
    api.forecast({ datasetId: "test", target: "sales", periods: 0 }),
  ).rejects.toThrow("periods: Input should be greater than or equal to 1");
});

test("mutations declare the same-origin request header", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  await api.loadSample("retail_sales");
  expect(fetcher.mock.calls[0][1].headers["X-Requested-With"]).toBe(
    "AI-Data-Analyzer",
  );
});

test("network failures have a helpful retry message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  await expect(api.samples()).rejects.toThrow("connection");
});
