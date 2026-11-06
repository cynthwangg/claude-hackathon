"""
Earned over WhatsApp (Twilio sandbox), Flask stand-in.

Mirrors the web app's conversation on branch version-0:
  - open opener, no menu: whatever she writes, in any language, is the start
  - Claude runs the intake (port of lib/model/anthropic.ts intakeTurn): reads
    everything she said, fills the intake, asks ONE missing thing at a time
    with a short reason, never advises, never talks about eligibility
  - when the required fields are known, deterministic code (port of
    lib/intake/router.ts + data/pathways.ts + data/authorities.ts) names the
    office that decides, gives the orientation, and asks for the first document
  - copy comes from locales/{en,es,zh}.json on version-0

It does not read documents, run the rule engine or share the web case. The
real implementation is app/api/channels/whatsapp on version-0.

Run:  pip install flask twilio anthropic
      TWILIO_AUTH_TOKEN=... PUBLIC_WEBHOOK_URL=https://<ngrok>/whatsapp \
        PORT=5001 python whatsapp_twilio_server.py
      ngrok http 5001   -> sandbox "When a message comes in": <ngrok>/whatsapp
Anthropic credentials come from the environment or the SDK's credentials file.
"""

import json
import os
import re
import threading

import anthropic
from flask import Flask, abort, request
from twilio.base.exceptions import TwilioRestException
from twilio.request_validator import RequestValidator
from twilio.rest import Client as TwilioClient
from twilio.twiml.messaging_response import MessagingResponse

app = Flask(__name__)

# ---------------------------------------------------------------- security
# Twilio signs every webhook with your auth token (X-Twilio-Signature).
# The signature covers the exact public URL configured in the sandbox, so it
# is read from PUBLIC_WEBHOOK_URL, never from the request's Host header.
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
PUBLIC_WEBHOOK_URL = os.environ.get("PUBLIC_WEBHOOK_URL")
# Only for local curl tests. Never set this while ngrok is running.
ALLOW_UNSIGNED = os.environ.get("ALLOW_UNSIGNED") == "1"


def verify_twilio_request():
    if ALLOW_UNSIGNED:
        return
    if not (TWILIO_AUTH_TOKEN and PUBLIC_WEBHOOK_URL):
        abort(403)  # refuse rather than run unprotected
    validator = RequestValidator(TWILIO_AUTH_TOKEN)
    signature = request.headers.get("X-Twilio-Signature", "")
    if not validator.validate(PUBLIC_WEBHOOK_URL, request.form.to_dict(), signature):
        abort(403)


