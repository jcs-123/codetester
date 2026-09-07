import { z } from "zod";

const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Faculty "Create / edit test" form (FR-FAC-02, FR-FAC-07). Dates arrive as datetime-local strings in IST. */
export const testFormSchema = z.object({
  name: trimmed(120, "Test name"),
  subjectCode: trimmed(20, "Subject code"),
  subjectName: trimmed(120, "Subject name"),
  department: trimmed(60, "Department"),
  semester: z.coerce.number().int().min(1, "Choose a semester").max(8, "Choose a semester"),
  batch: trimmed(20, "Batch"),
  startsAt: z.string().min(1, "Start date and time are required"),
  endsAt: z.string().min(1, "End date and time are required"),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .min(5, "Minimum duration is 5 minutes")
    .max(600, "Maximum duration is 600 minutes"),
  instructions: z.string().trim().max(2000, "Instructions must be at most 2000 characters"),
  showAnswers: z.enum(["AFTER_END", "IMMEDIATELY"]),
});

export type TestFormInput = z.infer<typeof testFormSchema>;

export const MIN_DURATION_MINUTES = 5;
