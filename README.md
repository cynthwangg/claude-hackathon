# Bridge

Bridge helps women who trained abroad as teachers get licensed again in California.

She texts Bridge on WhatsApp, in English, Spanish or Chinese, and sends photos of the documents she already has. Bridge reads them and tells her what the state will accept, what is still missing, and **the one thing to do this week**.

Often the gap is **a missing letter, not years of new school**.

## Why this matters

About **one in four college-educated immigrants** in the US works in a job far below their education. For women it is worse.

Women dominate teaching, nursing, early childhood and social work. These jobs need a state license, and **licensing is where foreign credentials get lost**. Many women also arrive as the dependent spouse. There is no employer to handle the paperwork, and with children at home a two-year retraining program is not realistic.

California has a direct path for teachers trained abroad. Most women only find it after an expensive mistake.

- They buy **the wrong report**. The state needs a detailed course-by-course evaluation. Agencies also sell a cheaper general one, and the state sends it back.
- They are told they **need more school when they don't**. Mexican and Chinese teaching degrees include student teaching, but under names a US evaluator does not recognize. What is missing is a letter from her university.

## What it does

1. Learns her situation from one message in her own words
2. Reads each document from a phone photo and shows exactly what it found, line by line
3. Checks her case against **21 requirements taken word for word from the state's own pages**
4. Shows what she has, what is missing, and what nobody can know yet
5. Gives her one action for the week, with the letter already written
6. Keeps one case across WhatsApp and the web, so she can talk on her phone and handle paperwork on a bigger screen

## How we decided to build it

- Claude reads her documents and explains the results, but **plain code decides whether each requirement is met**, from cited rules. Bridge never tells her she is eligible.
- We built **one route completely** instead of fifty vaguely. Nurses, social workers and other states still get the office that decides and a first question to ask.
- We started on **WhatsApp** because it is where she already sends photos of documents. There is nothing to install and no account to make.
- When her documents cannot answer something, Bridge **says it does not know** and writes the question for the state.
- Bridge only drafts. It never pays, submits or contacts anyone for her, and it never asks about immigration status.

## Her experience

Mariana taught primary school in Guadalajara for ten years. She applied in California and got a letter back that she does not understand.

1. She taps Message us on WhatsApp on the Bridge page
2. She tells her story in one message and gets a link to start
3. She uploads her documents one at a time, and each request explains what the document is
4. She learns her report is the wrong type, and that **her transcript already shows her student teaching**
5. She gets one task for the week, with the letter written and the deadline counted
6. She taps any line to see the official sentence behind it
7. She keeps asking questions on WhatsApp, about her case, jobs she could do now, or her resume

## Tech

| | |
| --- | --- |
| App | Next.js 15, React 19, TypeScript |
| Data | Prisma and SQLite |
| AI | Claude via the Anthropic API, structured outputs checked with Zod |
| Messaging | Twilio WhatsApp |
| Tests | Vitest and Playwright |

```
WhatsApp ─> Twilio ─> webhook ──┐
                                ├─> agent ─> intake (Claude) ─> router ─> pathway
Website  ─> case API ───────────┘     ├──> document reader (Claude) ─> facts
                                      └──> rule engine (code) ─> where she stands, this week, letters
```

WhatsApp and the website share one case and one conversation. Rules live in `rules/ctc-ms-foreign.ts`, each with its source quote. Release tests block any eligibility claim, in all three languages.

## Run it

```
pnpm install
cp .env.example .env
pnpm db:push
pnpm build && pnpm start
```

Add `ANTHROPIC_API_KEY` to `.env`, or set `MODEL_PROVIDER=mock` to run without one. Start at `/landing.html`. Sample documents are in `demo-documents/`, and every document in the repo is synthetic.
