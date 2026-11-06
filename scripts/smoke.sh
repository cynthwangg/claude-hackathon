#!/usr/bin/env bash
# API smoke test of section 7.1 against a running server. Usage: scripts/smoke.sh http://localhost:3100 es
set -euo pipefail
B=${1:-http://localhost:3100}; LANG_=${2:-es}
j() { node -pe "const j=JSON.parse(require('fs').readFileSync(0)); $1"; }
ID=$(curl -sf -X POST $B/api/cases -H 'Content-Type: application/json' -d "{\"language\":\"$LANG_\"}" | j 'j.case_id')
echo "case $ID"
curl -sf -X POST $B/api/cases/$ID/messages -H 'Content-Type: application/json' \
  -d '{"text":"Hola, soy Mariana. Fui maestra de primaria, de segundo a quinto, en Guadalajara, México, diez años. Tengo mi cédula profesional. Ahora vivo en San José. Mandé la solicitud a la CTC y me regresaron una carta que no entiendo bien."}' \
  | j 'JSON.stringify({done:j.done,missing:j.missing,route:j.routing.kind,office:j.header&&j.header.office&&j.header.office.name})'
for f in 06-ctc-letter-returned.pdf 05-evaluation-report-general.pdf 01-certificado-estudios.jpg 02-titulo.pdf 03-cedula-profesional.jpg 04-constancia-servicio.pdf; do
  mime=application/pdf; [[ $f == *.jpg ]] && mime=image/jpeg
  curl -s -X POST $B/api/cases/$ID/documents -F "file=@fixtures/mariana/$f;type=$mime" | j '(j.document ? j.document.kind+" "+j.document.status+" facts="+j.document.facts.length : j.error_key)'
done
curl -sf $B/api/cases/$ID/position | node -e '
const j=JSON.parse(require("fs").readFileSync(0));const p=j.position;
for (const b of ["have","needed","unknown"]) { console.log("##",b); for (const l of p[b]) console.log(" ",l.rule_id,"|",l.state_word,"|",l.text); }
console.log("## letter"); for (const l of p.letter) console.log(" ",l.number,l.rule_id,l.paperwork,l.named.join(" / "));
console.log("## extra", JSON.stringify(p.extra_have)); console.log("## next", p.next.text);
console.log("## week", j.week.headline.text, "|", j.week.why_now, "| also:", j.week.also.map(a=>a.text).join("; "));
console.log("## route\n ", j.route.steps.map(s=>s.state_word+": "+s.text+(s.note?" ("+s.note+")":"")).join("\n  "));
console.log("## known", JSON.stringify(j.route.known), "bridge", j.route.bridge);'
echo "$ID" > /tmp/earned-case
