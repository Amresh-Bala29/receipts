import type { AnalyzerSignal, ReceiptSummary } from "@receipts/shared";

export type CodingReceiptRow = {
  id: string;
  createdAt: string;
  sessionId: string;
  handle: string;
  slug: string;
  signatureSnippet: string;
  summary: ReceiptSummary;
  signals: AnalyzerSignal[];
  languages: string[];
  chainOk: boolean;
};
