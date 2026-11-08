export const COLORS = [
  "#2E6758",
  "#B65C3D",
  "#526E96",
  "#AA7B28",
  "#86647C",
  "#357F89",
  "#75834C",
  "#555B62",
  "#A55050",
  "#6C729B",
];
export function fmt(v, digits = 2) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const number = Number(v),
    magnitude = Math.abs(number);
  if (magnitude > 0 && (magnitude < 10 ** -digits || magnitude >= 1e12))
    return number.toExponential(Math.max(1, Math.min(3, digits)));
  return (Object.is(number, -0) ? 0 : number).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}
export const percentage = (v) => (v == null ? "—" : `${fmt(v * 100, 1)}%`);
export function uniqueFieldKey(columns, base = "__display") {
  let key = base;
  while (columns.includes(key)) key += "_";
  return key;
}
export function csvText(columns, rows) {
  const cell = (value) => {
    let text = value == null ? "" : String(value);
    if (
      /^[\s\u0000-\u001f]*[=+@-]/.test(text) &&
      !(typeof value === "number" && Number.isFinite(value))
    )
      text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      columns.map((c) => cell(c.label ?? c.key)).join(","),
      ...rows.map((row) => columns.map((c) => cell(row[c.key])).join(",")),
    ].join("\r\n")
  );
}
export function downloadCsv(filename, columns, rows) {
  const url = URL.createObjectURL(
    new Blob([csvText(columns, rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
