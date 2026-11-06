import type { Rule } from "./types";

export const PATHWAY_ID = "ctc_ms_preliminary_foreign_prepared";

const READ = "2026-11-05";
const base = { pathway_id: PATHWAY_ID, retrieved_on: READ, verified_by: null, verified_on: null } as const;

const CTC = { en: "A CTC analyst", es: "Un analista de la CTC", zh: "CTC 的审核人员" };
const EVAL_THEN_CTC = { en: "The evaluation agency, then the CTC", es: "La agencia evaluadora y después la CTC", zh: "评估机构，然后是 CTC" };

const CL635 = "https://www.ctc.ca.gov/credentials/leaflets/cl-635/";
const CL871 = "https://www.ctc.ca.gov/credentials/leaflets/cl-871/";
const CL659 = "https://www.ctc.ca.gov/credentials/leaflets/cl-659/";
const CHECKLIST = "https://www.ctc.ca.gov/credentials/checklist-msc-out-of-us/";
const FEES = "https://www.ctc.ca.gov/credentials/fees-and-fingerprinting/";
const STATUS = "https://www.ctc.ca.gov/ctc-online-services-help/your-educator-account/check-application-status/";
const LIST = "https://www.ctc.ca.gov/aspiring-educators/transcripts/foreign-transcript-eval/";
const CL505P = "https://www.ctc.ca.gov/credentials/leaflets/cl-505p/";

const noReport = { fact: "evaluation.report_type", exists: false } as const;
const cbc = { fact: "evaluation.report_type", eq: "course_by_course" } as const;

