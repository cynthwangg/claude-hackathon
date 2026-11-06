import { describe, expect, it } from "vitest";
import { decide } from "@/lib/agent";

describe("shared agent routing (code decides, not the model)", () => {
  it("only MENU shows the numbered menu; a greeting gets a conversational reply", () => {
    for (const w of ["MENU", "menu.", "Menú", "菜单"]) expect(decide({ text: w }, null).kind).toBe("menu");
    for (const w of ["hi", "Hello!", "hey", "hola", "Buenas tardes", "你好"]) expect(decide({ text: w }, null).kind).toBe("greeting");
    for (const w of ["Hi Bridge", "hello, Bridge!", "¡Hola!", "hi there"]) expect(decide({ text: w }, null).kind).toBe("greeting");
  });

  it("a greeting with content is not a menu request, it is the start of her case", () => {
    expect(decide({ text: "Hi, I'm Lin Wei, I taught middle school in Hangzhou" }, null)).toEqual({ kind: "text", text: "Hi, I'm Lin Wei, I taught middle school in Hangzhou" });
  });

  it("a number picks a topic only right after the menu", () => {
    expect(decide({ text: "2" }, "menu")).toEqual({ kind: "pick", topic: "roles" });
    expect(decide({ text: "3." }, "menu")).toEqual({ kind: "pick", topic: "visa" });
    expect(decide({ text: "4" }, "menu")).toEqual({ kind: "pick", topic: "resume" });
    expect(decide({ text: "1" }, "menu")).toEqual({ kind: "pick", topic: "case" });
    // "8" as the answer to "how many years did you teach" stays her answer
    expect(decide({ text: "8" }, null)).toEqual({ kind: "text", text: "8" });
    expect(decide({ text: "2" }, "roles")).toEqual({ kind: "text", text: "2" });
    expect(decide({ text: "9" }, "menu")).toEqual({ kind: "text", text: "9" });
  });

  it("the web picks topics directly", () => {
    expect(decide({ pick: "visa" }, null)).toEqual({ kind: "pick", topic: "visa" });
    expect(decide({ pick: "menu" }, "roles")).toEqual({ kind: "menu" });
    expect(decide({ text: "  " }, null)).toEqual({ kind: "none" });
  });
});

describe("choosing a language by name", () => {
  it("switches on the language's own name or the English one", () => {
    expect(decide({ text: "Español" }, null)).toMatchObject({ kind: "lang", lang: "es" });
    expect(decide({ text: "spanish" }, "roles")).toMatchObject({ kind: "lang", lang: "es" });
    expect(decide({ text: "中文" }, null)).toMatchObject({ kind: "lang", lang: "zh" });
    expect(decide({ text: "in English please" }, null).kind).toBe("text");
    expect(decide({ text: "English" }, "menu")).toMatchObject({ kind: "lang", lang: "en" });
  });
  it("a sentence that mentions a language is not a switch", () => {
    expect(decide({ text: "I taught English in Mexico" }, null).kind).toBe("text");
  });
});
