import type { Intake, Turn } from "../intake/types";
import type { ReadResult } from "../reading/schema";
import type { Lang } from "@/rules/types";

export type IntakeReply = { say: string; intake: Partial<Intake> };
export type FileInput = { bytes: Buffer; mime: string; name: string };

export interface ModelProvider {
  name: string;
  intakeTurn(lang: Lang, history: Turn[], intake: Intake, missing: string[]): Promise<IntakeReply>;
  readDocument(file: FileInput, kindHint: string | null): Promise<ReadResult>;
  readingAid(lang: Lang, officialText: string): Promise<string>;
  translateLetter(toLang: Lang, letter: string): Promise<string>;
}
