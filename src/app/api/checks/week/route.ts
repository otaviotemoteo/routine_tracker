import { NextResponse } from "next/server";
import { z } from "zod";
import { getWeekData } from "@/db/queries";
import { isMonday } from "@/lib/utils";

const dateSchema = z.string().date();

// GET /api/checks/week?start=YYYY-MM-DD — 7 days × 7 habits. `start` must be
// a Monday (the week always runs Mon–Sun, README Decision 3).
export async function GET(request: Request) {
  const startParam = new URL(request.url).searchParams.get("start");

  const parsed = dateSchema.safeParse(startParam);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetro start obrigatório no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (!isMonday(parsed.data)) {
    return NextResponse.json(
      { error: "start precisa ser uma segunda-feira" },
      { status: 400 }
    );
  }

  try {
    const week = await getWeekData(parsed.data);
    return NextResponse.json(week);
  } catch {
    return NextResponse.json(
      { error: "Falha ao buscar os checks da semana" },
      { status: 500 }
    );
  }
}
