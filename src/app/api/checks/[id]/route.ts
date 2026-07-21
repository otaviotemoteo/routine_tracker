import { NextResponse } from "next/server";
import { z } from "zod";
import { toggleCheck } from "@/db/queries";

const bodySchema = z.object({ done: z.boolean() });

// PATCH /api/checks/:id — body { done: boolean }. Toggles a check and bumps
// updated_at.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checkId = Number(id);
  if (!Number.isInteger(checkId) || checkId <= 0) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Corpo inválido — esperado { done: boolean }" },
      { status: 422 }
    );
  }

  try {
    const check = await toggleCheck(checkId, parsed.data.done);
    if (!check) {
      return NextResponse.json(
        { error: "Check não encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json(check);
  } catch {
    return NextResponse.json(
      { error: "Falha ao atualizar o check" },
      { status: 500 }
    );
  }
}
