export const isBlank = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
};

export const getRequiredFieldError = (
  fields: Array<{ label: string; value: unknown }>,
): string | null => {
  const missing = fields.find((field) => isBlank(field.value));
  return missing ? `${missing.label} is required.` : null;
};

export type ValidatedLine = {
  product_id?: number | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  discount?: number | null;
  vat_rate?: number | null;
};

export const getDocumentLinesError = (
  lines: ValidatedLine[],
  opts?: { requireProductOrDescription?: boolean },
): string | null => {
  if (!lines.length) return "Add at least one line item.";

  const requireProductOrDescription = opts?.requireProductOrDescription ?? true;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const index = i + 1;
    const quantity = Number(line.quantity ?? 0);
    const unitPrice = Number(line.unit_price ?? 0);
    const discount = Number(line.discount ?? 0);
    const vatRate = Number(line.vat_rate ?? 0);

    if (
      requireProductOrDescription &&
      !line.product_id &&
      isBlank(line.description ?? "")
    ) {
      return `Line ${index}: select a product or enter a description.`;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return `Line ${index}: quantity must be greater than 0.`;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return `Line ${index}: unit price cannot be negative.`;
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      return `Line ${index}: discount must be between 0 and 100.`;
    }

    if (!Number.isFinite(vatRate) || vatRate < 0) {
      return `Line ${index}: VAT rate cannot be negative.`;
    }
  }

  return null;
};
