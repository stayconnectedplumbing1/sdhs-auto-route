export function availableForRouting<T extends { id: string }>(technicians: T[], offTechIds: string[]): T[] {
  const off = new Set(offTechIds);
  return technicians.filter(tech => !off.has(tech.id));
}
