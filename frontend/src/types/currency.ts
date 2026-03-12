export type CurrencyItem = {
  id: number;
  company_id: number;
  code: string;
  name: string;
  symbol: string;
  position: string;
  decimal_places: number;
  is_default: boolean;
  is_active: boolean;
};

export type CurrencyRateRead = {
  id: number;
  currency_id: number;
  company_id: number;
  rate: number;
  rate_date: string;
};
