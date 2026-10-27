import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import {
  showToast,
  activeToasts,
  apiFetch,
  isAuthenticated,
  currentUser,
  sessionToken,
  createOnboardingItem,
  toggleOnboardingStep,
  onboardingItems,
  PRESET_USERS,
} from "../../store"
import App from "../../App.vue"
import CorporateCalendarModule from "../CorporateCalendarModule.vue"

vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/" }),
  useRouter: () => ({ push: vi.fn() }),
}))

describe("State and Error Handling Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeToasts.value = []
    isAuthenticated.value = true
    currentUser.value = {
      ...PRESET_USERS.admin,
      permissions: ["calendar.manage", "calendar.view", "employees.view_all"],
    }
    sessionToken.value = "token_valid_123"

    onboardingItems.value = [
      {
        id: "onb-1",
        employeeName: "Colaborador Teste",
        employeeInitials: "CT",
        role: "Desenvolvedor",
        department: "Tecnologia",
        startDate: "01/01/2026",
        buddy: "Gestor RH",
        trackTitle: "Trilha Tech",
        status: "em_andamento",
        checklist: [
          { id: "s1", title: "Assinatura Contrato", completed: false, category: "rh" },
          { id: "s2", title: "Notebook", completed: false, category: "ti" },
        ],
      },
    ]
  })

  it("evita notificações duplicadas idênticas simultâneas e limita a 4 itens", () => {
    showToast("Erro ao processar", "error")
    showToast("Erro ao processar", "error") // Duplicado idêntico
    expect(activeToasts.value.length).toBe(1)

    showToast("Mensagem 2", "info")
    showToast("Mensagem 3", "warning")
    showToast("Mensagem 4", "success")
    expect(activeToasts.value.length).toBe(4)

    // O 5º deve remover o primeiro mais antigo
    showToast("Mensagem 5", "success")
    expect(activeToasts.value.length).toBe(4)
    expect(activeToasts.value.some((t) => t.title === "Mensagem 5")).toBe(true)
    expect(activeToasts.value.some((t) => t.title === "Erro ao processar")).toBe(false)
  })

  it("intercepta erro 401 em rotas de aplicação, encerrando sessão e notificando usuário", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ ok: false, error: "Token expirado" }),
      })
    )

    expect(isAuthenticated.value).toBe(true)
    await apiFetch("/api/employees")

    expect(isAuthenticated.value).toBe(false)
    expect(currentUser.value).toBeNull()
    expect(sessionToken.value).toBe("")
    expect(activeToasts.value.some((t) => t.title.includes("sessão expirou"))).toBe(true)
  })

  it("não corrompe o estado local se a criação de onboarding falhar na API", async () => {
    const initialCount = onboardingItems.value.length

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        json: async () => ({ ok: false, error: "Falha interna no banco" }),
      })
    )

    const result = await createOnboardingItem({
      employeeName: "Novo Teste",
      employeeInitials: "NT",
      role: "Desenvolvedor",
      department: "Tecnologia",
      startDate: "2026-10-26",
      buddy: "Mentor",
      trackTitle: "Trilha Tech",
    })

    expect(result).toBeNull()
    expect(onboardingItems.value.length).toBe(initialCount)
    expect(activeToasts.value.some((t) => t.type === "error")).toBe(true)
  })

  it("reverte o estado da etapa de onboarding se a requisição de patch falhar", async () => {
    const item = onboardingItems.value[0]
    expect(item).toBeDefined()
    const step = item.checklist[0]
    const initialCompleted = step.completed

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        json: async () => ({ ok: false }),
      })
    )

    const success = await toggleOnboardingStep(item.id, step.id)
    expect(success).toBe(false)
    expect(step.completed).toBe(initialCompleted)
    expect(activeToasts.value.some((t) => t.type === "error")).toBe(true)
  })

  it("valida intervalo de datas no Calendário e bloqueia evento com data final anterior à inicial", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, events: [] }),
      })
    )

    const wrapper = mount(CorporateCalendarModule)
    await flushPromises()

    // Abre o modal de agendamento
    const addBtn = wrapper.findAll("button").find((b) => b.text().includes("Agendar Evento"))
    expect(addBtn).toBeDefined()
    await addBtn!.trigger("click")
    await flushPromises()

    // Preenche título
    const titleInput = wrapper.find("input[placeholder*='Treinamento']")
    expect(titleInput.exists()).toBe(true)
    await titleInput.setValue("Reunião Estratégica")

    // Define data final anterior à data inicial
    const dateInputs = wrapper.findAll("input[type='date']")
    expect(dateInputs.length).toBeGreaterThanOrEqual(2)
    await dateInputs[0].setValue("2026-12-10")
    await dateInputs[1].setValue("2026-12-01")

    const saveBtn = wrapper.findAll("button").find((b) => b.text().includes("Salvar no Calendário"))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger("click")
    await flushPromises()

    expect(activeToasts.value.some((t) => t.title.includes("A data final não pode ser anterior"))).toBe(true)
  })

  it("gerencia eventos de perda e restabelecimento de conexão em App.vue", async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          NavRail: true,
          HomeWorkspace: true,
          ChatPanel: true,
          LoginPage: true,
          MfaVerification: true,
          FirstLoginPasswordModal: true,
          PublicJobsPage: true,
        },
      },
    })
    await flushPromises()

    // Simula evento offline
    window.dispatchEvent(new Event("offline"))
    await flushPromises()

    expect(wrapper.text()).toContain("Você está desconectado")
    expect(activeToasts.value.some((t) => t.type === "warning" && t.title.includes("offline"))).toBe(true)

    // Simula evento online
    window.dispatchEvent(new Event("online"))
    await flushPromises()

    expect(wrapper.text()).not.toContain("Você está desconectado")
    expect(activeToasts.value.some((t) => t.type === "success" && t.title.includes("restabelecida"))).toBe(true)
  })
})
