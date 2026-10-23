export type FilenameFormat =
  | "firstlast" // e.g. alilylipio (firstname + lastname directly)
  | "first_last" // e.g. alily_lipio
  | "first.last" // e.g. alily.lipio
  | "last_first"; // e.g. lipio_alily

const SUFFIXES = new Set([
  "jr",
  "jr.",
  "sr",
  "sr.",
  "ii",
  "iii",
  "iv",
  "v",
]);

const SURNAME_PREFIXES = new Set([
  "de",
  "del",
  "dela",
  "san",
  "santa",
  "sta",
  "sta.",
]);

function isMiddleInitial(token: string): boolean {
  return /^[a-z]\.?$/i.test(token);
}

/**
 * Extracts ONLY first name(s) and last name(s), strictly removing all middle names
 * and middle initials (e.g. "T.", "E.", "Tan", "Santos" etc.).
 */
export function extractFirstAndLastName(fullName: string): {
  first: string;
  last: string;
} {
  if (!fullName) return { first: "cert", last: "" };
  const clean = fullName.trim();

  // 1. Handle "Lastname, Firstname Middle..." format
  if (clean.includes(",")) {
    const [lastNameRaw, ...rest] = clean.split(",");
    const afterComma = rest.join(" ").trim().split(/\s+/).filter(Boolean);
    const nonSuffix = afterComma.filter((t) => !SUFFIXES.has(t.toLowerCase()));

    if (nonSuffix.length === 0) {
      return { first: "cert", last: lastNameRaw.trim().toLowerCase() };
    }
    if (nonSuffix.length === 1) {
      return {
        first: nonSuffix[0].toLowerCase(),
        last: lastNameRaw.trim().toLowerCase(),
      };
    }
    if (nonSuffix.length === 2) {
      // e.g. "Alily T." or "Alily Tan" -> Alily is first, T./Tan is middle (dropped)
      return {
        first: nonSuffix[0].toLowerCase(),
        last: lastNameRaw.trim().toLowerCase(),
      };
    }
    // > 2 tokens after comma: find if any token is a middle initial
    const initialIdx = nonSuffix.findIndex(isMiddleInitial);
    if (initialIdx !== -1) {
      return {
        first: nonSuffix.slice(0, initialIdx).join(" ").toLowerCase(),
        last: lastNameRaw.trim().toLowerCase(),
      };
    }
    // Otherwise drop the last token after comma as middle name
    return {
      first: nonSuffix.slice(0, nonSuffix.length - 1).join(" ").toLowerCase(),
      last: lastNameRaw.trim().toLowerCase(),
    };
  }

  // 2. Standard format "First [Middle] Last [Suffix]"
  let tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return { first: tokens[0]?.toLowerCase() || "cert", last: "" };
  }

  // Strip trailing name suffixes (e.g. Jr, Sr, III)
  if (SUFFIXES.has(tokens[tokens.length - 1].toLowerCase())) {
    tokens = tokens.slice(0, tokens.length - 1);
  }
  if (tokens.length <= 1) {
    return { first: tokens[0]?.toLowerCase() || "cert", last: "" };
  }

  // Check if any token is a single-letter middle initial (e.g. "T.", "T", "E.", "P.")
  const initialIdx = tokens.findIndex(isMiddleInitial);
  if (initialIdx !== -1 && initialIdx > 0 && initialIdx < tokens.length) {
    const firstTokens = tokens.slice(0, initialIdx);
    const lastTokens = tokens.slice(initialIdx + 1);
    return {
      first: firstTokens.join(" ").toLowerCase(),
      last: lastTokens.join(" ").toLowerCase(),
    };
  }

  // If 2 tokens: [First, Last]
  if (tokens.length === 2) {
    return { first: tokens[0].toLowerCase(), last: tokens[1].toLowerCase() };
  }

  // If 3 tokens: [First, Middle, Last]
  if (tokens.length === 3) {
    // Check if middle token is a Spanish surname prefix (e.g. "Juan dela Cruz")
    if (SURNAME_PREFIXES.has(tokens[1].toLowerCase())) {
      return {
        first: tokens[0].toLowerCase(),
        last: tokens.slice(1).join(" ").toLowerCase(),
      };
    }
    // Otherwise tokens[1] is the middle name (e.g. "Alily Tan Lipio" -> First: Alily, Last: Lipio, Middle Tan dropped)
    return { first: tokens[0].toLowerCase(), last: tokens[2].toLowerCase() };
  }

  // If 4 tokens:
  if (tokens.length === 4) {
    // Check if tokens[2] is a surname prefix (e.g. "Juan Santos dela Cruz")
    if (SURNAME_PREFIXES.has(tokens[2].toLowerCase())) {
      // tokens[0] is First, tokens[1] is Middle (dropped), tokens[2..3] is Last
      return {
        first: tokens[0].toLowerCase(),
        last: tokens.slice(2).join(" ").toLowerCase(),
      };
    }
    // e.g. "Cherry Mae Santos Sago" -> First: "Cherry Mae", Middle: "Santos" (dropped), Last: "Sago"
    return {
      first: tokens.slice(0, 2).join(" ").toLowerCase(),
      last: tokens[3].toLowerCase(),
    };
  }

  // Fallback for > 4 tokens: first token is first, last is last
  return {
    first: tokens[0].toLowerCase(),
    last: tokens[tokens.length - 1].toLowerCase(),
  };
}

/**
 * Combines first name and last name into a clean filename (strictly NO middle names/initials).
 */
export function formatFilenameFromName(
  fullName: string,
  format: FilenameFormat = "firstlast"
): string {
  const { first, last } = extractFirstAndLastName(fullName);
  const cleanFirst = first.replace(/[^a-z0-9\s_-]/gi, "").trim();
  const cleanLast = last.replace(/[^a-z0-9\s_-]/gi, "").trim();

  if (!cleanLast) {
    return cleanFirst.replace(/[\s_-]+/g, "").toLowerCase() || "cert";
  }

  switch (format) {
    case "first_last":
      return `${cleanFirst.replace(/[\s_-]+/g, "_")}_${cleanLast.replace(/[\s_-]+/g, "_")}`.toLowerCase();
    case "first.last":
      return `${cleanFirst.replace(/[\s_-]+/g, ".")}.${cleanLast.replace(/[\s_-]+/g, ".")}`.toLowerCase();
    case "last_first":
      return `${cleanLast.replace(/[\s_-]+/g, "_")}_${cleanFirst.replace(/[\s_-]+/g, "_")}`.toLowerCase();
    case "firstlast":
    default:
      // Direct combination of firstname and lastname (e.g. alilylipio)
      return `${cleanFirst.replace(/[\s_-]+/g, "")}${cleanLast.replace(/[\s_-]+/g, "")}`.toLowerCase();
  }
}
