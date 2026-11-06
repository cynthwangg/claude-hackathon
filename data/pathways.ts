import type { L10n } from "@/rules/types";

export type Depth = "deep" | "partial" | "none";
export type Pathway = {
  id: string;
  depth: Depth;
  authority_id: string;
  match: { professions: string[]; levels?: (string | null)[]; states: string[] };
  title: L10n;
  orientation: L10n;
};

export const pathways: Pathway[] = [
  {
    id: "ctc_ms_preliminary_foreign_prepared", depth: "deep", authority_id: "ca_ctc",
    match: { professions: ["teacher"], levels: ["elementary", null], states: ["CA"] },
    title: { en: "California, elementary teaching", es: "California, primaria", zh: "加州，小学教师" },
    orientation: {
      en: "In California, teachers are licensed by the Commission on Teacher Credentialing, the CTC. For someone trained outside the US, the route starts with a report on your studies written by an agency the CTC approves, and it has to be the detailed kind, course by course. With that report, your teaching license from home and fingerprints, you apply to the CTC for a preliminary credential. The step most people lose money on is ordering the wrong kind of report.",
      es: "En California, a las maestras las acredita la Comisión de Acreditación Docente, la CTC. Para quien estudió fuera de Estados Unidos, la ruta empieza con un reporte sobre tus estudios hecho por una agencia que la CTC aprueba, y tiene que ser del tipo detallado, curso por curso. Con ese reporte, tu licencia de tu país y tus huellas, solicitas a la CTC una credencial preliminar. El paso en el que más gente pierde dinero es pedir el tipo de reporte equivocado.",
      zh: "在加州，教师执照由教师资格认证委员会（CTC）颁发。在美国以外受训的人，第一步是请 CTC 认可的机构出具一份关于你学历的报告，而且必须是逐门课程的详细报告。有了这份报告、你本国的教师资格证和指纹，就可以向 CTC 申请初级教师证。大多数人损失钱的地方，是订错了报告类型。",
    },
  },
  {
    id: "ctc_ss_preliminary_foreign_prepared", depth: "partial", authority_id: "ca_ctc",
    match: { professions: ["teacher"], levels: ["secondary"], states: ["CA"] },
    title: { en: "California, secondary teaching", es: "California, secundaria", zh: "加州，中学教师" },
    orientation: {
      en: "In California, teachers are licensed by the Commission on Teacher Credentialing, the CTC. Secondary teachers apply for a Single Subject credential, and the first steps are the same as for elementary. A course-by-course report from a CTC-approved agency, your teaching license from home, fingerprints. We have mapped the elementary route in full; for Single Subject we know the shared steps and the leaflet (CL-870), not every rule. Where we are unsure we say so and write the question for the CTC.",
      es: "En California, a los maestros los acredita la Comisión de Acreditación Docente, la CTC. Quien enseña secundaria solicita una credencial Single Subject, y los primeros pasos son los mismos que en primaria. Un reporte curso por curso de una agencia aprobada, tu licencia de tu país, huellas. Tenemos la ruta de primaria completa; de Single Subject conocemos los pasos compartidos y el folleto (CL-870), no cada regla. Donde no estemos seguras lo diremos y escribiremos la pregunta para la CTC.",
      zh: "在加州，教师执照由教师资格认证委员会（CTC）颁发。中学教师申请的是单科（Single Subject）教师证，前几步与小学相同。CTC 认可机构的逐门课程报告、你本国的教师资格证、指纹。我们把小学路线完整梳理过；单科路线我们了解共同步骤和官方说明（CL-870），但不是每一条规则。不确定的地方我们会明说，并替你写好给 CTC 的问题。",
    },
  },
];

export const generalOrientation: L10n = {
  en: "We have not mapped this route in detail, so we will not guess at rules. What we can do is read every document you have and tell you exactly what it says, name the office that decides in your state, and write your first question to them. Their answer is what counts.",
  es: "No tenemos esta ruta mapeada en detalle, así que no vamos a adivinar reglas. Lo que sí podemos hacer es leer cada documento que tengas y decirte exactamente qué dice, nombrar la oficina que decide en tu estado y escribir tu primera pregunta para ellos. Lo que cuenta es su respuesta.",
  zh: "这条路线我们还没有详细梳理，所以不会去猜规则。我们能做的是读你手上的每一份文件并如实告诉你上面写了什么，指出你所在州负责决定的机构，并替你写好给他们的第一个问题。算数的是那个机构的答复。",
};
