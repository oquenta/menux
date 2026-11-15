// src/lib/codes.ts — código de pedido 5 caracteres sin ambiguos
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I,O,0,1
export function generarCodigo(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
