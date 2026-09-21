"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinSession, writeToken } from "@/lib/client";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clean = code.trim().toUpperCase();
      const { token } = await joinSession(clean, name.trim());
      writeToken("team", clean, token);
      router.push(`/play/${clean}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
      setBusy(false);
    }
  }

  return (
    <form className="joinform" onSubmit={submit}>
      <input
        id="join-code" className="codeinput" value={code} maxLength={4} placeholder="CODE"
        autoComplete="off" spellCheck={false} aria-label="Access code"
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <input
        id="join-name" value={name} maxLength={22} placeholder="Your group's name"
        autoComplete="off" aria-label="Group name"
        onChange={(e) => setName(e.target.value)}
      />
      {error && <span className="err">{error}</span>}
      <button className="btn" disabled={busy || code.length !== 4 || name.trim().length < 2}>
        {busy ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
