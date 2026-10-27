import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import CorporateCalendarModule from "../CorporateCalendarModule.vue"
import * as storeModule from "../../store"

const mockEvents = [
  {
    id: "cal_1",
    title: "Treinamento de Liderança e Feedback",
    category: "treinamento",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    department: "RH",
    location: "Auditório Principal",
  },
  {
    id: "req_vac_1",
    title: "Férias Aprovadas: Mariana Alcantara",
    category: "ferias",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    department: "RH",
  },
]

describe("CorporateCalendarModule.vue — Calendário Corporativo Integrado", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/calendar/events")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              events: mockEvents,
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
  })

  it("renderiza o cabeçalho, dias da semana e mês atual", async () => {
    const wrapper = mount(CorporateCalendarModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Calendário Corporativo Integrado")
    expect(wrapper.text()).toContain("Dom")
    expect(wrapper.text()).toContain("Seg")
    expect(wrapper.text()).toContain("Sex")
    expect(wrapper.text()).toContain("Hoje")
  })

  it("exibe eventos corporativos do dia no painel lateral", async () => {
    const wrapper = mount(CorporateCalendarModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Treinamento de Liderança e Feedback")
    expect(wrapper.text()).toContain("Férias Aprovadas: Mariana Alcantara")
  })

  it("permite abrir o modal de 'Agendar Evento'", async () => {
    const wrapper = mount(CorporateCalendarModule)
    await flushPromises()

    const addBtn = wrapper.findAll("button").find((b) => b.text().includes("Agendar Evento"))
    expect(addBtn).toBeDefined()

    await addBtn!.trigger("click")
    expect(wrapper.text()).toContain("Agendar Evento Corporativo")
    expect(wrapper.text()).toContain("Título do Evento *")
  })
})
