import { env } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-6 text-center">
        <p className="text-lg font-semibold tracking-tight">{env.APP_NAME}</p>
        <p className="text-sm text-muted-foreground">Jyothi Engineering College</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
