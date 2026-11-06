import type { L10n, Lang } from "@/rules/types";

/**
 * Part III copy (community, proactive, confirmations). Kept here until the WhatsApp work is committed,
 * then moved into locales/*.json under `part3.*`. Same rules as docs/design.md. No colons in running text,
 * no exclamation marks, no em dashes, tú and 你.
 */
export const COPY = {
  "metro.sf_bay_area": { en: "the Bay Area", es: "el Área de la Bahía", zh: "湾区" },
  "metro.la": { en: "the Los Angeles area", es: "el área de Los Ángeles", zh: "洛杉矶地区" },
  "metro.sacramento": { en: "the Sacramento area", es: "el área de Sacramento", zh: "萨克拉门托地区" },
  "metro.san_diego": { en: "the San Diego area", es: "el área de San Diego", zh: "圣地亚哥地区" },
  "metro.central_valley": { en: "the Central Valley", es: "el Valle Central", zh: "中央谷地" },

  "step.school_letter": { en: "the letter from the school", es: "la carta de la escuela", zh: "学校的证明信" },
  "step.evaluation": { en: "the evaluation report", es: "el reporte de evaluación", zh: "学历评估报告" },
  "step.ctc_reply": { en: "the answer to the CTC letter", es: "la respuesta a la carta de la CTC", zh: "对 CTC 来信的回复" },
  "step.live_scan": { en: "fingerprints", es: "las huellas", zh: "指纹" },

  "program.known": {
    en: "I know your program. Graduates of {program} usually have {courses} on their transcript, which is supervised classroom teaching. The CTC calls it student teaching.",
    es: "Conozco tu programa. Las egresadas de {program} suelen tener {courses} en su certificado, que es práctica docente supervisada. La CTC lo llama student teaching.",
    zh: "我了解你的专业。{program}的毕业生成绩单上通常有{courses}，也就是有指导的课堂教学实习。CTC 称之为 student teaching。",
  },
  "program.source": { en: "Source, {title}.", es: "Fuente, {title}.", zh: "来源，{title}。" },
  "program.unverified": { en: "Not yet checked against the original document.", es: "Todavía no comparado con el documento original.", zh: "尚未与原始文件核对。" },
  "program.waiting": { en: "Waiting for your transcript to confirm.", es: "Esperando tu certificado para confirmarlo.", zh: "等你的成绩单来确认。" },
  "program.confirmed": {
    en: "Your transcript shows {courses}. That is the student teaching your program included. You already have it.",
    es: "Tu certificado muestra {courses}. Esa es la práctica docente que incluía tu programa. Ya la tienes.",
    zh: "你的成绩单上有{courses}。这就是你的专业包含的教育实习。你已经有了。",
  },
  "program.contradicted": {
    en: "Your program usually includes {courses}. Your transcript does not show them. Ask the school to confirm.",
    es: "Tu programa suele incluir {courses}. Tu certificado no los muestra. Pide a la escuela que lo confirme.",
    zh: "你的专业通常包括{courses}。你的成绩单上没有显示。请学校确认。",
  },
  "state.from_program": { en: "From your program", es: "De tu programa", zh: "来自你的课程" },

  "count.ask": {
    en: "One more thing, {name}. Can I count you among graduates of {program} in {metro}, by program and area only? It lets the next woman from your school know she is not alone. Nothing from your documents is ever shared. Reply YES.",
    es: "Una cosa más, {name}. ¿Puedo contarte entre las egresadas de {program} en {metro}, solo por programa y zona? Así la próxima maestra de tu escuela sabe que no está sola. Nada de tus documentos se comparte nunca. Responde SÍ.",
    zh: "{name}，还有一件事。我可以把你计入住在{metro}的{program}毕业生吗？只按专业和地区计数。这样下一位同校的老师会知道她不是一个人。你的文件永远不会被分享。请回复 YES。",
  },
  "count.done": {
    en: "Done. You are counted by program and area only. Reply LEAVE any time to be removed.",
    es: "Listo. Cuentas solo por programa y zona. Responde SALIR cuando quieras para que te quite.",
    zh: "好了。只按专业和地区计数。随时回复 LEAVE 即可退出。",
  },
  "count.line": {
    en: "{count} women from {program} live in {metro} and use Bridge.",
    es: "{count} egresadas de {program} viven en {metro} y usan Bridge.",
    zh: "{metro}有 {count} 位{program}的毕业生在用 Bridge。",
  },
  "group.offer": {
    en: "There is a WhatsApp group for you, {name}. In a WhatsApp group everyone sees everyone's number, that is how groups work. Your documents and your case are never shared. Reply JOIN for the link. If you would rather keep your number private, talk with them inside Bridge, where they see your first name only, at {url}",
    es: "Hay un grupo de WhatsApp para ti, {name}. En un grupo de WhatsApp todas ven el número de todas, así funcionan los grupos. Tus documentos y tu caso nunca se comparten. Responde UNIRME para recibir el enlace. Si prefieres no mostrar tu número, habla con ellas dentro de Bridge, donde solo ven tu nombre, en {url}",
    zh: "有一个适合你的 WhatsApp 群，{name}。在 WhatsApp 群里大家都能看到彼此的号码，群就是这样运作的。你的文件和你的案子永远不会被分享。回复 JOIN 获取链接。如果你不想公开号码，可以在 Bridge 里和她们聊，她们只能看到你的名字，网址是 {url}",
  },
  "join.link": {
    en: "Here is the group. {link} The notes I keep for it, with sources, are at {page}",
    es: "Aquí está el grupo. {link} Las notas que llevo para el grupo, con fuentes, están en {page}",
    zh: "这是群链接。{link} 我为这个群整理的说明和来源在 {page}",
  },
  "join.no_link": {
    en: "The group is still being set up. Write to me tomorrow and I will have the link.",
    es: "El grupo todavía se está armando. Escríbeme mañana y tendré el enlace.",
    zh: "群还在建立中。明天再给我发消息，我会把链接给你。",
  },
  "intro.offer": {
    en: "A woman from your program already got {step} and agreed to be introduced. Reply INTRO and I will send her your first name and number, and you hers, only once she says yes too.",
    es: "Una egresada de tu programa ya consiguió {step} y aceptó que te la presente. Responde INTRO y le mando tu nombre y tu número, y a ti los suyos, solo cuando ella también diga que sí.",
    zh: "一位同专业的老师已经拿到了{step}，并同意被介绍。回复 INTRO，我会在她也同意后，把你的名字和号码发给她，也把她的发给你。",
  },
  "intro.waiting": {
    en: "Noted. I will send the details once she says yes too. Nothing is shared before that.",
    es: "Anotado. Mando los datos cuando ella también diga que sí. Antes de eso no se comparte nada.",
    zh: "记下了。等她也同意后我再发送。在那之前什么都不会分享。",
  },
  "intro.sent": {
    en: "{name} said yes too. Her number is {phone}. She has your first name and number. Nothing else was shared.",
    es: "{name} también dijo que sí. Su número es {phone}. Ella tiene tu nombre y tu número. No se compartió nada más.",
    zh: "{name}也同意了。她的号码是 {phone}。她也收到了你的名字和号码。没有分享其他任何信息。",
  },
  "giveback.ask": {
    en: "You have {step} now. Would you be open to being introduced to the next woman from your school who gets stuck here? Only your first name and number, and only if you both say yes. Reply INTRO.",
    es: "Ya tienes {step}. ¿Aceptarías que te presente a la próxima maestra de tu escuela que se atore aquí? Solo tu nombre y tu número, y solo si las dos dicen que sí. Responde INTRO.",
    zh: "你已经拿到了{step}。下一位同校老师卡在这一步时，你愿意被介绍给她吗？只分享名字和号码，而且要你们双方都同意。请回复 INTRO。",
  },
  "giveback.done": {
    en: "Thank you. When someone from your school gets stuck here I will ask you both first.",
    es: "Gracias. Cuando alguien de tu escuela se atore aquí, les pregunto primero a las dos.",
    zh: "谢谢你。当同校有人卡在这一步时，我会先问你们双方。",
  },
  "leave.done": {
    en: "Done. You are no longer counted or offered for introductions. If you joined the WhatsApp group, you can leave it from the group's menu.",
    es: "Listo. Ya no cuentas ni te ofrezco para presentaciones. Si entraste al grupo de WhatsApp, puedes salir desde el menú del grupo.",
    zh: "好了。你不再被计数，也不会再被介绍给别人。如果你加入了 WhatsApp 群，可以在群菜单里退出。",
  },
  "peer.timing": {
    en: "{count} women from your program got {step}. It took them {low} to {high} weeks.",
    es: "{count} egresadas de tu programa consiguieron {step}. Les tomó de {low} a {high} semanas.",
    zh: "{count} 位同专业的老师拿到了{step}，用了 {low} 到 {high} 周。",
  },
  "peer.timing_same": {
    en: "{count} women from your program got {step}. It took them about {low} weeks.",
    es: "{count} egresadas de tu programa consiguieron {step}. Les tomó unas {low} semanas.",
    zh: "{count} 位同专业的老师拿到了{step}，大约用了 {low} 周。",
  },
  "peer.fits": {
    en: "If you ask this week, it should arrive before your deadline.",
    es: "Si la pides esta semana, debería llegar antes de tu fecha límite.",
    zh: "如果你这周就去申请，应该能在截止日期前拿到。",
  },
  "peer.tight": {
    en: "That is close to your deadline, so asking this week matters.",
    es: "Eso está cerca de tu fecha límite, así que pedirla esta semana importa.",
    zh: "这离你的截止日期很近，所以这周就去申请很重要。",
  },

  "nudge.deadline": {
    en: "{days} days left to answer the CTC letter of {date}.",
    es: "Quedan {days} días para responder la carta de la CTC del {date}.",
    zh: "距离回复 {date} 的 CTC 来信还有 {days} 天。",
  },
  "nudge.arrived": {
    en: "Since you last wrote, {rule} moved to {state}.",
    es: "Desde la última vez que escribiste, {rule} pasó a {state}.",
    zh: "自从你上次留言后，{rule}变成了{state}。",
  },
  "nudge.prepared": {
    en: "{draft} is written and waiting for you at {url}",
    es: "{draft} está escrita y te espera en {url}",
    zh: "{draft}已经写好了，在 {url}",
  },
  "draft.request_school_letter": { en: "The letter to your school", es: "La carta para tu escuela", zh: "给学校的信" },
  "draft.respond_ctc_letter": { en: "The answer to the CTC letter", es: "La respuesta a la carta de la CTC", zh: "给 CTC 的回复" },
  "draft.request_evaluation": { en: "The request to the evaluation agency", es: "La solicitud a la agencia evaluadora", zh: "给评估机构的申请" },
  "draft.ask_ctc_question": { en: "The question to the CTC", es: "La pregunta a la CTC", zh: "给 CTC 的问题" },

  "confirm.sent_ask": {
    en: "When you have sent {doc} to {to}, reply SENT and I will record it as sent on {date}, with a receipt.",
    es: "Cuando hayas mandado {doc} a {to}, responde ENVIADO y lo registro como enviado el {date}, con un comprobante.",
    zh: "当你把{doc}发给{to}后，回复 SENT，我会记录为 {date} 已发送，并给你一份回执。",
  },
  "confirm.expired": {
    en: "That was more than a day ago, so I did not act on it. Here it is again.",
    es: "Eso fue hace más de un día, así que no hice nada. Aquí está otra vez.",
    zh: "那已经是一天多以前的事了，所以我没有执行。再发你一次。",
  },
  "receipt.line": {
    en: "On {date}, {doc} ({pages}, fingerprint {hash}) was sent to {to} by {method}.",
    es: "El {date}, {doc} ({pages}, huella {hash}) se envió a {to} por {method}.",
    zh: "{date}，{doc}（{pages}，指纹 {hash}）已通过{method}发送给{to}。",
  },
  "receipt.why": {
    en: "If the CTC ever writes that it was not shown, this is your record.",
    es: "Si la CTC alguna vez escribe que no se mostró, este es tu registro.",
    zh: "如果 CTC 说没有收到，这就是你的记录。",
  },
  "pages.one": { en: "1 page", es: "1 página", zh: "1 页" },
  "pages.many": { en: "{n} pages", es: "{n} páginas", zh: "{n} 页" },
  "method.email": { en: "email", es: "correo", zh: "电子邮件" },
  "method.upload": { en: "upload", es: "carga en línea", zh: "网上上传" },
  "method.mail": { en: "mail", es: "correo postal", zh: "邮寄" },
  "method.in_person": { en: "hand", es: "en persona", zh: "当面" },

  "circle.post.program": {
    en: "Graduates of {program} usually have {courses} on their transcript. When an agency asks for proof of student teaching, the letter comes from {office} and should state {must}.",
    es: "Las egresadas de {program} suelen tener {courses} en su certificado. Cuando una agencia pide prueba de la práctica docente, la carta la da {office} y debe decir {must}.",
    zh: "{program}的毕业生成绩单上通常有{courses}。当评估机构要求教育实习证明时，证明信由{office}出具，应写明{must}。",
  },
  "must.school": { en: "the school where the practice took place", es: "la escuela donde se hizo la práctica", zh: "实习学校" },
  "must.weeks": { en: "the number of weeks", es: "el número de semanas", zh: "实习周数" },
  "must.hours": { en: "the number of hours", es: "el número de horas", zh: "实习学时" },
  "must.supervisor": { en: "the supervisor", es: "quién la supervisó", zh: "指导老师" },
  "portal.title": { en: "{name}, this is your case.", es: "{name}, este es tu caso.", zh: "{name}，这是你的申请档案。" },
  "portal.title_noname": { en: "This is your case.", es: "Este es tu caso.", zh: "这是你的申请档案。" },
  "portal.saved_wa": {
    en: "Your case is saved and connected to your WhatsApp ending in {last4}. Write there any time and I will tell you what changed.",
    es: "Tu caso está guardado y conectado a tu WhatsApp que termina en {last4}. Escríbeme ahí cuando quieras y te digo qué cambió.",
    zh: "你的档案已保存，并连接到尾号 {last4} 的 WhatsApp。随时在那里给我发消息，我会告诉你有什么变化。",
  },
  "portal.saved_web": {
    en: "Your case is saved at this address. Keep the link, it opens your case.",
    es: "Tu caso está guardado en esta dirección. Guarda el enlace, abre tu caso.",
    zh: "你的档案保存在这个网址。请保存这个链接，用它可以打开你的档案。",
  },
  "portal.open_wa": { en: "Continue on WhatsApp", es: "Seguir en WhatsApp", zh: "在 WhatsApp 继续" },
  "portal.connect_wa": { en: "Get updates on WhatsApp", es: "Recibir avisos por WhatsApp", zh: "在 WhatsApp 接收更新" },
  "portal.wa_prefill": { en: "status", es: "estado", zh: "进展" },
  "portal.since": { en: "Since you were last here", es: "Desde tu última visita", zh: "自你上次来过之后" },
  "portal.nothing_new": { en: "Nothing new since you were last here.", es: "Nada nuevo desde tu última visita.", zh: "自你上次来过之后没有新变化。" },
  "portal.week": { en: "This week", es: "Esta semana", zh: "本周" },
  "portal.also": { en: "Also on your list", es: "También en tu lista", zh: "你的其他事项" },
  "portal.did": { en: "What I did for you", es: "Lo que hice por ti", zh: "我为你做了什么" },
  "portal.did.read": { en: "Read {docs}.", es: "Leí {docs}.", zh: "读了{docs}。" },
  "portal.did.office": { en: "Found the office that decides, {office}.", es: "Encontré la oficina que decide, {office}.", zh: "找到了负责审批的机构，{office}。" },
  "portal.did.program": { en: "Recognised your program, {program}.", es: "Reconocí tu programa, {program}.", zh: "识别出了你的专业，{program}。" },
  "portal.did.letter": { en: "{draft}, written for you.", es: "{draft}, escrita para ti.", zh: "{draft}，已为你写好。" },
  "portal.people": { en: "Others who trained where you did", es: "Otras que se formaron donde tú", zh: "和你在同一个地方受训的人" },
  "portal.people.unknown": {
    en: "When I know your profession, where you trained and where you live, I can connect you with others going through this.",
    es: "Cuando sepa tu profesión, dónde te formaste y dónde vives, te puedo conectar con otras que están pasando por esto.",
    zh: "当我知道你的职业、在哪里受训以及住在哪里后，我可以帮你联系正在经历同样事情的人。",
  },
  "portal.choose": { en: "Do you want to talk with them? Two ways, you choose.", es: "¿Quieres hablar con ellas? Dos formas, tú eliges.", zh: "想和她们聊聊吗？有两种方式，由你选择。" },
  "portal.chat_option": {
    en: "Here in Bridge. Others see your first name only, never your number.",
    es: "Aquí en Bridge. Las demás ven solo tu nombre, nunca tu número.",
    zh: "在 Bridge 里。别人只能看到你的名字，看不到你的号码。",
  },
  "portal.chat_button": { en: "Join the conversation in Bridge", es: "Entrar a la conversación en Bridge", zh: "加入 Bridge 里的对话" },
  "portal.group_option": {
    en: "The WhatsApp group {name}. Everyone in it sees everyone's number, that is how WhatsApp groups work. Your documents and your case are never shared.",
    es: "El grupo de WhatsApp {name}. Todas ven el número de todas, así funcionan los grupos de WhatsApp. Tus documentos y tu caso nunca se comparten.",
    zh: "WhatsApp 群 {name}。群里每个人都能看到彼此的号码，WhatsApp 群就是这样运作的。你的文件和你的案子永远不会被分享。",
  },
  "portal.group_button": { en: "Open the WhatsApp group", es: "Abrir el grupo de WhatsApp", zh: "打开 WhatsApp 群" },
  "portal.open_circle": { en: "Open the conversation", es: "Abrir la conversación", zh: "打开对话" },
  "portal.leave": { en: "Stop counting me and leave the conversation", es: "Ya no contarme y salir de la conversación", zh: "不再计入我，并退出对话" },
  "portal.synthetic": { en: "Some members counted here are synthetic, for the demo.", es: "Algunas integrantes contadas aquí son sintéticas, para la demostración.", zh: "这里计入的部分成员是演示用的虚拟成员。" },

  "circle.notes": { en: "About your program", es: "Sobre tu programa", zh: "关于你的专业" },
  "circle.chat": { en: "Conversation", es: "Conversación", zh: "对话" },
  "circle.empty": { en: "No messages yet. Say hello.", es: "Todavía no hay mensajes. Saluda.", zh: "还没有消息。打个招呼吧。" },
  "circle.placeholder": { en: "Write to the others", es: "Escribe a las demás", zh: "写给大家" },
  "circle.send": { en: "Send to the conversation", es: "Enviar a la conversación", zh: "发送到对话" },
  "circle.first_name_only": { en: "Others see your first name only.", es: "Las demás ven solo tu nombre.", zh: "别人只能看到你的名字。" },
  "circle.not_joined": { en: "Join the conversation to read and write here.", es: "Entra a la conversación para leer y escribir aquí.", zh: "加入对话后才能在这里阅读和发言。" },
  "circle.leave_chat": { en: "Leave the conversation", es: "Salir de la conversación", zh: "退出对话" },
  "circle.from_earned": { en: "Bridge, from public sources", es: "Bridge, de fuentes públicas", zh: "Bridge，来自公开资料" },
  "circle.back": { en: "Back to your case", es: "Volver a tu caso", zh: "返回你的档案" },
  "circle.not_ready": {
    en: "When I know your profession, where you trained and where you live, you will find the others here.",
    es: "Cuando sepa tu profesión, dónde te formaste y dónde vives, aquí encontrarás a las demás.",
    zh: "当我知道你的职业、在哪里受训以及住在哪里后，你会在这里找到其他人。",
  },
  "circle.on_whatsapp": {
    en: "The same group is on WhatsApp, where everyone sees everyone's number.",
    es: "El mismo grupo está en WhatsApp, donde todas ven el número de todas.",
    zh: "同一个群也在 WhatsApp 上，在那里大家都能看到彼此的号码。",
  },
  "circle.post.progress": {
    en: "{count} members got {step} this week.",
    es: "{count} integrantes consiguieron {step} esta semana.",
    zh: "本周有 {count} 位成员拿到了{step}。",
  },
  "circle.post.private": {
    en: "Send that to me directly and I will read it.",
    es: "Mándamelo directo y lo leo.",
    zh: "请私信发给我，我来看。",
  },
} satisfies Record<string, L10n>;

export type CopyKey = keyof typeof COPY;

export function say(lang: Lang, key: CopyKey, vars: Record<string, string | number> = {}): string {
  const row: L10n = COPY[key];
  const raw = row[lang] ?? row.en;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export const sayL10n = (lang: Lang, v: L10n) => v[lang] ?? v.en;
