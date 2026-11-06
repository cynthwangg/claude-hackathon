import type { Lang } from "@/rules/types";
import type { ActionKind } from "./engine/plan";
import type { FactIndex } from "./facts";
import { fmtDate, joinList } from "./i18n";

export type Draft = { kind: "school" | "agency" | "ctc" | "office"; language: Lang; subject: string; body: string; to?: string };

type Course = { name: string; semester: string | null };

const year = (s?: string) => (s ? s.slice(0, 4) : "");

function schoolLanguage(f: FactIndex, country: string | null): Lang {
  const c = (country ?? "").toLowerCase();
  if (/mexico|méxico|spain|colombia|peru|argentina|chile|guatemala|salvador|honduras|venezuela|ecuador|bolivia|cuba|dominican/.test(c)) return "es";
  if (/china/.test(c)) return "zh";
  if (f.has("transcript.present") && /[\u4e00-\u9fff]/.test(f.get<string>("transcript.institution") ?? "")) return "zh";
  return "en";
}

/**
 * Letters are templates filled by code from facts she confirmed. The model never composes them,
 * and they never claim equivalence or eligibility.
 */
export function draftFor(kind: ActionKind | "office_question", f: FactIndex, ctx: { name: string | null; country: string | null; profession: string | null; state: string | null; office: string | null }): Draft | null {
  const name = f.get<string>("transcript.student_name") ?? f.get<string>("degree.holder_name") ?? ctx.name ?? "[full name]";
  const program = f.get<string>("transcript.program_name") ?? f.get<string>("degree.title") ?? "";
  const plan = f.get<string>("transcript.plan");
  const institution = f.get<string>("transcript.institution") ?? f.get<string>("degree.institution") ?? "";
  const start = year(f.get<string>("transcript.start_date"));
  const end = year(f.get<string>("transcript.end_date"));
  const office = f.get<string>("transcript.issuing_office");
  const named = f.get<string[]>("transcript.practicum_named") ?? [];
  const all = f.get<string[]>("transcript.practicum_courses") ?? [];
  const courses = (f.get<Course[]>("transcript.courses") ?? []).filter((c) => named.includes(c.name));
  const semesters = Array.from(new Set(courses.map((c) => c.semester).filter((s): s is string => !!s)));
  const license = f.get<string>("license.profession_title");

  switch (kind) {
    case "request_school_letter": {
      const lang = schoolLanguage(f, ctx.country);
      if (lang === "es") {
        const sem = semesters.length ? ` (${joinList("es", semesters)})` : "";
        return {
          kind: "school", language: "es", subject: "Solicitud de constancia de práctica docente",
          body: [
            "Asunto. Solicitud de constancia de práctica docente",
            `A quien corresponda, ${office ?? "Dirección de Servicios Escolares"}`,
            `Soy egresada de la ${program}${plan ? `, Plan ${plan}` : ""}${start && end ? `, generación ${start} a ${end}` : ""}. Estoy tramitando el reconocimiento de mis estudios ante la Comisión de Acreditación Docente de California, que requiere que una agencia evaluadora pueda verificar que mi formación incluyó práctica docente supervisada.`,
            `Mi certificado de estudios registra las asignaturas ${joinList("es", named)}${sem}. Solicito una constancia en hoja membretada que indique, para cada una, el número de horas, el carácter de práctica frente a grupo en escuelas primarias y el periodo en que se cursó.`,
            "Las agencias evaluadoras suelen pedir que los documentos lleguen directamente de la institución. Agradeceré que la constancia se envíe en sobre cerrado o por su canal oficial a la agencia, a la dirección que indico abajo.",
            `Nombre completo. ${name}\nMatrícula. [de tu certificado]\nAgencia y dirección. [se completa cuando elijas agencia]`,
            "Gracias por su atención.",
          ].join("\n\n"),
        };
      }
      if (lang === "zh") {
        return {
          kind: "school", language: "zh", subject: "关于开具教育实习证明的申请",
          body: [
            `${office ?? "教务处"}：`,
            `我是${institution}${program}专业${start && end ? ` ${start} 至 ${end} 年` : ""}的毕业生${name}。我正在向美国加州教师资格认证委员会申请认可我的学历，评估机构需要能够核实我的培养过程包括有指导的教育实习。`,
            `我的成绩单上列有${joinList("zh", named)}${semesters.length ? `（${joinList("zh", semesters)}）` : ""}，但没有写明实习学校、周数和课时。恳请学校出具实习鉴定表或实习证明，写明实习学校、起止日期、每周课时以及指导教师的评价，并加盖学校公章。`,
            "评估机构通常要求文件由学校直接寄出。如可以，请将证明密封后寄往我选定的评估机构，地址如下。",
            `姓名 ${name}\n学号 [见成绩单]\n评估机构及地址 [选定机构后填写]`,
            "谢谢。",
          ].join("\n\n"),
        };
      }
      return {
        kind: "school", language: "en", subject: "Request for a letter describing my student teaching",
        body: [
          `To the ${office ?? "Registrar"}`,
          `I graduated from the ${program} program${start && end ? ` (${start} to ${end})` : ""}. I am having my studies recognized by the California Commission on Teacher Credentialing, which requires that an evaluation agency can verify that my preparation included supervised student teaching.`,
          `My transcript lists ${joinList("en", named.length ? named : all)}. I am requesting a letter on letterhead that states, for each, the number of hours, that it was supervised classroom teaching, the school and the dates.`,
          "Evaluation agencies usually ask that documents arrive directly from the institution. Please send the letter sealed or through your official channel to the agency at the address below.",
          `Full name. ${name}\nStudent number. [from your transcript]\nAgency and address. [fill in once you choose the agency]`,
          "Thank you.",
        ].join("\n\n"),
      };
    }

    case "request_evaluation":
      return {
        kind: "agency", language: "en", subject: "Course-by-course evaluation for a California teaching credential",
        body: [
          "To the evaluation agency",
          "I am requesting a detailed course-by-course evaluation of my foreign studies for a California teaching credential (Commission on Teacher Credentialing, Preliminary Multiple Subject).",
          `I am sending my transcript, my degree${license ? `, and my teaching license (${license})` : ", and my teaching license"}, because the Commission asks that the agency also sees the out-of-country teaching credential.`,
          named.length ? `My transcript lists ${joinList("en", named)}. Please report these as they are documented. A letter from my school describing them is being sent to you directly.` : "",
          `Name as printed on my documents. ${name}`,
          "Thank you.",
        ].filter(Boolean).join("\n\n"),
      };

    case "ask_ctc_question": {
      const years = start && end ? `, ${start} to ${end}` : "";
      const coursesLine = named.length
        ? `My transcript lists ${joinList("en", named)}.`
        : "My transcript does not use the words \"student teaching\" or \"practicum.\"";
      return {
        kind: "ctc", language: "en", subject: "Question about student teaching verification for a foreign-prepared Multiple Subject application",
        to: "Questions Regarding Applications, https://www.ctc.ca.gov/commission/contact-the-commission",
        body: [
          "Subject. Question about student teaching verification for a foreign-prepared Multiple Subject application",
          `I completed a four-year teacher preparation program${program ? `, ${program}` : ""}${institution ? `, at ${institution}` : ""}${ctx.country ? `, ${ctx.country}` : ""}${years}. ${coursesLine} Before I request a course-by-course evaluation, could you tell me what documentation the Commission would need from my institution to verify supervised student teaching under CL-871, and whether a letter from the institution describing the placement is acceptable.`,
          "Thank you.",
          name,
        ].join("\n\n"),
      };
    }

    case "respond_ctc_letter": {
      const date = f.get<string>("ctc_letter.date");
      return {
        kind: "ctc", language: "en", subject: `Additional information requested in your letter of ${fmtDate("en", date)}`,
        body: [
          `Re. ${f.get<string>("ctc_letter.subject") ?? "Returned for Additional Information"}, ${f.get<string>("ctc_letter.application_title") ?? "Preliminary Multiple Subject Teaching Credential"}`,
          `Enclosed are the materials requested in your letter of ${fmtDate("en", date)}, with a copy of that letter.`,
          "1. A course-by-course evaluation from a Commission-approved agency.\n2. The same evaluation, which reports my professional preparation program including student teaching.",
          name,
        ].join("\n\n"),
      };
    }

    case "confirm_resubmit": {
      const date = f.get<string>("ctc_letter.date");
      return {
        kind: "ctc", language: "en", subject: "Question about an application returned for additional information",
        to: "Questions Regarding Applications, https://www.ctc.ca.gov/commission/contact-the-commission",
        body: [
          `My application for the Preliminary Multiple Subject Teaching Credential was returned for additional information in a letter dated ${fmtDate("en", date)}. The 60 days have passed. Could you tell me whether I need to submit a new application and fee, or whether the materials can still be accepted with a copy of the letter.`,
          "Thank you.",
          name,
        ].join("\n\n"),
      };
    }

    case "office_question":
      return {
        kind: "office", language: "en", subject: "Question about licensure for someone trained outside the United States",
        to: ctx.office ?? undefined,
        body: [
          `I trained and worked as ${ctx.profession ? `a ${ctx.profession.replace(/_/g, " ")}` : "a professional"} in ${ctx.country ?? "[country]"}${license ? ` and hold ${license}` : ""}. I now live in ${ctx.state ?? "[state]"}.`,
          "Could you tell me which application route you use for people educated outside the United States, which documents you need, whether my credentials must be evaluated by a specific credential evaluation service, and what report type that evaluation must be.",
          "Thank you.",
          name,
        ].join("\n\n"),
      };

    default:
      return null;
  }
}
