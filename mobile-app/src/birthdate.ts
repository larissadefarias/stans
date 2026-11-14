/** Enquanto digita: "15032010" -> "15/03/2010" (só números, barras automáticas). */
export function maskDate(text: string) {
  const d = text.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
}

/** "15/03/2010" -> "2010-03-15" (o servidor confere se a data existe e a idade mínima). */
export function toIsoDate(text: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