# ---------------------------------------------------------------- copy
# From locales/*.json on version-0. "wa.no_reading" is new for this stand-in.
COPY = {
    "en": {
        "office.title": "The office that decides",
        "office.unknown_state": "Tell me which state you live in and I will name the office that decides.",
        "docs.first": "First, {noun}.",
        "wa.send_photo": "Send a photo or a PDF of it here.",
        "wa.voice_declined": "I can't listen to voice notes yet. Write me the answer and I'll read it.",
        "wa.unsupported": "I can't read that. Send me a photo or a PDF of the document.",
        "wa.no_reading": "I have your file. Reading documents over WhatsApp is not connected in this version yet, so I have not read it. Tell me in words what it is and I will note it.",
        "error.generic": "Something went wrong on our side. What you wrote is saved. Try again.",
        "noun.ctc_letter": "the CTC letter", "noun.evaluation_report": "the evaluation",
        "noun.transcript": "your transcript", "noun.degree": "your degree",
        "noun.license": "your teaching license", "noun.license_generic": "your license",
        "noun.experience": "proof of your experience",
        "ask.ctc_letter.looks": "A letter from the Commission, often titled Returned or Deficiency, with numbered items.",
        "ask.evaluation_report.looks": "A report from an evaluation agency with a US equivalency line and a report type.",
        "ask.transcript.looks": "The official list of your courses and grades from your school.",
        "ask.degree.looks": "Your diploma or degree certificate.",
        "ask.license.looks": "The license or certificate that let you work at home.",
        "ask.experience.looks": "A letter from your employer or education office about your years of work.",
    },
    "es": {
        "office.title": "La oficina que decide",
        "office.unknown_state": "Dime en qué estado vives y te digo qué oficina decide.",
        "docs.first": "Primero, {noun}.",
        "wa.send_photo": "Mándame aquí una foto o un PDF.",
        "wa.voice_declined": "Todavía no puedo escuchar notas de voz. Escríbeme la respuesta y la leo.",
        "wa.unsupported": "Eso no lo puedo leer. Mándame una foto o un PDF del documento.",
        "wa.no_reading": "Tengo tu archivo. Leer documentos por WhatsApp todavía no está conectado en esta versión, así que no lo he leído. Dime con palabras qué es y lo anoto.",
        "error.generic": "Algo falló de nuestro lado. Lo que escribiste está guardado. Inténtalo otra vez.",
        "noun.ctc_letter": "la carta de la CTC", "noun.evaluation_report": "la evaluación",
        "noun.transcript": "tu certificado de estudios", "noun.degree": "tu título",
        "noun.license": "tu cédula o licencia para enseñar", "noun.license_generic": "tu licencia",
        "noun.experience": "tu constancia de servicio",
        "ask.ctc_letter.looks": "Una carta de la Comisión, muchas veces titulada Returned o Deficiency, con puntos numerados.",
        "ask.evaluation_report.looks": "Un reporte de una agencia evaluadora con una línea de equivalencia en EE. UU. y un tipo de reporte.",
        "ask.transcript.looks": "La lista oficial de tus materias y calificaciones de tu escuela.",
        "ask.degree.looks": "Tu título.",
        "ask.license.looks": "La cédula o licencia que te permitía trabajar en tu país.",
        "ask.experience.looks": "Una constancia de tu empleo o de la secretaría de educación.",
    },
    "zh": {
        "office.title": "负责决定的机构",
        "office.unknown_state": "告诉我你住在哪个州，我来指出负责决定的机构。",
        "docs.first": "首先，{noun}。",
        "wa.send_photo": "请在这里发一张照片或 PDF。",
        "wa.voice_declined": "我现在还听不了语音。请把回答打字发给我。",
        "wa.unsupported": "这个我读不了。请发文件的照片或 PDF。",
        "wa.no_reading": "我收到你的文件了。这个版本还不能在 WhatsApp 上读取文件，所以我还没有读。请用文字告诉我这是什么文件，我会记下来。",
        "error.generic": "我们这边出了问题。你写的内容已保存。请再试一次。",
        "noun.ctc_letter": "CTC 的来信", "noun.evaluation_report": "评估报告",
        "noun.transcript": "你的成绩单", "noun.degree": "你的毕业证和学位证",
        "noun.license": "你的教师资格证", "noun.license_generic": "你的执照",
        "noun.experience": "你的工作证明",
        # ask.ctc_letter.looks / ask.evaluation_report.looks are absent in zh.json
        "ask.transcript.looks": "学校教务处出具的成绩单，列出每门课程和成绩。",
        "ask.degree.looks": "毕业证书和学位证书。在中国这是两份文件，评估机构通常两份都要。",
        "ask.license.looks": "让你在国内任教的教师资格证。",
        "ask.experience.looks": "学校或教育局出具的工作证明。",
    },
}


def t(lang: str, key: str, **kw) -> str:
    s = COPY.get(lang, {}).get(key)
    if s is None:
        s = COPY["en"].get(key, "")
    return s.format(**kw)


# ---------------------------------------------------------------- routing
# data/authorities.ts
AUTHORITIES = [
    ("teacher", "CA", "Commission on Teacher Credentialing (CTC)", "https://www.ctc.ca.gov/"),
    ("nurse", "CA", "California Board of Registered Nursing", "https://www.rn.ca.gov/"),
    ("engineer", "CA", "Board for Professional Engineers, Land Surveyors, and Geologists", "https://www.bpelsg.ca.gov/"),
    ("architect", "CA", "California Architects Board", "https://www.cab.ca.gov/"),
    ("nurse", "TX", "Texas Board of Nursing", "https://www.bon.texas.gov/"),
    ("teacher", "TX", "Texas Education Agency, Educator Certification", "https://tea.texas.gov/"),
    ("teacher", "NY", "New York State Education Department, Office of Teaching Initiatives", "https://www.highered.nysed.gov/tcert/"),
    ("nurse", "NY", "New York State Education Department, Office of the Professions", "https://www.op.nysed.gov/"),
]

