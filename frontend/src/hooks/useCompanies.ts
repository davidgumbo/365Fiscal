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
  const { me } = useMe();
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const load = async () => {
      const path = me?.is_admin ? "/companies" : "/companies/me";
      try {
        const data = await apiFetch<Company[]>(path);
        setCompanies(data);
      } catch {
        setCompanies([]);
      }
    };
    load();
  }, [me?.is_admin]);

  return companies;
}
