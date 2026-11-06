# Bridge

Bridge helps women who trained abroad as teachers get licensed again in California. She messages Bridge on WhatsApp in her own language and shares the documents she already has. Bridge tells her what the state will accept, what is still missing, and the one thing to do this week. Often the gap turns out to be a missing letter, not years of new school.

## The problem

About one in four college-educated immigrants in the US works far below their education, and the rate is higher for women. The professions women dominate, teaching, nursing, early childhood and social work, are licensed, and licensing is where credentials get lost. Women also more often arrive as the dependent spouse, with no employer to handle the paperwork, and they carry the caregiving that rules out a two-year retraining route.

California has a direct path for teachers trained abroad. Most women find it only after an expensive mistake.

- **The wrong report.** The state requires a detailed course-by-course evaluation. Agencies also sell a cheaper general report, which gets rejected.
- **A paperwork gap mistaken for a training gap.** Mexican and Chinese teaching degrees include student teaching under names US evaluators do not recognize. She is told she needs more school when she only needs a letter from her university.

## What we built

- **WhatsApp intake** in English, Spanish or Chinese that learns her situation from her own words
- **Document reading** from a phone photo or PDF, with every extracted line shown next to the page it came from
- **21 state requirements** encoded as rules, each quoting the official sentence and naming who decides
- **A clear answer** in three lists, what she has, what is missing, and what cannot be known yet
- **One action for this week**, with the letter already drafted for her to send
- **One case across WhatsApp and the web**, so the conversation stays on her phone and the paperwork happens on a real page

## How we built it

- **One pathway, done completely.** A complete answer for one route is worth more than a vague answer for fifty. Other professions and states still get the office that decides and a drafted first question.
- **WhatsApp first.** It is where she already sends photos of documents. Nothing to install, nothing to log into.
- **Claude reads, code decides.** Claude extracts and explains. Whether a requirement is met is decided by code from cited rules. Bridge never tells her she is eligible.
- **Not knowing is an answer.** When her documents cannot settle a requirement, Bridge says so and drafts the question for the state.
- **Nothing happens without her.** Bridge drafts. It never pays, submits or contacts an office in her name, and never asks about immigration status.

## What she experiences

Mariana taught primary school in Guadalajara for ten years. She applied in California and got a letter back she does not understand.

1. She taps **Message us on WhatsApp** on the Bridge page and is welcomed in her language.
2. She tells her story in one message. Bridge explains how it will help and sends a link to start.
3. She uploads her documents one at a time. Each request explains what the document is and shows an example.
4. She sees where she stands. Her report is the wrong type, and her transcript already shows her student teaching. What is missing is paperwork, not school.
5. She gets one action for this week with the letter written and the deadline counted.
6. Any line opens to the official sentence behind it and who decides.
7. Back on WhatsApp she asks questions about her case, jobs that fit her now, or her resume, and gets answers from her own file.

## Tech stack

Next.js 15, React 19 and TypeScript. Prisma with SQLite. Claude through the Anthropic API with Zod-validated structured outputs. Twilio WhatsApp through a signed webhook. D3 for the landing page globe. Vitest and Playwright for tests.

## Architecture

```
WhatsApp ─> Twilio ─> webhook ──┐
                                ├─> agent ─> intake (Claude) ─> router ─> pathway
Website  ─> case API ───────────┘     ├──> document reader (Claude) ─> facts
                                      └──> rule engine (code) ─> where she stands, this week, letters
```

- **One case core.** WhatsApp and the website call the same functions and share one conversation.
- **Reader.** Claude turns each upload into typed facts with the original text and page. Instructions printed inside a document are ignored.
- **Rules.** `rules/ctc-ms-foreign.ts` holds the requirements with quoted sources. A pure function evaluates them.
- **Guards.** Release tests block eligibility claims and banned wording in every string, in all three languages.

## Run it

```
pnpm install
cp .env.example .env
pnpm db:push
pnpm build && pnpm start
pnpm gate:v1
```

Add `ANTHROPIC_API_KEY` to `.env` for live reading, or set `MODEL_PROVIDER=mock` to run on the fixtures. The landing page is at `/landing.html`. All documents in `fixtures/` are synthetic.
