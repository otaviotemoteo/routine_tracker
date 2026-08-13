import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyReadingProgress,
  getCheckTemplateKind,
  saveCheckDetails,
  toggleCheck,
} from "@/db/queries";
import { parseDetails } from "@/lib/details-schemas";
import { getUserId } from "@/lib/session";

const bodySchema = z.object({
  done: z.boolean(),
  details: z.unknown().optional(),
  note: z.string().max(2000).nullable().optional(),
});

// PATCH /api/checks/:id
//  - { done } only            → quick toggle (preserves any saved details)
//  - { done, details, note }  → sheet save (details validated per habit slug)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
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
      { error: "Corpo inválido — esperado { done, details?, note? }" },
      { status: 422 }
    );
  }
  const { done, details, note } = parsed.data;

  try {
    // Quick toggle: no details/note in the body — leave stored details intact.
    if (details === undefined && note === undefined) {
      const check = await toggleCheck(userId, checkId, done);
      if (!check) {
        return NextResponse.json(
          { error: "Check não encontrado" },
          { status: 404 }
        );
      }
      return NextResponse.json(check);
    }

    // Sheet save: validate details (when present) against the habit's schema.
    // Keyed on the TEMPLATE KIND, not the slug — slugs are per-account now, so
    // another user's habit could be slugged "leitura" without being one.
    let validated: unknown = null;
    let templateKind: string | null = null;
    if (details !== undefined && details !== null) {
      const habit = await getCheckTemplateKind(userId, checkId);
      if (!habit) {
        return NextResponse.json(
          { error: "Check não encontrado" },
          { status: 404 }
        );
      }
      templateKind = habit.templateKind;
      try {
        validated = parseDetails(templateKind, details);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Detalhes inválidos", details: err.flatten() },
            { status: 422 }
          );
        }
        throw err;
      }
    }

    const check = await saveCheckDetails(userId, checkId, {
      done,
      details: validated,
      note: note ?? null,
    });
    if (!check) {
      return NextResponse.json(
        { error: "Check não encontrado" },
        { status: 404 }
      );
    }

    // Reading side-effect: advance the book's page / finish it. Only the
    // owner's migrated reading habit carries this kind, so a friend's habit
    // that happens to share the slug never reaches it.
    if (templateKind === "leitura" && validated) {
      const d = validated as { book_id: number; ended_on_page: number };
      await applyReadingProgress(userId, d.book_id, d.ended_on_page, check.checkedAt);
    }

    return NextResponse.json(check);
  } catch {
    return NextResponse.json(
      { error: "Falha ao atualizar o check" },
      { status: 500 }
    );
  }
}
