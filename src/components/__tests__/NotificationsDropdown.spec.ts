import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import NotificationsDropdown from "../NotificationsDropdown.vue"
import * as storeModule from "../../store"

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const mockNotifications = [
  {
    id: "notif_1",
    title: "Nova Etapa de Workflow",
    description: "Você é o responsável pela etapa de Admissão.",
    category: "workflow",
    priority: "alta",
    link: "/workflows",
    read: false,
    created_at: "2026-10-27T10:00:00Z",
  },
  {
    id: "notif_2",
    title: "Ciclo de Desempenho Aberto",
    description: "Avaliação 2026.1 disponível.",
    category: "performance",
    priority: "media",
    link: "/desempenho",
    read: true,
    created_at: "2026-10-26T10:00:00Z",
  },
]

describe("NotificationsDropdown.vue — Central de Notificações", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/notifications")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              notifications: mockNotifications,
              unreadCount: 1,
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        })
      })
    )
  })

  it("renderiza o botão com atributos de acessibilidade e contador não lido", async () => {
    const wrapper = mount(NotificationsDropdown, {
      props: { placement: "rail" },
    })
    await flushPromises()

    const btn = wrapper.find("button[aria-label='Notificações do Sistema']")
    expect(btn.exists()).toBe(true)
    expect(btn.attributes("aria-expanded")).toBe("false")
    expect(wrapper.text()).toContain("1") // badge unreadCount
  })

  it("abre o dropdown ao clicar no botão e fecha ao clicar novamente", async () => {
    const wrapper = mount(NotificationsDropdown, {
      props: { placement: "rail" },
    })
    await flushPromises()

    const btn = wrapper.find("button[aria-label='Notificações do Sistema']")
    expect(wrapper.find("[role='dialog']").exists()).toBe(false)

    // Abre
    await btn.trigger("click")
    expect(wrapper.find("[role='dialog']").exists()).toBe(true)
    expect(btn.attributes("aria-expanded")).toBe("true")
    expect(wrapper.text()).toContain("Nova Etapa de Workflow")

    // Fecha ao clicar novamente
    await btn.trigger("click")
    expect(wrapper.find("[role='dialog']").exists()).toBe(false)
    expect(btn.attributes("aria-expanded")).toBe("false")
  })

  it("fecha o dropdown com a tecla Escape", async () => {
    const wrapper = mount(NotificationsDropdown, {
      props: { placement: "rail" },
      attachTo: document.body,
    })
    await flushPromises()

    const btn = wrapper.find("button[aria-label='Notificações do Sistema']")
    await btn.trigger("click")
    expect(wrapper.find("[role='dialog']").exists()).toBe(true)

    // Dispara Escape no document
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find("[role='dialog']").exists()).toBe(false)
    wrapper.unmount()
  })

  it("fecha o dropdown ao clicar no botão X", async () => {
    const wrapper = mount(NotificationsDropdown, {
      props: { placement: "rail" },
    })
    await flushPromises()

    const btn = wrapper.find("button[aria-label='Notificações do Sistema']")
    await btn.trigger("click")
    expect(wrapper.find("[role='dialog']").exists()).toBe(true)

    const closeBtn = wrapper.find("button[aria-label='Fechar notificações']")
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger("click")

    expect(wrapper.find("[role='dialog']").exists()).toBe(false)
  })

  it("permite coexistência de duas instâncias (header e rail) sem conflito de fechamento", async () => {
    const wrapperHeader = mount(NotificationsDropdown, {
      props: { placement: "header" },
      attachTo: document.body,
    })
    const wrapperRail = mount(NotificationsDropdown, {
      props: { placement: "rail" },
      attachTo: document.body,
    })
    await flushPromises()

    const btnRail = wrapperRail.find("button[aria-label='Notificações do Sistema']")
    await btnRail.trigger("click")

    // O dropdown do Rail deve estar aberto
    expect(wrapperRail.find("[role='dialog']").exists()).toBe(true)
    // O dropdown do Header deve permanecer fechado
    expect(wrapperHeader.find("[role='dialog']").exists()).toBe(false)

    wrapperHeader.unmount()
    wrapperRail.unmount()
  })
})