# data/pathways.ts orientation text
ORIENTATION = {
    "ca_elementary": {
        "en": "In California, teachers are licensed by the Commission on Teacher Credentialing, the CTC. For someone trained outside the US, the route starts with a report on your studies written by an agency the CTC approves, and it has to be the detailed kind, course by course. With that report, your teaching license from home and fingerprints, you apply to the CTC for a preliminary credential. The step most people lose money on is ordering the wrong kind of report.",
        "es": "En California, a las maestras las acredita la Comisión de Acreditación Docente, la CTC. Para quien estudió fuera de Estados Unidos, la ruta empieza con un reporte sobre tus estudios hecho por una agencia que la CTC aprueba, y tiene que ser del tipo detallado, curso por curso. Con ese reporte, tu licencia de tu país y tus huellas, solicitas a la CTC una credencial preliminar. El paso en el que más gente pierde dinero es pedir el tipo de reporte equivocado.",
        "zh": "在加州，教师执照由教师资格认证委员会（CTC）颁发。在美国以外受训的人，第一步是请 CTC 认可的机构出具一份关于你学历的报告，而且必须是逐门课程的详细报告。有了这份报告、你本国的教师资格证和指纹，就可以向 CTC 申请初级教师证。大多数人损失钱的地方，是订错了报告类型。",
    },
    "ca_secondary": {
        "en": "In California, teachers are licensed by the Commission on Teacher Credentialing, the CTC. Secondary teachers apply for a Single Subject credential, and the first steps are the same as for elementary. A course-by-course report from a CTC-approved agency, your teaching license from home, fingerprints. We have mapped the elementary route in full; for Single Subject we know the shared steps and the leaflet (CL-870), not every rule. Where we are unsure we say so and write the question for the CTC.",
        "es": "En California, a los maestros los acredita la Comisión de Acreditación Docente, la CTC. Quien enseña secundaria solicita una credencial Single Subject, y los primeros pasos son los mismos que en primaria. Un reporte curso por curso de una agencia aprobada, tu licencia de tu país, huellas. Tenemos la ruta de primaria completa; de Single Subject conocemos los pasos compartidos y el folleto (CL-870), no cada regla. Donde no estemos seguras lo diremos y escribiremos la pregunta para la CTC.",
        "zh": "在加州，教师执照由教师资格认证委员会（CTC）颁发。中学教师申请的是单科（Single Subject）教师证，前几步与小学相同。CTC 认可机构的逐门课程报告、你本国的教师资格证、指纹。我们把小学路线完整梳理过；单科路线我们了解共同步骤和官方说明（CL-870），但不是每一条规则。不确定的地方我们会明说，并替你写好给 CTC 的问题。",
    },
    "general": {
        "en": "We have not mapped this route in detail, so we will not guess at rules. What we can do is read every document you have and tell you exactly what it says, name the office that decides in your state, and write your first question to them. Their answer is what counts.",
        "es": "No tenemos esta ruta mapeada en detalle, así que no vamos a adivinar reglas. Lo que sí podemos hacer es leer cada documento que tengas y decirte exactamente qué dice, nombrar la oficina que decide en tu estado y escribir tu primera pregunta para ellos. Lo que cuenta es su respuesta.",
        "zh": "这条路线我们还没有详细梳理，所以不会去猜规则。我们能做的是读你手上的每一份文件并如实告诉你上面写了什么，指出你所在州负责决定的机构，并替你写好给他们的第一个问题。算数的是那个机构的答复。",
    },
}


def route(intake: dict) -> str:
    """lib/intake/router.ts. Never defaults a missing state to California."""
    if not intake.get("us_state"):
        return "none"
    if intake.get("profession") == "teacher" and intake["us_state"] == "CA":
        if intake.get("level") in ("elementary", None):
            return "match"
        if intake.get("level") == "secondary":
            return "near"
    return "none"


def request_order(intake: dict, kind: str) -> list:
    order = []
    if kind != "none" and intake.get("stage") == "applied_letter_received":
        order.append("ctc_letter")
    if intake.get("stage") in ("evaluation_in_hand", "applied_letter_received"):
        order.append("evaluation_report")
    return order + ["transcript", "degree", "license", "experience"]


def find_authority(intake: dict):
    for prof, state, name, url in AUTHORITIES:
        if prof == intake.get("profession") and state == intake.get("us_state"):
            return name, url
    return None


