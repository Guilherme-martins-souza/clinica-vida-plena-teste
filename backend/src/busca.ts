// Busca por trecho do nome sem diferenciar maiúsculas nem acentos: "joao" encontra "João".

// Cada letra sem acento vira uma classe com as versões acentuadas dela.
const VARIACOES: Record<string, string> = {
  a: '[aáàâãä]',
  e: '[eéèêë]',
  i: '[iíìîï]',
  o: '[oóòôõö]',
  u: '[uúùûü]',
  c: '[cç]',
};

// Tira acentos: "Conceição" → "Conceicao".
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Escapa os caracteres que têm significado na regex ("a.b" procura o ponto, não "qualquer letra").
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function regexDeBusca(texto: string): RegExp {
  const padrao = escapar(semAcento(texto.trim().toLowerCase())).replace(/[aeiouc]/g, (letra) => VARIACOES[letra]);
  return new RegExp(padrao, 'i');
}
