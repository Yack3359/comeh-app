export type ImportTarget = "expense" | "result";

export type Season = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type ImportExtractionEnvelope = {
  version: 1;
  target: ImportTarget;
  seasonId: string;
  mimeType: string;
  originalName: string;
  rows: unknown[];
  validatedRowIndexes: number[];
  createdEntityIds?: Record<string, string>;
  error?: string;
};

export type ImportBatch = {
  id: string;
  sourceType: "PDF" | "IMAGE" | "EXCEL";
  status: "PENDING" | "EXTRACTED" | "VALIDATED" | "FAILED";
  extraction: unknown;
  createdAt: string;
  fileUrl: string;
  message?: string;
};

export type Category = {
  id: string;
  name: string;
  seasonId: string;
};

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
};

export type Competition = {
  id: string;
  name: string;
  date: string;
  seasonId: string;
};

