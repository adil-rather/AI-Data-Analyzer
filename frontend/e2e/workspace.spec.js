import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

async function nav(page, label) {
  if (page.viewportSize().width <= 900) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("dialog", { name: "Workspace navigation" })
      .getByRole("button", { name: label, exact: true })
      .click();
  } else
    await page
      .locator(".desktop-sidebar")
      .getByRole("button", { name: label, exact: true })
      .click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator("main h1")).toBeFocused();
}
async function screenshot(page, info, name) {
  if (!process.env.ANALYZER_SCREENSHOT_DIR) return;
  const dir = process.env.ANALYZER_SCREENSHOT_DIR;
  await fs.mkdir(dir, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(550);
  await page.screenshot({
    path: path.join(dir, `${info.project.name}-${name}.png`),
    fullPage: true,
  });
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
}

test("six workflows render real results and preserve completed analysis", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let forecasts = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/forecast") && r.method() === "POST") forecasts++;
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bring your data into focus." }),
  ).toBeVisible();
  await screenshot(page, info, "source");
  await noOverflow(page);
  await page.getByRole("button", { name: "Load Retail Sales sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".facts").getByText("730", { exact: true }),
  ).toBeVisible();
  const preview = page.getByRole("region", { name: "Dataset preview" });
  await expect(preview.locator("tbody tr")).toHaveCount(
    page.viewportSize().width <= 620 ? 5 : 10,
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    preview.locator("tbody tr").first().locator("td").first(),
  ).toHaveText(page.viewportSize().width <= 620 ? "6" : "11");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  const dataTab = page.getByRole("tab", { name: "Data preview" });
  await dataTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Column profiles" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(dataTab).toHaveAttribute("aria-selected", "true");
  await screenshot(page, info, "overview");
  await noOverflow(page);
  await nav(page, "Trend Forecast");
  await page.getByRole("button", { name: "Run forecast" }).click();
  await expect(
    page.getByRole("heading", { name: "sales · observed and projected" }),
  ).toBeVisible();
  await expect(page.getByText("Holdout MAE", { exact: true })).toBeVisible();
  await expect(page.locator(".facts dd").first()).not.toHaveText("—");
  await screenshot(page, info, "forecast");
  await noOverflow(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadEvent;
  const text = await fs.readFile(await download.path(), "utf8");
  expect(text.split("\r\n")).toHaveLength(31);
  await nav(page, "Overview");
  await nav(page, "Trend Forecast");
  await expect(
    page.getByRole("heading", { name: "sales · observed and projected" }),
  ).toBeVisible();
  expect(forecasts).toBe(1);
  await nav(page, "Clustering");
  await page.getByRole("button", { name: "Find clusters" }).click();
  await expect(
    page.getByRole("heading", { name: "The shape of your segments" }),
  ).toBeVisible();
  await screenshot(page, info, "clustering");
  await noOverflow(page);
  await nav(page, "Classification");
  await page.getByRole("button", { name: "Train classifier" }).click();
  await expect(
    page.getByRole("heading", { name: "Confusion matrix" }),
  ).toBeVisible();
  await screenshot(page, info, "classification");
  await noOverflow(page);
  await nav(page, "Insights");
  await page.getByRole("button", { name: "Generate insights" }).click();
  await expect(
    page.getByRole("heading", { name: "How your variables relate" }),
  ).toBeVisible();
  await screenshot(page, info, "insights");
  await noOverflow(page);
  const cookie = await page.request.get("/api/session");
  const did = (await cookie.json()).profile.datasetId;
  const other = await page.context().browser().newContext();
  const response = await other.request.post(
    "http://127.0.0.1:8012/api/insights",
    {
      headers: { "X-Requested-With": "AI-Data-Analyzer" },
      data: { datasetId: did },
    },
  );
  expect(response.status()).toBe(404);
  await other.close();
  await page.getByRole("button", { name: "Clear data", exact: true }).click();
  await page.getByRole("button", { name: "Delete dataset" }).click();
  await expect(
    page.getByRole("heading", { name: "Bring your data into focus." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("upload text stays text and navigation works with keyboard and reduced motion", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bring your data into focus." }),
  ).toBeVisible();
  await page.getByLabel("Upload a dataset").setInputFiles({
    name: "fixture.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "value,label\n1,<img src=x onerror=alert(1)>\n2,safe\n3,safe",
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody img")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "<img src=x onerror=alert(1)>" }),
  ).toBeVisible();
  if (page.viewportSize().width <= 900) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("dialog", { name: "Workspace navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement.closest("dialog")),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Workspace navigation" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeFocused();
  }
  await nav(page, "Insights");
  await expect(
    page.getByRole("heading", { name: "Insights", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});
