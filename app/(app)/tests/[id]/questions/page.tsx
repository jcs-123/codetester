import { notFound } from "next/navigation";

import { requireRole } from "@/lib/permissions";
import { getTestForUser, getTestQuestions } from "@/lib/tests/queries";
import { cn } from "@/lib/utils";

export default async function TestQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FACULTY", "ADMIN");
  const { id } = await params;
  const row = await getTestForUser(id, user);
  if (!row) notFound();
  const qs = await getTestQuestions(id);

  return (
    <ol className="space-y-4">
      {qs.map((q) => (
        <li key={q.id} className="rounded-md border p-4">
          <div className="flex gap-3">
            <span className="w-8 shrink-0 font-semibold text-muted-foreground">{q.number}.</span>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="whitespace-pre-wrap font-medium">{q.text}</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {q.options.map((o) => (
                  <li
                    key={o.id}
                    className={cn(
                      "flex gap-2 rounded-md border px-3 py-1.5 text-sm",
                      o.id === q.correctOptionId && "border-green-600 bg-green-50 font-medium text-green-800",
                    )}
                  >
                    <span className="w-4 shrink-0">{o.label}.</span>
                    <span className="whitespace-pre-wrap">{o.text}</span>
                  </li>
                ))}
              </ul>
              {(q.hint || q.explanation) && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {q.hint && (
                    <p>
                      <span className="font-medium text-foreground">Hint:</span> {q.hint}
                    </p>
                  )}
                  {q.explanation && (
                    <p>
                      <span className="font-medium text-foreground">Explanation:</span> {q.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
