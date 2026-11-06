"""
Women's career-transition coach — WhatsApp via Twilio sandbox.
Hackathon scaffold for Mela + Cynthia, Fri Nov 6, 2026 (500 Howard St, 9am-3:15pm).

Run:  pip install flask twilio anthropic python-dotenv
      export ANTHROPIC_API_KEY=...   (in .env, never commit it)
      python whatsapp_twilio_server.py
      ngrok http 5000
      -> paste the ngrok https URL + /whatsapp into the Twilio WhatsApp
         sandbox webhook (Messaging > Try it out > WhatsApp sandbox).
      -> each phone joins once: WhatsApp the sandbox number (+1 415 523 8886)
         with: join <your sandbox code>

Why numbered menu, not native buttons: the sandbox + TwiML reply path
handles plain text reliably. A tap on a native WhatsApp button arrives
as text too, but building it needs Twilio's Content API — save that
for after the hackathon. Replying 1 / 2 / 3 works for every judge.
"""

import os
import threading
from flask import Flask, abort, request
from twilio.base.exceptions import TwilioRestException
from twilio.request_validator import RequestValidator
from twilio.rest import Client as TwilioClient
from twilio.twiml.messaging_response import MessagingResponse
import anthropic

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

app = Flask(__name__)
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

SYSTEM = """You are a career transition coach for women relocating
internationally. Help her translate her experience to a new job market,
find roles that fit, and plan concrete next steps. Be warm, specific,
and practical — name real actions, not generic encouragement.
Keep replies short enough to read on WhatsApp (under ~120 words
unless she asks for detail). End with one clear next step or question."""

MENU = (
    "Hi — I'm your relocation career coach. Reply with a number:\n"
    "1. Find roles for me\n"
    "2. Visa & work rights\n"
    "3. Rewrite my resume for a new market\n"
    "Or just tell me where you're moving from / to, and what you do."
)

# Per-sender memory: phone number -> list of {role, content}
history = {}

FLOW_PROMPTS = {
    "1": ("The user wants roles that fit her after an international move. "
          "Ask for: current role, target country/city, and work authorisation "
          "if she knows it. Then name 3 concrete role types / sectors that "
          "translate, and one search to run today."),
    "2": ("The user wants visa & work-rights guidance. Give general "
          "information only, not legal advice, and say so. Ask which "
          "countries are involved, then list the 2-3 most likely routes "
          "and what to check with an immigration adviser."),
    "3": ("The user wants her resume rewritten for a new market. Ask for "
          "her current role and target market, then explain the 3 biggest "
          "translation moves (titles, metrics, local norms) and ask her "
          "to paste her current summary."),
}


def coach_reply(sender: str, user_msg: str) -> str:
    msg = user_msg.strip()
    # First contact or explicit greeting -> show menu. Use `not in`, not a
    # truthiness check: after the menu, history[sender] is [] (falsy), which
    # would trap every user in the menu forever.
    if msg.lower() in ("hi", "hello", "hey", "menu", "start") or sender not in history:
        history[sender] = []
        return MENU
    if msg in FLOW_PROMPTS:
        history[sender].append(
            {"role": "user", "content": FLOW_PROMPTS[msg]})
    else:
        history[sender].append({"role": "user", "content": msg})
    resp = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=800,
        system=SYSTEM,
        messages=history[sender][-12:],  # last 12 turns: keeps context, caps cost
    )
    text = resp.content[0].text
    history[sender].append({"role": "assistant", "content": text})
    return text


SNAG = ("Sorry, I hit a snag. Reply MENU to start again, "
        "or try your message once more.")
TWIML_HEADERS = {"Content-Type": "text/xml; charset=utf-8"}

# Twilio's trial WhatsApp flow accepts the webhook but silently drops TwiML
# replies, so when an Account SID is available we reply via the REST API
# instead. The API also returns real error codes, which we log.
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
twilio_rest = (TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
               if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None)


def safe_reply(sender: str, user_msg: str) -> str:
    try:
        return coach_reply(sender, user_msg)
    except Exception:  # noqa: BLE001 - demo must never fail on a judge's message
        app.logger.exception("coach_reply failed")
        return SNAG


def reply_via_rest(sender: str, our_number: str, user_msg: str) -> None:
    text = safe_reply(sender, user_msg)[:1600]  # WhatsApp body limit
    try:
        msg = twilio_rest.messages.create(from_=our_number, to=sender, body=text)
        app.logger.warning("sent %s to %s status=%s", msg.sid, sender, msg.status)
    except TwilioRestException as e:
        app.logger.error("Twilio send failed: code=%s status=%s msg=%s",
                         e.code, e.status, e.msg)


@app.route("/whatsapp", methods=["POST"])
def whatsapp():
    verify_twilio_request()
    sender = request.form.get("From", "")
    our_number = request.form.get("To", "")
    user_msg = request.form.get("Body", "")
    if twilio_rest:
        # Answer Twilio immediately (it retries after ~15s) and reply async.
        threading.Thread(target=reply_via_rest,
                         args=(sender, our_number, user_msg), daemon=True).start()
        return str(MessagingResponse()), 200, TWIML_HEADERS
    resp = MessagingResponse()
    resp.message(safe_reply(sender, user_msg))
    return str(resp), 200, TWIML_HEADERS


@app.route("/health", methods=["GET"])
def health():
    return "ok", 200


if __name__ == "__main__":
    # macOS AirPlay Receiver often holds :5000 — override with PORT=5001
    app.run(port=int(os.environ.get("PORT", 5000)))
