"use client";

import { useEffect } from "react";

export default function SeedProducts() {
  useEffect(() => {
    fetch("/api/seed", { method: "POST" }).catch(() => {
      // Fail silently – seeding is non-critical
    });
  }, []);

  return null;
}