export const rules: Rule[] = [
  {
    ...base, id: "R01", phase: "A", kind: "requirement",
    title: { en: "A detailed course-by-course evaluation of your studies", es: "Una evaluación curso por curso de tus estudios", zh: "一份逐门课程的学历评估报告" },
    excerpt: "A detailed, course-by-course, foreign transcript evaluation is required any time foreign course work is used to meet any credential requirement, even if the foreign course work has been accepted by a college or university in the United States.",
    source_title: "CL-635, Foreign Transcript Evaluation", source_url: CL635,
    decider: CTC, discretion: false, hard: false,
    logic: {
      cases: [
        { when: noReport, state: "unknown", question: "q.have_evaluation" },
        { when: { fact: "evaluation.report_type", eq: "document_by_document" }, state: "missing", reason: "report_type_general", evidence: ["evaluation.report_type"] },
        { when: cbc, state: "satisfied", evidence: ["evaluation.report_type"] },
      ],
      otherwise: { state: "missing", reason: "report_type_other", evidence: ["evaluation.report_type"] },
    },
  },
  {
    ...base, id: "R02", phase: "A", kind: "requirement",
    title: { en: "The evaluation comes from an agency the CTC approves", es: "La evaluación viene de una agencia aprobada por la CTC", zh: "评估报告来自 CTC 认可的机构" },
    excerpt: "Foreign transcripts must be evaluated by one of the approved organizations provided in the list linked below in order to be accepted by the Commission.",
    source_title: "CL-635, Foreign Transcript Evaluation", source_url: CL635,
    decider: CTC, discretion: false, hard: false,
    logic: {
      cases: [
        { when: { fact: "evaluation.agency_status", exists: false }, state: "unknown", question: "q.have_evaluation" },
        { when: { fact: "evaluation.agency_status", eq: "not_listed" }, state: "missing", reason: "agency_not_on_list", evidence: ["evaluation.agency_name"] },
        { when: { fact: "evaluation.agency_status", eq: "closed_report_after_closure" }, state: "missing", reason: "agency_closed", evidence: ["evaluation.agency_name", "evaluation.report_date"] },
        { when: { fact: "evaluation.agency_status", in: ["listed", "closed_report_before_closure"] }, state: "satisfied", evidence: ["evaluation.agency_name"] },
      ],
      otherwise: { state: "unknown", question: "q.agency_name" },
    },
  },
  {
    ...base, id: "R03", phase: "A", kind: "informational",
    title: { en: "Approved agencies are NACES or AICE members", es: "Las agencias aprobadas son miembros de NACES o AICE", zh: "认可机构须为 NACES 或 AICE 成员" },
    excerpt: "to be listed as a Commission approved evaluator an evaluating agency must be a member of either the National Association of Credential Evaluation Services (NACES) or the Association of International Credential Evaluators, Inc. (AICE)",
    source_title: "Coded Correspondence 24-06", source_url: "https://www.ctc.ca.gov/docs/default-source/commission/coded/2024/coded-24-06.pdf",
    effective_on: "2024-10-01", decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
  },
  {
    ...base, id: "R04", phase: "A", kind: "requirement",
    title: { en: "A bachelor's degree from a school treated as equivalent to an accredited US one", es: "Una licenciatura de una institución equivalente a una acreditada en EE. UU.", zh: "学士学位，且学校被视为相当于美国认证院校" },
    excerpt: "Foreign transcript evaluation showing completion of a baccalaureate or higher degree from a college or university that has been deemed to be equivalent to a regionally-accredited institution in the United States.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: EVAL_THEN_CTC, discretion: true, hard: false,
    logic: {
      cases: [
        { when: { all: [cbc, { fact: "evaluation.us_equivalency_statement", exists: true }] }, state: "satisfied", evidence: ["evaluation.us_equivalency_statement"] },
        { when: { any: [{ fact: "degree.present", exists: true }, { fact: "transcript.present", exists: true }, { fact: "evaluation.present", exists: true }] }, state: "unknown", question: "q.equivalence_decided_by_agency", evidence: ["degree.title", "transcript.program_name", "evaluation.us_equivalency_statement"] },
      ],
      otherwise: { state: "unknown", question: "q.upload_degree" },
    },
  },
  {
    ...base, id: "R05", phase: "A", kind: "requirement",
    title: { en: "A preparation program in elementary education, including student teaching", es: "Formación como maestra de primaria, con práctica docente", zh: "小学教育专业培养，包括教育实习" },
    excerpt: "Foreign transcript evaluation showing completion of a professional preparation program in elementary education, including student teaching, taken at a college or university that has been deemed to be equivalent to a regionally-accredited institution in the United States.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: EVAL_THEN_CTC, discretion: true, hard: false,
    logic: {
      cases: [
        { when: { all: [cbc, { fact: "evaluation.mentions_student_teaching", eq: true }] }, state: "satisfied", evidence: ["evaluation.mentions_student_teaching", "transcript.practicum_courses"] },
        { when: { all: [{ fact: "transcript.present", exists: true }, { fact: "transcript.practicum_courses", exists: false }] }, state: "unknown", question: "q.practicum_evidence", evidence: ["transcript.program_name"] },
        { when: { all: [{ fact: "evaluation.report_type", exists: true }, { fact: "transcript.practicum_courses", exists: true }, { fact: "evaluation.lists_courses", eq: false }] }, state: "missing", reason: "evaluation_lists_no_courses", evidence: ["evaluation.report_type", "transcript.practicum_courses"] },
        { when: { all: [cbc, { fact: "transcript.practicum_courses", exists: true }] }, state: "missing", reason: "evaluation_omits_practicum", evidence: ["evaluation.mentions_student_teaching", "transcript.practicum_courses"] },
        { when: { all: [{ fact: "evaluation.report_type", exists: true }, { fact: "transcript.present", exists: false }] }, state: "unknown", question: "q.upload_transcript", evidence: ["evaluation.report_type"] },
        { when: { all: [noReport, { fact: "transcript.practicum_courses", exists: true }] }, state: "satisfied", evidence: ["transcript.practicum_courses"] },
      ],
      otherwise: { state: "unknown", question: "q.upload_transcript" },
    },
  },
  {
    ...base, id: "R06", phase: "A", kind: "requirement",
    title: { en: "A teaching license from the country where you trained", es: "Una licencia para enseñar del país donde estudiaste", zh: "你受训国家颁发的教师资格" },
    excerpt: "Issued or eligible for a comparable teaching credential earned in a country other than the United States. The credential does not have to be valid at the time of application. A photocopy of the credential is acceptable verification of this requirement.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: CTC, discretion: true, hard: false,
    logic: {
      cases: [
        { when: { fact: "license.present", exists: true }, state: "satisfied", evidence: ["license.profession_title"] },
        { when: { fact: "stated.has_foreign_license", eq: true }, state: "satisfied", evidence: ["stated.has_foreign_license"] },
        { when: { fact: "stated.has_foreign_license", eq: false }, state: "missing", reason: "no_foreign_license", evidence: ["stated.has_foreign_license"] },
      ],
      otherwise: { state: "unknown", question: "q.upload_license" },
    },
  },
  {
    ...base, id: "R07", phase: "A", kind: "requirement",
    title: { en: "The agency also sees your teaching license", es: "La agencia también ve tu licencia para enseñar", zh: "评估机构也要看到你的教师资格证" },
    excerpt: "Be sure that when you request your foreign transcript evaluation, you provide the agency with your out-of-country teaching credential as well.",
    source_title: "Multiple Subject checklist, prepared outside the US", source_url: CHECKLIST,
    decider: { en: "The evaluation agency", es: "La agencia evaluadora", zh: "评估机构" }, discretion: false, hard: false,
    logic: {
      cases: [
        { when: noReport, state: "unknown", question: "q.none" },
        { when: { fact: "evaluation.includes_license", eq: true }, state: "satisfied", evidence: ["evaluation.documents_reviewed"] },
      ],
      otherwise: { state: "missing", reason: "license_not_sent_to_agency", evidence: ["evaluation.documents_reviewed"] },
    },
  },
  {
    ...base, id: "R08", phase: "A", kind: "requirement", quiet: true,
    title: { en: "Original official documents for the agency", es: "Documentos originales y oficiales para la agencia", zh: "提交给评估机构的原件或官方文件" },
    excerpt: "In all instances, original, official documentation will be required when requesting the evaluation.",
    source_title: "CL-635, Foreign Transcript Evaluation", source_url: CL635,
    decider: { en: "The evaluation agency", es: "La agencia evaluadora", zh: "评估机构" }, discretion: true, hard: false,
    logic: { cases: [{ when: { fact: "stated.originals_available", eq: true }, state: "satisfied", evidence: ["stated.originals_available"] }], otherwise: { state: "unknown", question: "q.none" } },
  },
  {
    ...base, id: "R09", phase: "A", kind: "requirement",
    title: { en: "Fingerprints", es: "Huellas digitales", zh: "指纹" },
    excerpt: "Applicants Residing in California Live Scan Service (Form 41-LS): Fee Collected by Live Scan Operator. Applicants Residing Outside of California Fingerprint Cards (FD-258): $49.00",
    source_title: "CL-659, Fee schedule", source_url: CL659,
    decider: { en: "The California DOJ and the FBI, through the CTC", es: "El DOJ de California y el FBI, a través de la CTC", zh: "加州司法部和 FBI，经由 CTC" }, discretion: false, hard: false,
    logic: {
      cases: [
        { when: { fact: "fingerprints.done", eq: true }, state: "satisfied", evidence: ["fingerprints.done"] },
        { when: { fact: "stated.lives_in_california", eq: false }, state: "missing", reason: "fd258_cards", evidence: ["stated.lives_in_california"] },
      ],
      otherwise: { state: "missing", reason: "live_scan", evidence: ["stated.lives_in_california"] },
    },
  },
  {
    ...base, id: "R10", phase: "A", kind: "requirement", route_only: true,
    title: { en: "Apply through CTC Online and pay the fee", es: "Solicitar en CTC Online y pagar la cuota", zh: "通过 CTC Online 申请并缴费" },
    excerpt: "This is the basic nonrefundable application fee for all types of credentials ... $100.00",
    source_title: "CL-659, Fee schedule", source_url: CL659,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
    logic: {
      cases: [
        { when: { any: [{ fact: "ctc_letter.present", exists: true }, { fact: "stated.stage", eq: "applied_letter_received" }] }, state: "satisfied", evidence: ["ctc_letter.date"] },
      ],
      otherwise: { state: "missing", reason: "not_applied" },
    },
  },
  {
    ...base, id: "R11", phase: "A", kind: "requirement", quiet: true,
    title: { en: "A Social Security number or an ITIN", es: "Un número de Seguro Social o un ITIN", zh: "社会安全号码或 ITIN" },
    excerpt: "Pursuant to CA State Law, you must have a valid United States Social Security Number (SSN), or Individual Taxpayer Identification Number (ITIN) in order to obtain a valid teaching credential in the State of California.",
    source_title: "Fees and Fingerprinting", source_url: FEES,
    decider: { en: "The CTC, under California law", es: "La CTC, por ley de California", zh: "CTC，依据加州法律" }, discretion: false, hard: true,
    logic: {
      cases: [
        { when: { fact: "stated.has_ssn_or_itin", eq: "yes" }, state: "satisfied", evidence: ["stated.has_ssn_or_itin"] },
        { when: { fact: "stated.has_ssn_or_itin", eq: "no" }, state: "missing", reason: "no_ssn_or_itin", evidence: ["stated.has_ssn_or_itin"] },
      ],
      otherwise: { state: "unknown", question: "q.ssn_or_itin" },
    },
  },
  {
    ...base, id: "R12", phase: "A", kind: "requirement",
    title: { en: "Your preparation was for elementary teaching", es: "Tu formación fue para enseñar en primaria", zh: "你的培养方向是小学教学" },
    excerpt: "If grade and content area are not listed on your foreign transcript evaluation, then you can request the Multiple Subject credential if your preparation was for elementary teaching. The final determination of eligibility will be made when your application is reviewed.",
    source_title: "Multiple Subject checklist, prepared outside the US", source_url: CHECKLIST,
    decider: CTC, discretion: true, hard: false,
    logic: {
      cases: [
        { when: { fact: "program.is_elementary", eq: true }, state: "satisfied", evidence: ["transcript.program_name", "degree.title"] },
      ],
      otherwise: { state: "unknown", question: "q.none" },
    },
  },
  {
    ...base, id: "R13", phase: "A", kind: "requirement", quiet: true,
    title: { en: "An overall C average or better, as the evaluator converts it", es: "Un promedio general de C o más, según lo convierta la agencia", zh: "按评估机构换算，总平均成绩 C 或以上" },
    excerpt: "Individuals must have an overall grade point average of “C” or better on a five-point scale in all course work offered toward fulfillment of credential requirements.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: { en: "The evaluation agency", es: "La agencia evaluadora", zh: "评估机构" }, discretion: true, hard: false,
    logic: { cases: [{ when: { fact: "evaluation.converted_gpa_c_or_better", eq: true }, state: "satisfied", evidence: ["evaluation.converted_gpa_c_or_better"] }], otherwise: { state: "unknown", question: "q.none" } },
  },
  {
    ...base, id: "R14", phase: "A", kind: "requirement", quiet: true, route_only: true,
    title: { en: "Upload every page of the evaluation, front and back", es: "Subir todas las páginas de la evaluación, por ambos lados", zh: "上传评估报告的每一页，正反面" },
    excerpt: "Upload a scan of the original, official paper foreign transcript evaluation. Clear photographs will also be accepted. All pages, front and back, must be included in the upload.",
    source_title: "Multiple Subject checklist, prepared outside the US", source_url: CHECKLIST,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
    logic: { cases: [], otherwise: { state: "unknown", question: "q.none" } },
  },
  {
    ...base, id: "R15", phase: "A", kind: "requirement", quiet: true,
    title: { en: "Basic skills, usually met by the degree", es: "Habilidades básicas, que normalmente cubre la licenciatura", zh: "基本技能要求，通常由学位满足" },
    excerpt: "Most credentials require a bachelor’s or higher degree from a regionally accredited institution, so the majority of applicants will meet the Basic Skills Requirement through their degree",
    source_title: "CL-667, Basic Skills Requirement", source_url: "https://www.ctc.ca.gov/credentials/leaflets/cl-667/",
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: true, hard: false,
    logic: { cases: [], otherwise: { state: "unknown", question: "q.none" } },
  },
  {
    ...base, id: "R16", phase: "B", kind: "requirement",
    title: { en: "Reading, a course or a literacy assessment", es: "Lectura, un curso o un examen de lectoescritura", zh: "阅读教学，课程或读写能力考试" },
    excerpt: "Meet the literacy requirement by obtaining a passing score on one of the following: a Commission-approved Literacy Performance Assessment, the Reading Instruction Competence Assessment (RICA) (prior to October 31, 2025), or the Foundations of Reading Exam.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: true, hard: false,
    logic: { cases: [], otherwise: { state: "missing", reason: "clear_credential" } },
  },
  {
    ...base, id: "R17", phase: "B", kind: "requirement",
    title: { en: "US Constitution, a course or an exam", es: "Constitución de EE. UU., un curso o un examen", zh: "美国宪法，课程或考试" },
    excerpt: "Complete a course (at least two semester units or three quarter units) in the Provisions and Principles of the U.S. Constitution from a regionally accredited college or university ... Pass an examination in the Provisions and Principles of the U.S. Constitution given by a regionally-accredited college or university.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
    logic: { cases: [], otherwise: { state: "missing", reason: "clear_credential" } },
  },
  {
    ...base, id: "R18", phase: "B", kind: "requirement",
    title: { en: "Subject matter, usually the CSET Multiple Subjects exams", es: "Conocimiento de materias, normalmente los exámenes CSET", zh: "学科能力，通常是 CSET 多学科考试" },
    excerpt: "Achieve a passing score on the appropriate subject matter examination(s)",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
    logic: { cases: [], otherwise: { state: "missing", reason: "clear_credential" } },
  },
  {
    ...base, id: "R19", phase: "B", kind: "requirement",
    title: { en: "Induction and CPR", es: "Inducción y RCP", zh: "入职培训和心肺复苏" },
    excerpt: "Complete a Commission-approved Professional Teacher Induction Program ... Verification of training in cardiopulmonary resuscitation (CPR) that covers infant, child, and adult CPR skills is also required.",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: { en: "The program sponsor, then the CTC", es: "El programa y después la CTC", zh: "培训项目方，然后是 CTC" }, discretion: false, hard: false,
    logic: { cases: [], otherwise: { state: "missing", reason: "clear_credential" } },
  },
  {
    ...base, id: "R20", phase: "B", kind: "requirement",
    title: { en: "Five years to finish the clear credential", es: "Cinco años para completar la credencial definitiva", zh: "五年内完成正式教师证要求" },
    excerpt: "The preliminary credential is issued for a maximum of five years. If requirements for the clear credential are not completed before the expiration of the preliminary, the holder will be unable to teach in California’s public schools with that credential until those requirements are met",
    source_title: "CL-871, Multiple Subject Teaching Credential, prepared outside the US", source_url: CL871,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
    logic: { cases: [], otherwise: { state: "missing", reason: "clear_credential" } },
  },
  {
    ...base, id: "R21", phase: "C", kind: "requirement",
    title: { en: "Answer the CTC letter within 60 days, with the letter attached", es: "Responder la carta de la CTC en 60 días, adjuntando la carta", zh: "60 天内回复 CTC 的信，并附上该信" },
    excerpt: "You will have 60 days from the date the letter is mailed to provide the requested materials. Failure to submit the required materials within this 60-day timeframe will result in the expiration of your processing fee and you will be required to resubmit a complete application packet.",
    source_title: "Check Application Status", source_url: STATUS,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
    logic: {
      cases: [
        { when: { fact: "ctc_letter.date", exists: false }, state: "unknown", question: "q.none" },
        { when: { fact: "ctc_letter.responded", eq: true }, state: "satisfied", evidence: ["ctc_letter.date"] },
        { when: { fact: "ctc_letter.deadline_passed", eq: true }, state: "missing", reason: "deadline_passed", evidence: ["ctc_letter.date"] },
      ],
      otherwise: { state: "missing", reason: "respond_by", evidence: ["ctc_letter.date"] },
    },
  },
  {
    ...base, id: "P01", phase: "C", kind: "process",
    title: { en: "Online applications typically take up to 50 business days", es: "Las solicitudes en línea suelen tardar hasta 50 días hábiles", zh: "网上申请通常最多 50 个工作日" },
    excerpt: "Online applications submitted by employers or directly by the educator through their CTC Online account are typically processed within 50 business days, providing that no additional background or professional fitness review is required.",
    source_title: "Check Application Status", source_url: STATUS,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
  },
  {
    ...base, id: "P02", phase: "C", kind: "process",
    title: { en: "Two agencies closed. Reports from before they closed still count", es: "Dos agencias cerraron. Sus reportes anteriores al cierre siguen valiendo", zh: "两家机构已关闭，关闭前出具的报告仍有效" },
    excerpt: "AERC closed on August 30, 2025. Reports completed prior to this date are still acceptable.",
    source_title: "Approved Foreign Transcript Evaluating Agencies", source_url: LIST,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
  },
  {
    ...base, id: "P03", phase: "C", kind: "process",
    title: { en: "A general report is enough only for the 30-day substitute permit", es: "Un reporte general sirve solo para el permiso de suplente de 30 días", zh: "一般性报告只适用于 30 天代课许可" },
    excerpt: "The only exception to this is for those individuals applying for an Emergency 30-Day Substitute Permit, for which a general report is sufficient.",
    source_title: "CL-635, Foreign Transcript Evaluation", source_url: CL635,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
  },
  {
    ...base, id: "B01", phase: "C", kind: "bridge",
    title: { en: "A general report is enough for the 30-day substitute permit", es: "Un reporte general sirve para el permiso de suplente de 30 días", zh: "一般性报告可用于 30 天代课许可" },
    excerpt: "The only exception to this is for those individuals applying for an Emergency 30-Day Substitute Permit, for which a general report is sufficient.",
    source_title: "CL-635, Foreign Transcript Evaluation", source_url: CL635,
    decider: { en: "The CTC", es: "La CTC", zh: "CTC" }, discretion: false, hard: false,
  },
  {
    ...base, id: "B02", phase: "C", kind: "bridge",
    title: { en: "Day-to-day substituting, up to 30 days for one teacher, valid one year", es: "Suplencias día por día, hasta 30 días por maestro, válido un año", zh: "逐日代课，同一教师最多 30 天，有效期一年" },
    excerpt: "The holder may serve as a substitute for no more than 30 days for any one teacher during the school year",
    source_title: "CL-505P, Emergency 30-Day Substitute Teaching Permit", source_url: CL505P,
    decider: { en: "The CTC and the hiring district", es: "La CTC y el distrito que contrata", zh: "CTC 和聘用学区" }, discretion: false, hard: false,
  },
  {
    ...base, id: "B03", phase: "C", kind: "bridge",
    title: { en: "The employer keeps a Statement of Need on file", es: "El empleador guarda una Declaración de Necesidad", zh: "雇主需存档需求声明" },
    excerpt: "the employing agency must keep a completed Statement of Need form (CL-505a) on file at their office for the duration of the school year.",
    source_title: "CL-505P, Emergency 30-Day Substitute Teaching Permit", source_url: CL505P,
    decider: { en: "The hiring district", es: "El distrito que contrata", zh: "聘用学区" }, discretion: false, hard: false,
  },
];

export const ruleById = (id: string): Rule => {
  const r = rules.find((x) => x.id === id);
  if (!r) throw new Error(`unknown rule ${id}`);
  return r;
};

export const PRACTICUM_SYNONYMS = [
  "student teaching", "practicum", "práctica docente", "trabajo docente", "prácticas profesionales", "supervised teaching",
  "教育实习", "教学实习", "实习",
];

export const PRACTICUM_CORE = ["student teaching", "practicum", "trabajo docente", "supervised teaching", "prácticas profesionales", "教育实习", "教学实习"];

export const ELEMENTARY_WORDS = ["primaria", "primary", "elementary", "小学", "básica", "basica"];

export const LICENSE_WORDS = ["cédula", "cedula", "license", "licencia", "credential", "certificate of teaching", "teaching certificate", "教师资格"];

export const KNOWN_FEES_CENTS = { application: 10000, online_service: 265, fd258: 4900 } as const;
