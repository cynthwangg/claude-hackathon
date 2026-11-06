/** Thumbnails of what each document usually looks like, by country of training. All synthetic. */
const EXAMPLES: Record<string, Partial<Record<string, string>>> = {
  Mexico: { transcript: "/examples/mx-certificado.jpg", degree: "/examples/mx-titulo.jpg", license: "/examples/mx-cedula.jpg", experience: "/examples/mx-constancia.jpg" },
  China: { transcript: "/examples/cn-chengjidan.jpg", degree: "/examples/cn-biyezheng.jpg", license: "/examples/cn-jiaoshizige.jpg", experience: "/examples/cn-gongzuozhengming.jpg" },
};

export const exampleFor = (country: string | null, kind: string) => (country ? EXAMPLES[country]?.[kind] ?? null : null);
