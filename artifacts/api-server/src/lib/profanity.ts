const OFFENSIVE_WORDS: string[] = [
  // Slurs LGBTQ+
  "viado", "viadao", "viadinho", "viada",
  "bicha", "bichinha",
  // Sexual / obscene
  "caralho", "porra", "buceta", "xoxota",
  "cuzao", "cuzinho", "cu",
  "piroca", "pica", "rola", "pau",
  "foda", "fode", "foder", "fodase", "foda-se",
  "gozar", "gozo",
  // Insults / aggression
  "filho da puta", "filho de puta", "filha da puta",
  "fdp", "fds",
  "vai tomar no cu", "vtnc", "vtc",
  "vai se foder", "vsf",
  "vai se lascar", "vsl",
  "merda", "bosta",
  "puta", "puto", "putinha",
  "putaria",
  "vagabundo", "vagabunda",
  "safado", "safada",
  // Cognitive/ableist insults
  "imbecil", "retardado", "retardada",
  "idiota", "cretino", "cretina",
  "mongol", "mongolico",
  "burro", // contextual but common insult
  // Racial slurs (PT-BR)
  "crioulo", "macaco",
  // English slurs
  "nigger", "nigga", "faggot", "fag",
  "bitch", "motherfucker", "asshole", "bastard",
  "fuck", "shit", "cunt", "dick", "pussy",
  "whore", "slut",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[4@]/g, "a")
    .replace(/3/g, "e")
    .replace(/1|!/g, "i")
    .replace(/0/g, "o")
    .replace(/5|\$/g, "s")
    .replace(/8/g, "b")
    .replace(/\*/g, "")
    .replace(/_/g, "");
}

export function containsProfanity(text: string): boolean {
  const norm = normalize(text);
  for (const word of OFFENSIVE_WORDS) {
    const normWord = normalize(word);
    const pattern = new RegExp(`(^|\\W)${normWord.replace(/\s+/g, "\\s*")}(\\W|$)`, "i");
    if (pattern.test(norm)) return true;
  }
  return false;
}
