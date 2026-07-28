import { NextResponse } from "next/server";
import { z } from "zod";
import { getExport } from "@/db/queries";

const dateSchema = z.string().date();

// GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD — the canonical dataset JSON
// (behind auth like everything else). Feeds the year-end AI analysis; see
// DATA_DICTIONARY.md for the field semantics.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = dateSchema.safeParse(params.get("from"));
  const to = dateSchema.safeParse(params.get("to"));

  if (!from.success || !to.success) {
    return NextResponse.json(
      { error: "from e to obrigatórios no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (from.data > to.data) {
    return NextResponse.json(
      { error: "from precisa ser anterior ou igual a to" },
      { status: 400 }
    );
  }

  try {
    const data = await getExport(from.data, to.data);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Falha ao exportar os dados" },
      { status: 500 }
    );
  }
}
