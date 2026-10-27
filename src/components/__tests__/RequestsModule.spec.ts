import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import RequestsModule from "../RequestsModule.vue"
import * as storeModule from "../../store"

const mockRequests = [
  {
    id: "req-colab-1",
    protocol: "REQ-2026-001",
    employeeName: "Gabriel Santos",
    employeeInitials: "GS",
    employeeRole: "Desenvolvedor Full-Stack",
    department: "TI",
    type: "ferias",
    title: "Férias Regulamentares",
    description: "Solicitação de férias de 15 dias para novembro.",
    status: "pendente",
    priority: "media",
    createdAt: "22/10/2026",
  },
  {
    id: "req-other-2",
    protocol: "REQ-2026-002",
    employeeName: "Ana Beatriz Souza",
    employeeInitials: "AB",
    employeeRole: "Analista Financeira",
    department: "Financeiro",
    type: "reembolso",
    title: "Reembolso de Viagem",
    description: "Despesas de transporte e alimentação em cliente.",
    status: "aprovado",
    priority: "alta",
    amount: "R$ 450,00",
    createdAt: "20/10/2026",
  },
  {
    id: "req-other-3",
    protocol: "REQ-2026-003",
    employeeName: "Carlos Eduardo Souza",
    employeeInitials: "CS",
    employeeRole: "Especialista em DP",
    department: "Departamento Pessoal",
    type: "atestado",
    title: "Atestado Médico 2 Dias",
    description: "Atestado médico por consulta oftalmológica.",
    status: "pendente",
    priority: "urgente",
    createdAt: "21/10/2026",
  },
]

describe("RequestsModule.vue — Isolamento de Solicitações por Escopo RBAC", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, requests: [] }),
    } as any)
  })

  it("1. Colaborador visualiza estritamente suas próprias solicitações e não as de terceiros", async () => {
    storeModule.currentUser.value = {
      id: "usr_colab",
      name: "Gabriel Santos",
      email: "colaborador@peoplehub.com.br",
      role: "Desenvolvedor de Software",
      userRole: "COLABORADOR",
      roleType: "colaborador",
      department: "TI",
      tenantId: "tenant_default",
    } as any

    storeModule.requests.value = [...(mockRequests as any)]

    const wrapper = mount(RequestsModule)
    await flushPromises()

    const text = wrapper.text()
    // Deve conter a solicitação própria de Gabriel Santos
    expect(text).toContain("REQ-2026-001")
    expect(text).toContain("Férias Regulamentares")

    // NÃO deve conter as solicitações de Ana Beatriz nem de Carlos Eduardo
    expect(text).not.toContain("REQ-2026-002")
    expect(text).not.toContain("Reembolso de Viagem")
    expect(text).not.toContain("Ana Beatriz Souza")
    expect(text).not.toContain("REQ-2026-003")
    expect(text).not.toContain("Carlos Eduardo Souza")
  })

  it("2. Indicadores do cabeçalho refletem apenas a contagem do escopo do Colaborador", async () => {
    storeModule.currentUser.value = {
      id: "usr_colab",
      name: "Gabriel Santos",
      email: "colaborador@peoplehub.com.br",
      role: "COLABORADOR",
      userRole: "COLABORADOR",
      roleType: "colaborador",
      department: "TI",
      tenantId: "tenant_default",
    } as any

    storeModule.requests.value = [...(mockRequests as any)]

    const wrapper = mount(RequestsModule)
    await flushPromises()

    // Gabriel Santos tem apenas 1 solicitação (pendente). Total deve ser 1, não 3.
    const text = wrapper.text()
    expect(text).toContain("1")
    expect(text).not.toContain("3")
  })

  it("3. Gestor visualiza solicitações do seu departamento (TI) e as suas próprias", async () => {
    storeModule.currentUser.value = {
      id: "usr_gestor",
      name: "Gestor TI",
      email: "gestor@peoplehub.com.br",
      role: "GESTOR",
      userRole: "GESTOR",
      roleType: "rh",
      department: "TI",
      tenantId: "tenant_default",
    } as any

    storeModule.requests.value = [...(mockRequests as any)]

    const wrapper = mount(RequestsModule)
    await flushPromises()

    const text = wrapper.text()
    // Vê solicitação do liderado Gabriel Santos (TI)
    expect(text).toContain("REQ-2026-001")
    expect(text).toContain("Gabriel Santos")

    // Não vê solicitações de outros departamentos (Financeiro, DP)
    expect(text).not.toContain("REQ-2026-002")
    expect(text).not.toContain("Ana Beatriz Souza")
    expect(text).not.toContain("Carlos Eduardo Souza")
  })

  it("4. Usuário de RH ou ADMIN visualiza todas as solicitações corporativas", async () => {
    storeModule.currentUser.value = {
      id: "usr_rh",
      name: "Mariana Alcantara",
      email: "rh@peoplehub.com.br",
      role: "RH",
      userRole: "RH",
      roleType: "rh",
      department: "Recursos Humanos",
      tenantId: "tenant_default",
    } as any

    storeModule.requests.value = [...(mockRequests as any)]

    const wrapper = mount(RequestsModule)
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain("REQ-2026-001")
    expect(text).toContain("REQ-2026-002")
    expect(text).toContain("REQ-2026-003")
    expect(text).toContain("Gabriel Santos")
    expect(text).toContain("Ana Beatriz Souza")
    expect(text).toContain("Carlos Eduardo Souza")
  })
})
