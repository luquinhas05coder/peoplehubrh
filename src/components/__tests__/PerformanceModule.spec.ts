import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import PerformanceModule from "../PerformanceModule.vue"
import * as storeModule from "../../store"

const mockCycles = [
  {
    id: "cycle_2026",
    title: "Ciclo Anual 2026 - Competências e Metas",
    status: "em_andamento",
    criteria: [
      { id: "crit_1", name: "Entrega de Resultados & Foco", weight: 2.0, category: "Técnica" },
      { id: "crit_2", name: "Comunicação Assertiva", weight: 1.0, category: "Comportamental" },
    ],
  },
]

const mockGoals = [
  {
    id: "goal_1",
    title: "Reduzir SLA de Atendimento",
    metric_target: "Tempo médio inferior a 8 minutos",
    current_progress: 60,
    status: "em_progresso",
  },
]

describe("PerformanceModule.vue — Avaliação de Desempenho e Metas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/performance/cycles")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, cycles: mockCycles }),
          })
        }
        if (url.includes("/api/performance/goals")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, goals: mockGoals }),
          })
        }
        if (url.includes("/api/performance/evaluations")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, evaluations: [] }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
  })

  it("renderiza o cabeçalho, seletor de ciclo e abas de navegação", async () => {
    const wrapper = mount(PerformanceModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Avaliação de Desempenho & Metas")
    expect(wrapper.text()).toContain("Ciclo Anual 2026")
    expect(wrapper.text()).toContain("Minhas Avaliações")
    expect(wrapper.text()).toContain("Metas & OKRs")
  })

  it("alterna para a aba de Metas e exibe os itens cadastrados com progresso", async () => {
    const wrapper = mount(PerformanceModule)
    await flushPromises()

    const metasTab = wrapper.findAll("button").find((b) => b.text().includes("Metas & OKRs"))
    expect(metasTab).toBeDefined()

    await metasTab!.trigger("click")
    expect(wrapper.text()).toContain("Reduzir SLA de Atendimento")
    expect(wrapper.text()).toContain("60%")
  })

  it("abre o formulário de autoavaliação com cálculo de média ponderada", async () => {
    const wrapper = mount(PerformanceModule)
    await flushPromises()

    const autoEvalBtn = wrapper.findAll("button").find((b) => b.text().includes("Minha Autoavaliação"))
    expect(autoEvalBtn).toBeDefined()

    await autoEvalBtn!.trigger("click")
    expect(wrapper.text()).toContain("Formulário de Autoavaliação")
    expect(wrapper.text()).toContain("Entrega de Resultados & Foco")
    expect(wrapper.text()).toContain("Comunicação Assertiva")
    expect(wrapper.text()).toContain("Média Ponderada Atual:")
  })
})
