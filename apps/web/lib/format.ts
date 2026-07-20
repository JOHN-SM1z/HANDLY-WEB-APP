/** "80000" -> "80 000 so'm". Manual grouping — locale grouping chars aren't deterministic across environments. */
export function formatSom(amount: number): string {
  const grouped = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} so'm`;
}

export function formatSomRange(min: number, max: number): string {
  const grouped = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped(min)} – ${grouped(max)} so'm`;
}
