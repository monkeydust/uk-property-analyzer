// UK postcode regex - handles all valid formats
// e.g., SW1A 1AA, M1 1AA, B33 8TH, CR2 6XH, DN55 1PT
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;

export interface ParsedPostcode {
  full: string;
  outward: string;
  inward: string;
}

/**
 * Extract postcode from text (address, URL, etc.)
 */
export function extractPostcode(text: string): string | null {
  const match = text.match(POSTCODE_REGEX);
  if (match && match.length > 0) {
    // Return the first match, normalized
    return normalizePostcode(match[0]);
  }
  return null;
}

/**
 * Normalize postcode to standard format: "SW1A 1AA"
 */
export function normalizePostcode(postcode: string): string {
  const cleaned = postcode.toUpperCase().replace(/\s+/g, '');
  // Insert space before last 3 characters
  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }
  return cleaned;
}

/**
 * Parse postcode into components
 */
export function parsePostcode(postcode: string): ParsedPostcode | null {
  const normalized = normalizePostcode(postcode);
  const parts = normalized.split(' ');

  if (parts.length !== 2) return null;

  return {
    full: normalized,
    outward: parts[0],
    inward: parts[1],
  };
}

/**
 * Validate if string is a valid UK postcode format
 */
export function isValidPostcode(postcode: string): boolean {
  const normalized = normalizePostcode(postcode);
  const strictRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/;
  return strictRegex.test(normalized);
}
