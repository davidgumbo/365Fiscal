import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export type MeCompany = {
  id: number;
  name: string;
  tin: string;
  vat: string;
  email?: string;
  phone: string;
  address: string;
};

export type Me = {
  id: number;
  email: string;
  is_admin: boolean;
  company_ids: number[];
  companies: MeCompany[];
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<Me>("/users/me")
      .then(setMe)
      .catch(() => {
        // Keep the token; backend may be temporarily unavailable or user may not have /users/me access.
        // Avoid clearing token to prevent redirect loops. Gracefully fall back to minimal UI.
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { me, loading };
}
