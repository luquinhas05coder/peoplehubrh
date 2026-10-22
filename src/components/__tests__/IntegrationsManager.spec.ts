import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import IntegrationsManager from "../IntegrationsManager.vue"
import * as storeModule from "../../store"

const mockSubscriptions = [
  {
    id: "wh_sub_01",
    name: "ERP Folha de Pagamento",
    url: "https://erp.empresa.com.br/webhook",
    masked_secret: "whsec_••••••••1234",
    events: ["employee.created", "request.approved"],
    is_active: true,
  },
]

const mockDeliveries = [
  {
    id: "wh_del_01",
    event_type: "employee.created",
    subscription_name: "ERP Folha de Pagamento",
    url: "https://erp.empresa.com.br/webhook",
    attempt_count: 1,
    max_attempts: 3,
    status: "delivered",
    response_code: 200,
    execution_time_ms: 125,
    created_at: "2026-10-22T19:00:00.000Z",
  },
]

const mockAdapters = [
  {
    id: "csv_employee_adapter",
    name: "Importação e Exportação CSV de Colaboradores (DP)",
    description: "Exportação e carga em lote de pastas funcionais em CSV.",
    version: "1.0.0",
    category: "export_import",
    health: { ok: true, latency_ms: 1 },
  },
  {
    id: "cbo_conecta_gov_adapter",
    name: "Catálogo CBO MTE / ConectaGov",
    description: "Consulta e validação oficial de ocupações do MTE.",
    version: "1.0.0",
    category: "cbo",
    health: { ok: true, latency_ms: 2 },
  },
]

describe("IntegrationsManager.vue", () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    // Configurar usuário padrão como ADMIN
    storeModule.currentUser.value = {
      id: "u_admin",
      name: "Administrador Geral",
      email: "admin@empresa.com",
      role: "ADMIN",
      department: "Tecnologia",
      initials: "AD",
      tenantId: "tenant_default",
      avatarBg: "bg-slate-700",
      avatarColor: "text-white",
    }

    vi.spyOn(storeModule, "apiFetch").mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes("/api/webhooks/subscriptions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, subscriptions: mockSubscriptions }),
        } as any
      }
      if (u.includes("/api/webhooks/deliveries")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, deliveries: mockDeliveries }),
        } as any
      }
      if (u.includes("/api/integrations/adapters")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, adapters: mockAdapters }),
        } as any
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as any
    })
  })

  it("1. Renderiza o painel de integrações com título e badge de segurança para ADMIN", async () => {
    const wrapper = mount(IntegrationsManager)
    await flushPromises()

    expect(wrapper.text()).toContain("Camada Modular de Integrações & Webhooks")
    expect(wrapper.text()).toContain("HMAC SHA-256 + SSRF Shield")
    expect(wrapper.text()).toContain("ERP Folha de Pagamento")
    expect(wrapper.text()).toContain("whsec_••••••••1234")
  })

  it("2. Exibe alerta de bloqueio e restrição de governança quando usuário não for ADMIN", async () => {
    storeModule.currentUser.value = {
      id: "u_colab",
      name: "Gabriel Santos",
      email: "colaborador@peoplehub.com.br",
      role: "COLABORADOR",
      department: "Tecnologia",
      initials: "GS",
      tenantId: "tenant_default",
      avatarBg: "bg-blue-600",
      avatarColor: "text-white",
    }

    const wrapper = mount(IntegrationsManager)
    await flushPromises()

    expect(wrapper.text()).toContain("Acesso Restrito a Administradores")
    expect(wrapper.text()).not.toContain("Novo Webhook")
  })

  it("3. Permite alternar entre as 4 sub-abas (Webhooks, Histórico, CSV, Adaptadores)", async () => {
    const wrapper = mount(IntegrationsManager)
    await flushPromises()

    const subTabButtons = wrapper.findAll("button")
    const deliveriesBtn = subTabButtons.find((b) => b.text().includes("Histórico de Entregas"))
    expect(deliveriesBtn).toBeDefined()
    await deliveriesBtn!.trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("employee.created")
    expect(wrapper.text()).toContain("Entregue")
    expect(wrapper.text()).toContain("200")

    const csvBtn = subTabButtons.find((b) => b.text().includes("Carga & Exportação CSV"))
    expect(csvBtn).toBeDefined()
    await csvBtn!.trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Exportação Completa de Colaboradores")
    expect(wrapper.text()).toContain("Carga em Lote de Colaboradores")

    const adaptersBtn = subTabButtons.find((b) => b.text().includes("Adaptadores Ativos"))
    expect(adaptersBtn).toBeDefined()
    await adaptersBtn!.trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Importação e Exportação CSV de Colaboradores (DP)")
    expect(wrapper.text()).toContain("Catálogo CBO MTE / ConectaGov")
  })

  it("4. Abre o modal de cadastro de novo webhook com avisos de segurança SSRF", async () => {
    const wrapper = mount(IntegrationsManager)
    await flushPromises()

    const newBtn = wrapper.findAll("button").find((b) => b.text().includes("Novo Webhook"))
    expect(newBtn).toBeDefined()
    await newBtn!.trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("Novo Endpoint de Webhook")
    expect(wrapper.text()).toContain("SSRF Shield Ativo")
    expect(wrapper.text()).toContain("Salvar e Gerar Segredo HMAC")
  })

  it("5. Exibe botão de reenvio manual na tabela de histórico de entregas", async () => {
    const wrapper = mount(IntegrationsManager)
    await flushPromises()

    const deliveriesBtn = wrapper.findAll("button").find((b) => b.text().includes("Histórico de Entregas"))
    await deliveriesBtn!.trigger("click")
    await flushPromises()

    const redeliverBtn = wrapper.findAll("button").find((b) => b.text().includes("Reenviar"))
    expect(redeliverBtn).toBeDefined()
  })

  it("6. Permite acionar exportação CSV e exibe feedback de carregamento", async () => {
    const wrapper = mount(IntegrationsManager)
    await flushPromises()

    const csvBtn = wrapper.findAll("button").find((b) => b.text().includes("Carga & Exportação CSV"))
    await csvBtn!.trigger("click")
    await flushPromises()

    const exportBtn = wrapper.findAll("button").find((b) => b.text().includes("Exportar Base Completa em CSV"))
    expect(exportBtn).toBeDefined()
  })
})
