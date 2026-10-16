// Matiz estável a partir do nome: cada jogador mantém a mesma cor em todas as telas
export function hue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// Cor do degrau da rampa (1 a 100) correspondente a um número
export function rampVar(n) {
  const step = Math.min(10, Math.max(1, Math.ceil(n / 10)));
  return `var(--r${step})`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