def orientation_messages(lang: str, intake: dict) -> list:
    """lib/whatsapp.ts handleText when intake is done: office, orientation, first ask."""
    kind = route(intake)
    auth = find_authority(intake)
    office = (f"{t(lang, 'office.title')} · {auth[0]} · {auth[1]}" if auth
              else t(lang, "office.unknown_state"))
    key = {"match": "ca_elementary", "near": "ca_secondary"}.get(kind, "general")
    orientation = ORIENTATION[key].get(lang, ORIENTATION[key]["en"])
    first = request_order(intake, kind)[0]
    noun_key = "noun.license_generic" if first == "license" and kind == "none" else f"noun.{first}"
    looks = COPY.get(lang, {}).get(f"ask.{first}.looks", "")  # omitted when not translated
    ask = " ".join(x for x in (t(lang, "docs.first", noun=t(lang, noun_key)), looks,
                               t(lang, "wa.send_photo")) if x)
    return [office, orientation, ask]


# ---------------------------------------------------------------- intake
# lib/intake/types.ts
PROFESSIONS = ["teacher", "early_childhood_educator", "nurse", "physician", "pharmacist", "dentist",
               "engineer", "architect", "social_worker", "psychologist", "accountant", "lawyer",
               "physical_therapist", "other"]
STAGES = ["not_started", "about_to_pay_agency", "evaluation_in_hand", "applied_letter_received"]
HOLDS = ["transcript", "degree", "license", "evaluation_report", "ctc_letter", "experience"]
LEVELS = ["early_childhood", "elementary", "secondary", "university", "not_applicable"]
REQUIRED = ["profession", "country_of_training", "us_state", "has_foreign_license", "stage"]


def nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


INTAKE_SCHEMA = {
    "type": "object",
    "properties": {
        "first_name": nullable({"type": "string"}),
        "language": nullable({"type": "string", "enum": ["en", "es", "zh"]}),
        "profession": nullable({"type": "string", "enum": PROFESSIONS}),
        "profession_words": nullable({"type": "string", "description": "How she named her profession, in her own words"}),
        "level": nullable({"type": "string", "enum": LEVELS}),
        "country_of_training": nullable({"type": "string", "description": "Country name in English"}),
        "years_experience": nullable({"type": "number"}),
        "holds": {"type": "array", "items": {"type": "string", "enum": HOLDS}},
        "has_foreign_license": nullable({"type": "boolean"}),
        "stage": nullable({"type": "string", "enum": STAGES}),
        "us_state": nullable({"type": "string", "description": "Two-letter US state code where she lives now"}),
        "city": nullable({"type": "string"}),
        "worry": nullable({"type": "string"}),
    },
}
INTAKE_SCHEMA["required"] = list(INTAKE_SCHEMA["properties"])
INTAKE_SCHEMA["additionalProperties"] = False

# Structured output, same shape as the web: { say, intake }
REPLY_SCHEMA = {
    "type": "object",
    "properties": {"say": {"type": "string"}, "intake": INTAKE_SCHEMA},
    "required": ["say", "intake"],
    "additionalProperties": False,
}

LANG_NAME = {
    "en": "English",
    "es": "Spanish, addressing her as tú, feminine forms",
    "zh": "Simplified Chinese, addressing her as 你",
}
STYLE = ('Write like a competent person who has read her file. Short sentences. No colons in running text, '
         'no exclamation marks, no em dashes, no emoji. Never write "Great", "Let\'s", "Simply", "Just", "Welcome back".')
WA_STYLE = "This is WhatsApp. Keep say under 60 words, plain text, no markdown."


def intake_system(lang: str, intake: dict, missing: list) -> str:
    # Port of intakeTurn's system prompt in lib/model/anthropic.ts
    return f"""You run the first conversation of Earned, a guide for women whose degree, license and work history were earned in another country.

Your only job is to learn her situation and fill the intake object. She may write in any language and mention anything. Read everything she says and fill every field it supports. Never ask for something she already said.

Fields still missing, in priority order: {", ".join(missing) or "none"}.
Ask about one missing field at a time, in one or two short sentences, and say in a few words why it matters (for example, the state decides which office reviews her case). If nothing is missing, say one sentence that confirms what you understood.

Rules you never break.
- Give no advice and no next steps. Make no statement about eligibility, qualifying, approval, chances or timelines. If she asks whether she qualifies, answer that you will look at it together once you can see her documents, then ask your question.
- Do not invent facts. Leave a field null unless she said it.
- stage is applied_letter_received if she applied and got a letter back, about_to_pay_agency if she is about to pay for a credential evaluation, evaluation_in_hand if she already has an evaluation report, otherwise not_started once she says she has not started.
- us_state is where she lives now, as a two-letter code. A city implies its state only when unambiguous.
- has_foreign_license is whether she holds a license or certificate to practice from the country where she trained.
- holds lists documents she says she has in hand.
- If her message is only a greeting, greet her in one sentence and ask her to tell you where she is, in her own words, in any language.

Write say in {LANG_NAME[lang]}. {STYLE} {WA_STYLE}

The intake so far, as JSON: {json.dumps(intake, ensure_ascii=False)}"""


