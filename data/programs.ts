import type { L10n } from "@/rules/types";

/**
 * Section 30. Public curricula, not anyone's case. Every graduate of a national program in a plan year took the same
 * courses. A row never overrides her documents or the office. `verified: false` rows may not carry a hard rule.
 */
export type Program = {
  id: string;
  country: string;
  institution_type: string;
  institution_match: string[];
  program_names: string[];
  plan_match: string[];
  years_in_force: [number, number];
  degree_level: "bachelor" | "associate" | "unknown";
  length_years: number;
  short: L10n;
  source: { title: string; url: string; retrieved_on: string; verified: boolean; note?: string };
  satisfies: {
    rule_id: string;
    fact_key: string;
    expected_courses: { name: string; semester?: number; note?: string }[];
    transcript_pattern: string;
    grading_note?: string;
    school_letter: { issuing_office: string; signer: string; must_state: ("school" | "weeks" | "hours" | "supervisor")[] };
  }[];
};

export const PROGRAMS: Program[] = [
  {
    id: "mx_sep_lep_1997",
    country: "MX",
    institution_type: "escuela_normal",
    institution_match: ["escuela normal", "normal de", "normal superior", "benemerita escuela normal"],
    program_names: ["licenciatura en educacion primaria"],
    plan_match: ["1997", "plan 1997"],
    years_in_force: [1997, 2012],
    degree_level: "bachelor",
    length_years: 4,
    short: { en: "Normal schools in Mexico on Plan 1997", es: "las Normales de México con el Plan 1997", zh: "墨西哥师范学校 1997 年培养方案" },
    source: {
      title: "SEP, Plan de Estudios 1997, Licenciatura en Educación Primaria",
      url: "https://www.gob.mx/sep",
      retrieved_on: "2026-11-05",
      verified: false,
      note: "The plan document itself was not located on SEP or DGESuM sites. Unverified, as in spec.md section 24.",
    },
    satisfies: [
      {
        rule_id: "R05",
        fact_key: "transcript.practicum_courses",
        expected_courses: [
          { name: "Trabajo Docente I", semester: 7 },
          { name: "Trabajo Docente II", semester: 8 },
        ],
        transcript_pattern: "TRABAJO DOCENTE I, TRABAJO DOCENTE II, in the course list for the last two semesters",
        grading_note: "numeric 5 to 10",
        school_letter: {
          issuing_office: "Dirección de Servicios Escolares",
          signer: "the director of the Normal",
          must_state: ["school", "weeks", "hours"],
        },
      },
    ],
  },
  {
    id: "cn_moe_teacher_ed_2011",
    country: "CN",
    institution_type: "normal_university",
    institution_match: ["师范"],
    program_names: ["小学教育", "师范", "学科教学"],
    plan_match: [],
    years_in_force: [2011, 2026],
    degree_level: "bachelor",
    length_years: 4,
    short: { en: "teacher education at normal universities in China", es: "la formación docente en universidades normales de China", zh: "中国师范院校的教师教育专业" },
    source: {
      title: "Ministry of Education, 教师教育课程标准（试行）, 教师〔2011〕6号",
      url: "http://www.moe.gov.cn/",
      retrieved_on: "2026-11-05",
      verified: false,
      note: "The notice text was not retrieved. No number of weeks is shown until it is.",
    },
    satisfies: [
      {
        rule_id: "R05",
        fact_key: "transcript.practicum_courses",
        expected_courses: [{ name: "教育实习" }],
        transcript_pattern: "教育实习 on one line, graded 合格",
        grading_note: "合格 pass, no hours printed",
        school_letter: {
          issuing_office: "教务处",
          signer: "the 教务处 office",
          must_state: ["school", "weeks", "hours", "supervisor"],
        },
      },
    ],
  },
];

export const programById = (id: string | null | undefined) => PROGRAMS.find((p) => p.id === id) ?? null;
