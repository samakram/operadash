import { Parser } from "json2csv";
import type { Response } from "express";

export function sendCsv(res: Response, filename: string, rows: Record<string, unknown>[]): void {
  const parser = new Parser({ fields: rows.length > 0 ? Object.keys(rows[0]) : [] });
  const csv = parser.parse(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
