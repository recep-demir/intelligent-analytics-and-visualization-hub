import { useState, useEffect } from "react";

interface FilterOptions {
  categories: string[];
  provinces:  string[];
  statuses:   string[];
  years:      number[];
}

export function useFilterOptions(): FilterOptions {
  const [options, setOptions] = useState<FilterOptions>({
    categories: [], provinces: [], statuses: [], years: [],
  });

  useEffect(() => {
    const apiUrl = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";
    fetch(`${apiUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { categories provinces statuses years }`,
      }),
    })
      .then(r => r.json())
      .then(json => {
        const d = json.data;
        if (!d) return;
        setOptions({
          categories: Array.isArray(d.categories) ? d.categories : [],
          provinces:  Array.isArray(d.provinces)  ? d.provinces  : [],
          statuses:   Array.isArray(d.statuses)   ? d.statuses   : [],
          years:      Array.isArray(d.years)       ? d.years      : [],
        });
      })
      .catch(() => {});
  }, []);

  return options;
}
