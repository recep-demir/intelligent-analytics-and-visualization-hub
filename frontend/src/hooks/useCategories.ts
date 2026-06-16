import { useState, useEffect } from "react";

export function useCategories(): string[] {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const apiUrl = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";
    fetch(`${apiUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `query { categories }` }),
    })
      .then(r => r.json())
      .then(json => {
        if (Array.isArray(json.data?.categories)) {
          setCategories(json.data.categories);
        }
      })
      .catch(() => {});
  }, []);

  return categories;
}
