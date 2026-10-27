import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import DashboardView from "../DashboardView.vue"
import * as storeModule from "../../store"

const mockDashboardData = {
  ok: true,
  totalFuncionarios: 42,
  funcionariosAtivos: 39,
  funcionariosInativos: 3,
  contratacoesMes: 5,
  desligamentosMes: 1,
  solicitacoesPendentes: 7,
  feriasPendentes: 2,
  documentosVencendo: 4,
  funcionariosPorDepartamento: [
    { departamento: "Tecnologia", total: 18 },
    { departamento: "Recursos Humanos", total: 6 },
    { departamento: "Operações", total: 18 },
  ],
  contratacoesPorMes: [
    { mes: "Jan", total: 2 },
    { mes: "Fev", total: 3 },
  ],
  desligamentosPorMes: [
    { mes: "Jan", total: 0 },
    { mes: "Fev", total: 1 },
  ],
  funcionariosPorStatus: [
    { status: "Ativo", total: 39 },
    { status: "Inativo", total: 3 },
  ],
}

describe("DashboardView.vue — Métricas, KPIs e Indicadores em Tempo Real", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exibe estado de carregamento inicial enquanto busca dados na API", async () => {
    let resolveFetch: (val: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })

    vi.spyOn(storeModule, "apiFetch").mockReturnValueOnce(pendingPromise as any)

    const wrapper = mount(DashboardView, {
      global: {
        stubs: { Bar: true, Doughnut: true, Line: true },
      },
    })

    // Deve exibir skeleton animate-pulse e botão de atualizar desabilitado
    expect(wrapper.find(".animate-pulse").exists()).toBe(true)
    const refreshBtn = wrapper.find("button[disabled]")
    expect(refreshBtn.exists()).toBe(true)

    resolveFetch!({
      ok: true,
      text: async () => JSON.stringify(mockDashboardData),
    })
    await flushPromises()

    expect(wrapper.find(".animate-pulse").exists()).toBe(false)
  })

  it("renderiza métricas e estatísticas com sucesso após o carregamento", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockDashboardData),
    } as any)

    const wrapper = mount(DashboardView, {
      global: {
        stubs: { Bar: true, Doughnut: true, Line: true },
      },
    })

    await flushPromises()

    // Validação de KPIs renderizados
    expect(wrapper.text()).toContain("Dashboard Executivo de RH")
    expect(wrapper.text()).toContain("42") // total de colaboradores
    expect(wrapper.text()).toContain("39") // ativos
    expect(wrapper.text()).toContain("7")  // solicitações pendentes
  })

  it("exibe alerta amigável quando a requisição à API falha", async () => {
    vi.spyOn(storeModule, "apiFetch").mockRejectedValueOnce(
      new Error("Falha na comunicação com o servidor de banco de dados")
    )

    const wrapper = mount(DashboardView, {
      global: {
        stubs: { Bar: true, Doughnut: true, Line: true },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain("Falha na comunicação com o servidor de banco de dados")
  })

  it("permite recarregar métricas ao clicar no botão de atualização", async () => {
    const fetchSpy = vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockDashboardData),
    } as any)

    const wrapper = mount(DashboardView, {
      global: {
        stubs: { Bar: true, Doughnut: true, Line: true },
      },
    })

    await flushPromises()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Clicar no botão Atualizar Dados
    const refreshBtn = wrapper.findAll("button").find((b) => b.text().includes("Atualizar"))
    expect(refreshBtn).toBeDefined()

    await refreshBtn!.trigger("click")
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
