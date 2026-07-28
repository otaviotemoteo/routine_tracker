import { NextResponse } from "next/server";
import { z } from "zod";
import { getDayChecks } from "@/db/queries";
import { todayInSaoPaulo } from "@/lib/utils";

const dateSchema = z.string().date();

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
