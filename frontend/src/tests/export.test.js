import { expect, test } from "vitest";
import { csvText, fmt } from "../lib";
test("CSV export quotes delimiters and neutralizes spreadsheet formulas", () => {
  const csv = csvText(
    [
      { key: "text", label: "Text" },
      { key: "value", label: "Value" },
    ],
    [
      { text: "=1+1", value: -4 },
      { text: "a,b", value: 2 },
    ],
  );
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"a,b","2"');
  expect(csv).toContain('"-4"');
});

test("small scientific measurements are not formatted as zero", () => {
  expect(Number(fmt(2.1e-7))).toBeCloseTo(2.1e-7, 14);
  expect(fmt(-0.003, 2)).not.toBe("-0");
});
