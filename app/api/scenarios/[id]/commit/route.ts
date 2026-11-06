import { commitScenario } from "@/lib/scenario";
import { handle, ok, type Ctx } from "@/lib/http";

export async function POST(_: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => ok(await commitScenario((await params).id)));
}
