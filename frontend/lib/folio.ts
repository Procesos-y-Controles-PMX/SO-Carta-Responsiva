function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function generarFolio(prefijo: string, now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  const rnd = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");

  return `${prefijo.toUpperCase()}-${yyyy}${mm}${dd}-${hh}${min}${ss}${ms}${rnd}`;
}
