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
      en: "In California, teachers get their license from the Commission on Teacher Credentialing, the CTC.\n\nIf you trained outside the US, you start with a report on your studies from an agency the CTC approves. It has to be the detailed kind, course by course.\n\nWith that report, your teaching license from home and your fingerprints, you apply to the CTC for a first credential.\n\nThe step where most people lose money is ordering the wrong kind of report.",
      es: "En California, a las maestras las acredita la Comisión de Acreditación Docente, la CTC.\n\nSi estudiaste fuera de Estados Unidos, empiezas con un reporte sobre tus estudios hecho por una agencia que la CTC aprueba. Tiene que ser del tipo detallado, curso por curso.\n\nCon ese reporte, tu licencia de tu país y tus huellas, le pides a la CTC una primera credencial.\n\nEl paso en el que más gente pierde dinero es pedir el tipo de reporte equivocado.",
      zh: "在加州，教师执照由教师资格认证委员会（CTC）颁发。在美国以外受训的人，第一步是请 CTC 认可的机构出具一份关于你学历的报告，而且必须是逐门课程的详细报告。有了这份报告、你本国的教师资格证和指纹，就可以向 CTC 申请初级教师证。大多数人损失钱的地方，是订错了报告类型。",
    },
  },
  {
    id: "ctc_ss_preliminary_foreign_prepared", depth: "partial", authority_id: "ca_ctc",
    match: { professions: ["teacher"], levels: ["secondary"], states: ["CA"] },
    title: { en: "California, secondary teaching", es: "California, secundaria", zh: "加州，中学教师" },
    orientation: {
      en: "In California, teachers get their license from the Commission on Teacher Credentialing, the CTC.\n\nMiddle and high school teachers apply for a Single Subject credential. The first steps are the same as for elementary. You need a course-by-course report from an agency the CTC approves, your teaching license from home, and your fingerprints.\n\nWe know the elementary route in full. For Single Subject we know the shared steps and the CTC leaflet called CL-870, but not every rule.\n\nWhen we're not sure, we'll tell you and write the question for the CTC.",
      es: "En California, a los maestros los acredita la Comisión de Acreditación Docente, la CTC.\n\nQuien enseña secundaria pide una credencial Single Subject. Los primeros pasos son los mismos que en primaria. Necesitas un reporte curso por curso de una agencia aprobada, tu licencia de tu país y tus huellas.\n\nConocemos la ruta de primaria completa. De Single Subject conocemos los pasos compartidos y el folleto de la CTC llamado CL-870, pero no cada regla.\n\nCuando no estemos seguras, te lo diremos y escribiremos la pregunta para la CTC.",
      zh: "在加州，教师执照由教师资格认证委员会（CTC）颁发。中学教师申请的是单科（Single Subject）教师证，前几步与小学相同。CTC 认可机构的逐门课程报告、你本国的教师资格证、指纹。我们把小学路线完整梳理过；单科路线我们了解共同步骤和官方说明（CL-870），但不是每一条规则。不确定的地方我们会明说，并替你写好给 CTC 的问题。",
    },
  },
];

export const generalOrientation: L10n = {
  en: "We haven't mapped this route in detail yet, so we won't guess at the rules.\n\nHere's what we can do. We read every document you have and tell you exactly what it says. We name the office that decides in your state. And we write your first question to them.\n\nTheir answer is the one that counts.",
  es: "No tenemos esta ruta mapeada en detalle, así que no vamos a adivinar reglas. Lo que sí podemos hacer es leer cada documento que tengas y decirte exactamente qué dice, nombrar la oficina que decide en tu estado y escribir tu primera pregunta para ellos. Lo que cuenta es su respuesta.",
  zh: "这条路线我们还没有详细梳理，所以不会去猜规则。我们能做的是读你手上的每一份文件并如实告诉你上面写了什么，指出你所在州负责决定的机构，并替你写好给他们的第一个问题。算数的是那个机构的答复。",
};
