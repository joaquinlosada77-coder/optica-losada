"use client";

import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  pending,
  pendingText = "Guardando…",
}: {
  children: React.ReactNode;
  pending: boolean;
  pendingText?: string;
}) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