def empty_intake() -> dict:
    return {k: ([] if k == "holds" else None) for k in INTAKE_SCHEMA["properties"]}


def merge_intake(prev: dict, new: dict) -> dict:
    """mergeIntake: facts she already gave are never erased; unknown keys and
    off-enum values from the model are dropped (prompt-injection guard)."""
    allowed = {"profession": PROFESSIONS, "stage": STAGES, "level": LEVELS, "language": ["en", "es", "zh"]}
    out = dict(prev)
    for k, v in (new or {}).items():
        if k not in out:
            continue
        if k == "holds":
            out["holds"] = sorted(set(prev["holds"]) | {h for h in (v or []) if h in HOLDS})
        elif v not in (None, ""):
            if k in allowed and v not in allowed[k]:
                continue
            out[k] = v
    if isinstance(out.get("us_state"), str):
        out["us_state"] = out["us_state"].upper()[:2]
    return out


def missing_required(intake: dict) -> list:
    return [k for k in REQUIRED if intake.get(k) is None]


def guess_lang(text: str) -> str:
    """lib/whatsapp.ts guessLang."""
    if re.search(r"[一-鿿]", text):
        return "zh"
    if re.search(r"[ñáéíóú¿¡]|\b(hola|soy|maestra|tengo|vivo|estudi[eé]|años|carta)\b", text, re.I):
        return "es"
    return "en"


# Release-blocker phrases from the spec (section 19, D16): claims about her.
# "whether you qualify" / "si eres elegible" are questions, not claims, so the
# lookbehinds let them through.
_NOT_AFTER = r"(?<!whether )(?<!if )(?<!si )"
BLOCKED = re.compile(_NOT_AFTER + r"\b(eres|you are|you're|you will be) (elegible|eligible)\b|"
                     + _NOT_AFTER + r"\byou qualify\b|" + _NOT_AFTER + r"\bcalificas\b|"
                     r"\bguaranteed\b|\bwill be accepted\b|\bte van a aceptar\b", re.I)

# Fixed fallback questions, used only if the model's reply is blocked.
ASK_FIELD = {
    "en": {"profession": "What work did you do before you moved? It decides which office reviews your case.",
           "country_of_training": "In which country did you study and train? It tells us which documents to expect.",
           "us_state": "Which US state do you live in now? The state decides which office reviews your case.",
           "has_foreign_license": "Do you hold a license or certificate to practice from the country where you trained?",
           "stage": "Have you started anything here yet, like an evaluation or an application?"},
    "es": {"profession": "¿En qué trabajabas antes de mudarte? Eso decide qué oficina revisa tu caso.",
           "country_of_training": "¿En qué país estudiaste? Así sé qué documentos esperar.",
           "us_state": "¿En qué estado vives ahora? El estado decide qué oficina revisa tu caso.",
           "has_foreign_license": "¿Tienes una cédula o licencia para ejercer del país donde estudiaste?",
           "stage": "¿Ya empezaste algo aquí, como una evaluación o una solicitud?"},
    "zh": {"profession": "你搬来之前做什么工作？这决定由哪个部门审核你的情况。",
           "country_of_training": "你是在哪个国家读书和受训的？这样我知道会有哪些文件。",
           "us_state": "你现在住在美国哪个州？州决定由哪个部门审核你的情况。",
           "has_foreign_license": "你有在受训国家执业的执照或资格证吗？",
           "stage": "你在这里已经开始办什么了吗，比如学历评估或申请？"},
}


def clean(text: str) -> str:
    """Copy rules as a safety net: no em/en dashes, no exclamation marks."""
    text = text.replace("—", ", ").replace("–", ", ").replace("!", ".").replace("¡", "")
    return re.sub(r", {2,}", ", ", re.sub(r"\s+,", ",", text)).strip()


# ---------------------------------------------------------------- state
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
claude = anthropic.Anthropic(timeout=12.0, max_retries=0)  # Twilio gives up after ~15s

# Per phone number. In memory: restarting the server forgets everyone.
cases = {}
seen_sids = set()
lock = threading.Lock()


