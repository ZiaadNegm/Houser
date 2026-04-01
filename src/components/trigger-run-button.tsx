"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TriggerRunButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleTrigger() {
    setLoading(true);
    try {
      const res = await fetch("/api/trigger-run", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to trigger run");
      }
      router.refresh();
    } catch (err) {
      console.error("Trigger run failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleTrigger} disabled={loading}>
      {loading ? "Triggering..." : "Trigger Run"}
    </Button>
  );
}
