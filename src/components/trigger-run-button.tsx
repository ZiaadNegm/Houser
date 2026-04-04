"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TriggerRunButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  async function handleTrigger() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/trigger-run", { method: "POST" });
      if (res.status === 409) {
        setMessage("A run is already in progress");
        return;
      }
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to trigger run");
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={handleTrigger} disabled={loading}>
        {loading ? "Triggering..." : "Trigger Run"}
      </Button>
      {message && <p className="text-sm text-yellow-600 mt-2">{message}</p>}
    </div>
  );
}
