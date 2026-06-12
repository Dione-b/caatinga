import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const BINDING_MARKER_FILENAME = ".caatinga-bindings.json";

export const BindingMarkerSchema = z.object({
  version: z.literal(1),
  contractId: z.string().min(1),
  wasmHash: z.string().min(1),
  network: z.string().min(1),
  generatedAt: z.string().datetime()
});

export type BindingMarker = z.infer<typeof BindingMarkerSchema>;

export async function writeBindingMarker(outputDir: string, marker: BindingMarker): Promise<void> {
  const markerPath = path.join(outputDir, BINDING_MARKER_FILENAME);
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

/** Returns null when the marker is absent or unreadable — freshness degrades, never throws. */
export async function readBindingMarker(outputDir: string): Promise<BindingMarker | null> {
  const markerPath = path.join(outputDir, BINDING_MARKER_FILENAME);

  let raw: string;
  try {
    raw = await readFile(markerPath, "utf8");
  } catch {
    return null;
  }

  try {
    return BindingMarkerSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
