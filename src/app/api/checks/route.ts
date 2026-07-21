import { NextResponse } from "next/server";
import { z } from "zod";
import { getDayChecks, setChecksDone } from "@/db/queries";
import { todayInSaoPaulo } from "@/lib/utils";

const dateSchema = z.string().date();

const batchSchema = z.object({
  updates: z
    .array(z.object({ id: z.number().int().positive(), done: z.boolean() }))
    .min(1)
    .max(50),
});

// GET /api/checks?date=YYYY-MM-DD — the day's 7 checks, lazily created.
// Without ?date, uses today in São Paulo (never the server's UTC day).
export async function GET(request: Request) {
  const dateParam = new URL(request.url).searchParams.get("date");

  let date: string;
  if (dateParam === null) {
    date = todayInSaoPaulo();
  } else {
    const parsed = dateSchema.safeParse(dateParam);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Data inválida — use o formato YYYY-MM-DD" },
        { status: 400 }
      );
    }
    date = parsed.data;
  }

  try {
    const checks = await getDayChecks(date);
    return NextResponse.json({ date, checks });
  } catch {
    return NextResponse.json(
      { error: "Falha ao buscar os checks do dia" },
      { status: 500 }
    );
  }
}

// PATCH /api/checks — body { updates: [{ id, done }] }. Saves the whole day
// in one request (the Today screen confirms all habits at once).
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Corpo inválido — esperado { updates: [{ id, done }] }" },
      { status: 422 }
    );
  }

  try {
    const checks = await setChecksDone(parsed.data.updates);
    return NextResponse.json({ checks });
  } catch {
    return NextResponse.json(
      { error: "Falha ao salvar os checks do dia" },
      { status: 500 }
    );
  }
}
