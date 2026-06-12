/**
 * Minimal padded-column table renderer. Returns lines (header, separator, rows)
 * so callers route output through the logger. ANSI-styled cells would skew the
 * padding — callers must pass plain strings and style whole lines if needed.
 */
export function renderTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length))
  );

  const renderRow = (cells: string[]): string =>
    cells.map((cell, column) => (cell ?? "").padEnd(widths[column])).join("  ").trimEnd();

  return [
    renderRow(headers),
    widths.map((width) => "─".repeat(width)).join("  "),
    ...rows.map((row) => renderRow(row))
  ];
}
