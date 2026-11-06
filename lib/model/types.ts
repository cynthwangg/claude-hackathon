import type { Intake, Turn } from "../intake/types";
import type { ReadResult } from "../reading/schema";
import type { Lang } from "@/rules/types";

export type IntakeReply = { say: string; intake: Partial<Intake> };
/** What the shared agent is talking about. `case` is her credential case; the others are the career coach topics. */
export type Topic = "case" | "roles" | "visa" | "resume" | "general";
export type FileInput = { bytes: Buffer; mime: string; name: string };

export interface ModelProvider {
  name: string;
  intakeTurn(lang: Lang, history: Turn[], intake: Intake, missing: string[]): Promise<IntakeReply>;
  readDocument(file: FileInput, kindHint: string | null): Promise<ReadResult>;
  readingAid(lang: Lang, officialText: string): Promise<string>;
  translateLetter(toLang: Lang, letter: string): Promise<string>;
  /** One reply in the shared conversation (web and WhatsApp), grounded in her case file. */
  chatTurn(lang: Lang, history: Turn[], caseBrief: string, topic: Topic): Promise<string>;
}
