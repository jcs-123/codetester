import { xlsxResponse } from "@/lib/excel/response";
import { buildFacultyTemplate, buildQuestionTemplate, buildStudentTemplate } from "@/lib/excel/templates";
import { getSessionUser } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { type } = await params;

  if (type === "faculty" || type === "students") {
    if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
    const buf = type === "faculty" ? await buildFacultyTemplate() : await buildStudentTemplate();
    return xlsxResponse(buf, `${type}-import-template.xlsx`);
  }
  if (type === "questions") {
    if (user.role === "STUDENT") return new Response("Forbidden", { status: 403 });
    return xlsxResponse(await buildQuestionTemplate(), "question-template.xlsx");
  }
  return new Response("Not found", { status: 404 });
}
