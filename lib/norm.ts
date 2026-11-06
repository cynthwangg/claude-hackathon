export const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const containsAny = (text: string, words: string[]) => {
  const t = fold(text);
  return words.some((w) => t.includes(fold(w)));
};
