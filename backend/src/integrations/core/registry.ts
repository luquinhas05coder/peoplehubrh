/**
 * integrations/core/registry.ts — Registro Central de Adaptadores de Integração
 */

import type { IntegrationAdapter, IntegrationConnectionResult } from "./types.js"
import { csvEmployeeAdapter } from "../adapters/csv_employee.adapter.js"
import { cboAdapter } from "../adapters/cbo.adapter.js"

class IntegrationRegistry {
  private adapters = new Map<string, IntegrationAdapter>()

  constructor() {
    this.register(csvEmployeeAdapter)
    this.register(cboAdapter)
  }

  register(adapter: IntegrationAdapter) {
    this.adapters.set(adapter.id, adapter)
  }

  get(id: string): IntegrationAdapter | undefined {
    return this.adapters.get(id)
  }

  list(): Array<{
    id: string
    name: string
    description: string
    version: string
    category: string
  }> {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      version: a.version,
      category: a.category,
    }))
  }

  async testAll(): Promise<Record<string, IntegrationConnectionResult>> {
    const results: Record<string, IntegrationConnectionResult> = {}
    for (const [id, adapter] of this.adapters.entries()) {
      try {
        results[id] = await adapter.testConnection()
      } catch (err: any) {
        results[id] = { ok: false, message: err.message }
      }
    }
    return results
  }
}

export const integrationRegistry = new IntegrationRegistry()
