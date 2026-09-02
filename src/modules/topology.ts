import type { Module } from './types'

export function sortModules(modules: Module[]): Module[] {
  const byId = new Map(modules.map((module) => [module.id, module]))
  const visited = new Set<string>()
  const active = new Set<string>()
  const result: Module[] = []

  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return
    if (active.has(id)) {
      const cycleStart = path.indexOf(id)
      const cycle = [...path.slice(cycleStart), id]
      throw new Error(`Circular module dependency: ${cycle.join(' -> ')}`)
    }

    const module = byId.get(id)
    if (!module) return

    active.add(id)
    for (const dependency of module.dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(
          `Module "${id}" requires disabled or missing module "${dependency}"`,
        )
      }
      visit(dependency, [...path, id])
    }
    active.delete(id)
    visited.add(id)
    result.push(module)
  }

  for (const module of modules) visit(module.id, [])
  return result
}
