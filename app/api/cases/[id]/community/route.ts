import { fail, handle, ok, type Ctx } from "@/lib/http";
import { circleView, communityAct, type CommunityAction } from "@/lib/portal";

const ACTIONS: CommunityAction[] = ["group", "chat_join", "chat_leave", "leave", "say"];

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => ok(await circleView((await params).id)));
}

/** Body `{ action, text? }`. Each opt-in is a separate act she takes; nothing here is done for her. */
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; text?: string };
    if (!ACTIONS.includes(body.action as CommunityAction)) return fail("bad_value", 400);
    return ok(await communityAct(id, body.action as CommunityAction, body.text));
  });
}
