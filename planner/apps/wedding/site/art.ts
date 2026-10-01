// Illustrative hero artwork: seating chart with six round tables and a head table.
const W = 572, H = 452;
const seat = (cls: string, x: number, y: number) => `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>`;

function table(cx: number, cy: number, n: number, groups: string[]): string {
  const seats = groups.map((g, i) => {
    const a = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
    return seat(g, cx + Math.cos(a) * 55, cy + Math.sin(a) * 55);
  });
  return `<circle class="tbl" cx="${cx}" cy="${cy}" r="36"/>${seats.join("")}<text class="t-strong" x="${cx}" y="${cy + 5}" text-anchor="middle">${n}</text>`;
}

export function weddingHeroSvg(): string {
  const parts: string[] = [];
  // head table
  parts.push(`<rect class="tbl" x="176" y="20" width="220" height="30" rx="8"/><text class="t-strong" x="286" y="40" text-anchor="middle">Head table</text>`);
  [0, 1, 2, 3, 4, 5].forEach((i) => parts.push(seat(i < 2 ? "g1" : i < 4 ? "g2" : "g1", 206 + i * 32, 66)));
  // tables
  const T: [number, number, string[]][] = [
    [100, 170, ["g1", "g1", "g1", "g1", "g1", "g3", "g3", "g1"]],
    [286, 170, ["g2", "g2", "g2", "g2", "g2", "g2", "g4", "g4"]],
    [472, 170, ["g3", "g3", "g3", "g3", "g3", "g3", "g3", "g3"]],
    [100, 335, ["g4", "g4", "g4", "g4", "g4", "g4", "g2", "g2"]],
    [286, 335, ["g3", "g3", "g1", "g1", "g1", "g1", "g1", "g3"]],
    [472, 335, ["g2", "g2", "g2", "g2", "g4", "g4", "g4", "g4"]],
  ];
  T.forEach(([x, y, g], i) => parts.push(table(x, y, i + 1, g)));
  // together (solid) and apart (dashed) markers
  parts.push(`<path class="togeth" d="M ${100 + 55 * Math.cos(-Math.PI / 2)} ${170 - 55} Q 120 ${170 - 40} ${100 + 55 * Math.cos(-Math.PI / 4)} ${170 + 55 * Math.sin(-Math.PI / 4)}"/>`);
  parts.push(`<path class="apart" d="M 150 150 L 232 150"/>`);
  parts.push(`<text x="191" y="143" text-anchor="middle">keep apart</text>`);
  // result badge
  parts.push(`<rect class="badge" x="${W / 2 - 110}" y="${H - 44}" width="220" height="32" rx="16"/><text class="badge-t" x="${W / 2}" y="${H - 22}" text-anchor="middle">12 of 12 rules met</text>`);
  return `<svg class="art" viewBox="0 0 ${W} ${H}" role="img" aria-label="Wedding seating chart with a head table and six round tables, guests coloured by group; every seating rule is met">${parts.join("")}</svg><div class="legend"><span><i class="g1i"></i>Family A</span><span><i class="g2i"></i>Family B</span><span><i class="g3i"></i>Friends</span><span><i class="g4i"></i>Colleagues</span></div>`;
}