def new_case(first_text: str) -> dict:
    return {"lang": guess_lang(first_text), "intake": empty_intake(), "history": [], "oriented": False}


def intake_turn(case: dict, text: str) -> list:
    case["history"].append({"role": "user", "content": text})
    missing = missing_required(case["intake"])
    resp = claude.messages.create(
        model=MODEL,
        max_tokens=1500,
        system=intake_system(case["lang"], case["intake"], missing),
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": REPLY_SCHEMA}},
        messages=case["history"][-16:],
    )
    out = json.loads("".join(b.text for b in resp.content if b.type == "text"))
    case["intake"] = merge_intake(case["intake"], out.get("intake", {}))
    if case["intake"].get("language") in COPY:
        case["lang"] = case["intake"]["language"]
    say = clean(out.get("say", ""))
    if BLOCKED.search(say):
        app.logger.warning("blocked eligibility phrasing: %r", say)
        say = ""

    lang = case["lang"]
    still_missing = missing_required(case["intake"])
    if still_missing:
        out_msgs = [say or ASK_FIELD.get(lang, ASK_FIELD["en"])[still_missing[0]]]
    elif not case["oriented"]:
        case["oriented"] = True
        out_msgs = orientation_messages(lang, case["intake"])
    else:
        # Already oriented: confirm what changed and repeat the current ask.
        out_msgs = [m for m in (say, orientation_messages(lang, case["intake"])[2]) if m]
    case["history"].append({"role": "assistant", "content": "\n\n".join(out_msgs)})
    return out_msgs


def handle_inbound(form: dict) -> list:
    sender = form.get("From", "")
    body = (form.get("Body") or "").strip()
    sid = form.get("MessageSid")
    n_media = int(form.get("NumMedia") or 0)
    if not re.fullmatch(r"whatsapp:\+\d{6,16}", sender):
        return []
    with lock:
        if sid and sid in seen_sids:  # Twilio retry
            return []
        if sid:
            seen_sids.add(sid)
        if body.lower() in ("reset", "start over", "empezar de nuevo", "重新开始"):
            cases.pop(sender, None)
            body = "hi"
        case = cases.setdefault(sender, new_case(body))
    lang = case["lang"]

    if n_media:
        ctype = (form.get("MediaContentType0") or "").lower()
        if ctype.startswith("audio/"):
            return [t(lang, "wa.voice_declined")]
        if ctype.startswith("image/") or ctype == "application/pdf":
            return [t(lang, "wa.no_reading")]
        return [t(lang, "wa.unsupported")]
    if not body:
        return []
    try:
        return intake_turn(case, body)
    except Exception:  # noqa: BLE001 - never fail on a judge's message
        app.logger.exception("intake turn failed")
        if case["history"] and case["history"][-1]["role"] == "user":
            case["history"].pop()
        return [t(lang, "error.generic")]


# ---------------------------------------------------------------- transport
TWIML_HEADERS = {"Content-Type": "text/xml; charset=utf-8"}

# Optional: reply via the REST API instead of TwiML. Needs an approved Trust
# Hub profile on upgraded accounts (error 20003 otherwise), so off by default.
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
REPLY_VIA_REST = os.environ.get("REPLY_VIA_REST") == "1"
twilio_rest = (TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
               if REPLY_VIA_REST and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None)


def reply_via_rest(form: dict) -> None:
    for text in handle_inbound(form)[:4]:
        try:
            msg = twilio_rest.messages.create(from_=form.get("To"), to=form.get("From"), body=text[:1600])
            app.logger.warning("sent %s status=%s", msg.sid, msg.status)
        except TwilioRestException as e:
            app.logger.error("Twilio send failed: code=%s status=%s msg=%s", e.code, e.status, e.msg)
            return


@app.route("/whatsapp", methods=["POST"])
def whatsapp():
    verify_twilio_request()
    form = request.form.to_dict()
    if twilio_rest:
        threading.Thread(target=reply_via_rest, args=(form,), daemon=True).start()
        return str(MessagingResponse()), 200, TWIML_HEADERS
    resp = MessagingResponse()
    for text in handle_inbound(form)[:4]:  # at most four messages per inbound
        resp.message(text[:1600])
    return str(resp), 200, TWIML_HEADERS


@app.route("/health", methods=["GET"])
def health():
    return "ok", 200


if __name__ == "__main__":
    # macOS AirPlay Receiver often holds :5000, so use PORT=5001
    app.run(port=int(os.environ.get("PORT", 5000)))
