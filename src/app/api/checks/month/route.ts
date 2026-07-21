import { NextResponse } from "next/server";
import { z } from "zod";
import { getMonthData } from "@/db/queries";
import { todayInSaoPaulo } from "@/lib/utils";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// GET /api/checks/month?month=YYYY-MM — adherence % over ELAPSED days
// (README Decision 5) + current streak per habit (Decision 4).
export async function GET(request: Request) {
  const monthParam = new URL(request.url).searchParams.get("month");

  const parsed = monthSchema.safeParse(monthParam);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetro month obrigatório no formato YYYY-MM" },
      { status: 400 }
    );
  }

  try {
    const month = await getMonthData(parsed.data, todayInSaoPaulo());
    return NextResponse.json(month);
  } catch {
    return NextResponse.json(
      { error: "Falha ao buscar os dados do mês" },
      { status: 500 }
    );
  }
}
