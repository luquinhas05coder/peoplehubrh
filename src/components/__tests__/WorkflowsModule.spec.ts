import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import WorkflowsModule from "../WorkflowsModule.vue"
import * as storeModule from "../../store"

const mockWorkflows = [
  {
    id: "wf_1",
    title: "Processo de Onboarding e Admissão",
    category: "Admissão",
    status: "em_andamento",
    employee_name: "Larissa Fernandes",
    total_steps: 4,
    completed_steps: 2,
    progress: 50,
    created_at: "2026-10-01",
  },
  {
    id: "wf_2",
    title: "Programação e Homologação de Férias",
    category: "Férias",
    status: "concluido",
    employee_name: "Gabriel Santos",
    total_steps: 3,
    completed_steps: 3,
    progress: 100,
    created_at: "2026-09-15",
  },
]

describe("WorkflowsModule.vue — Orquestração Visual de Processos de RH", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/workflows")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              workflows: mockWorkflows,
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
  })

  it("renderiza o cabeçalho, KPIs e as 3 colunas do quadro Kanban", async () => {
    const wrapper = mount(WorkflowsModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Workflows & Processos de RH")
    expect(wrapper.text()).toContain("Visual Kanban")
    expect(wrapper.text()).toContain("Em Andamento")
    expect(wrapper.text()).toContain("Concluídos")
    expect(wrapper.text()).toContain("Cancelados / Arquivados")
  })

  it("exibe os cartões de workflow distribuídos nas colunas corretas com progresso", async () => {
    const wrapper = mount(WorkflowsModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Processo de Onboarding e Admissão")
    expect(wrapper.text()).toContain("Larissa Fernandes")
    expect(wrapper.text()).toContain("50%")
    expect(wrapper.text()).toContain("Gabriel Santos")
    expect(wrapper.text()).toContain("100%")
  })

  it("permite filtrar por termo de busca no input", async () => {
    const wrapper = mount(WorkflowsModule)
    await flushPromises()

    const searchInput = wrapper.find("input[placeholder*='Buscar']")
    await searchInput.setValue("Larissa")

    expect(wrapper.text()).toContain("Larissa Fernandes")
    expect(wrapper.text()).not.toContain("Gabriel Santos")
  })

  it("abre o modal de novo processo ao clicar em 'Novo Processo'", async () => {
    const wrapper = mount(WorkflowsModule)
    await flushPromises()

    const newBtn = wrapper.findAll("button").find((b) => b.text().includes("Novo Processo"))
    expect(newBtn).toBeDefined()

    await newBtn!.trigger("click")
    expect(wrapper.text()).toContain("Abrir Novo Processo de RH")
    expect(wrapper.text()).toContain("Modelo Pré-definido:")
  })
})
