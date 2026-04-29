export type AnalyzerSignal = {
  id: string;
  label: string;
  status: "good" | "neutral" | "concern";
  detail: string;
};

export type ReceiptSummary = {
  totalEvents: number;
  durationMs: number;
  editEvents: number;
  runEvents: number;
  externalPastes: number;
  internalPastes: number;
  longestIdleMs: number;
  snapshotCount: number;
};

export type Receipt = {
  id: string;
  sessionId: string;
  author: { name: string; handle: string };
  createdAt: string;
  signatureSnippet: string;
  summary: ReceiptSummary;
  signals: AnalyzerSignal[];
  languages: string[];
  chainOk: boolean;
};
