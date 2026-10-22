import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { decodeStatementBytes } from "./statement-parsers";
import { extractStatementPdf, type ExtractedStatementPdf } from "./statement-pdf-extractor";
import type { StatementFormat } from "../types/statement-import";

export async function pickStatementFile(): Promise<{ name: string; text: string; hash: string; format: StatementFormat; pdf?: ExtractedStatementPdf } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const cached = asset.file ? null : new File(asset.uri);
  try {
    const extension = asset.name.split(".").at(-1)?.toLowerCase();
    if (extension !== "ofx" && extension !== "csv" && extension !== "pdf") throw new Error("Selecione um arquivo .ofx, .csv ou .pdf.");
    if ((asset.size ?? cached?.size ?? 0) > 5 * 1024 * 1024) throw new Error("O limite é 5 MiB por arquivo.");
    const bytes = asset.file ? new Uint8Array(await asset.file.arrayBuffer()) : await cached!.bytes();
    if (bytes.length > 5 * 1024 * 1024) throw new Error("O limite é 5 MiB por arquivo.");
    const buffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
    const hash = [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (extension === "pdf") {
      const pdf = await extractStatementPdf(asset.uri);
      return { name: asset.name, text: "", hash, format: "pdf", pdf };
    }
    return { name: asset.name, text: decodeStatementBytes(bytes), hash, format: extension };
  } finally {
    // Only our picker cache copy may be removed. Never delete a user's original document.
    if (cached?.uri.startsWith(`${Paths.cache.uri.replace(/\/$/, "")}/`)) {
      try { cached.delete(); } catch { /* Cache eviction is best effort; no financial content is logged. */ }
    }
  }
}

export async function statementBankScope(accountKey: string | null, format: string): Promise<string> {
  return accountKey ? Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, accountKey) : `${format}:unspecified`;
}
