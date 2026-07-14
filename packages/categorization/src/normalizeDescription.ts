// Statement descriptions for installment purchases embed the counter inline,
// often glued directly onto the merchant name with no separator
// (e.g. "MERCADOLIVRE*FEIZA07/12", "AMAZON.COM.BR 02/12"), and that counter
// changes every month for the same purchase. Stripping it keeps the
// description_pattern stable across months so a memorized correction keeps
// matching for the remaining installments. No `\b` before the digits: a
// letter-to-digit transition ("A0") is not a word boundary in regex, so
// requiring one would silently skip glued-on counters like "FEIZA07/12".
const INSTALLMENT_SUFFIX = /\s*\(?\d{1,2}\s*\/\s*\d{1,2}\)?\s*$/

export function normalizeDescriptionForMemory(description: string): string {
  return description.replace(INSTALLMENT_SUFFIX, '').trim()
}
