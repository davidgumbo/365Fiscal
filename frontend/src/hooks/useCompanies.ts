import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useMe } from "./useMe";

export type Company = {
  id: number;
  name: string;
  address: string;
  city?: string;
  country?: string;
  email?: string;
  phone: string;
  tin: string;
  vat: string;
};

export function useCompanies() {
  const { me, loading: meLoading } = useMe();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (meLoading) return;
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const path = me?.is_admin ? "/companies" : "/companies/me";
      try {
        const data = await apiFetch<Company[]>(path);
        if (isMounted) setCompanies(data);
      } catch {
        if (isMounted) setCompanies([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [me?.is_admin, meLoading]);

  return { companies, loading };
}
