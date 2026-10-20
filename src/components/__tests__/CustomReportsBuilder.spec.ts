import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import CustomReportsBuilder from "../CustomReportsBuilder.vue"
import * as storeModule from "../../store"

const mockQueryRows = [
  {
    name: "Mariana Alcantara",
    role: "Analista de RH",
    department: "RH",
    status: "Ativo",
    hireDate: "2023-01-15",
  },
  {
    name: "Gabriel Santos",
    role: "Desenvolvedor",
    department: "TI",
    status: "Ativo",
    hireDate: "2023-05-10",
  },
]

describe("CustomReportsBuilder.vue — Construtor Dinâmico de Relatórios de RH", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/reports/custom/query")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              total: 2,
              columns: ["name", "role", "department", "status", "hireDate"],
              rows: mockQueryRows,
            }),
          })
        }
        if (url.includes("/api/reports/custom/saved")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, reports: [] }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
  })

  it("renderiza o construtor dinâmico com fontes de dados e seleção de colunas", async () => {
    const wrapper = mount(CustomReportsBuilder, {
      global: { stubs: { Bar: true, Doughnut: true } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain("Construtor Dinâmico de Relatórios de RH")
    expect(wrapper.text()).toContain("Fonte de Dados (Tabela):")
    expect(wrapper.text()).toContain("Colunas Exibidas no Resultado:")
    expect(wrapper.text()).toContain("Nome Completo")
    expect(wrapper.text()).toContain("Cargo / Função")
  })

  it("executa a consulta e renderiza a tabela de resultados com os registros", async () => {
    const wrapper = mount(CustomReportsBuilder, {
      global: { stubs: { Bar: true, Doughnut: true } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain("Mariana Alcantara")
    expect(wrapper.text()).toContain("Gabriel Santos")
    expect(wrapper.text()).toContain("Resultado da Consulta Personalizada (2 linhas)")
  })

  it("permite adicionar uma condição de filtro dinâmico", async () => {
    const wrapper = mount(CustomReportsBuilder, {
      global: { stubs: { Bar: true, Doughnut: true } },
    })
    await flushPromises()

    const addFilterBtn = wrapper.findAll("button").find((b) => b.text().includes("Adicionar Condição"))
    expect(addFilterBtn).toBeDefined()

    await addFilterBtn!.trigger("click")
    expect(wrapper.text()).toContain("Igual (=)")
  })

  it("permite acionar a exportação em CSV", async () => {
    const wrapper = mount(CustomReportsBuilder, {
      global: { stubs: { Bar: true, Doughnut: true } },
    })
    await flushPromises()

    const exportBtn = wrapper.findAll("button").find((b) => b.text().includes("Exportar CSV"))
    expect(exportBtn).toBeDefined()
    expect(exportBtn!.attributes("disabled")).toBeUndefined()
  })
})
