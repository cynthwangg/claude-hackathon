import { updateIntake } from "@/lib/case";
import { handle, ok, type Ctx } from "@/lib/http";
import { IntakeSchema } from "@/lib/intake/types";

export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  return handle(async () => {
    const { id } = await params;
    const patch = IntakeSchema.partial().parse(await req.json());
    return ok({ intake: await updateIntake(id, patch) });
  });
}
