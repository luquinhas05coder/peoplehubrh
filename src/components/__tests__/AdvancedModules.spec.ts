import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount } from "@vue/test-utils"
import OrgChartModule from "../OrgChartModule.vue"
import OffboardingModule from "../OffboardingModule.vue"
import TrainingsModule from "../TrainingsModule.vue"
import ClimateSurveyModule from "../ClimateSurveyModule.vue"

describe("Módulos Avançados de RH do PeopleHub", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // 1. Organograma Interativo
  describe("OrgChartModule.vue — Organograma Corporativo Interativo", () => {
    it("renderiza o organograma e busca colaboradores", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          tree: [
            {
              id: "emp_dir",
              name: "Diretor Executivo",
              role: "Diretor",
              department: "Administrativo",
              email: "diretor@empresa.com",
              status: "ativo",
              subordinates: [
                {
                  id: "emp_ger",
                  name: "Gerente Geral",
                  role: "Gerente",
                  department: "TI",
                  email: "gerente@empresa.com",
                  status: "ativo",
                  subordinates: [],
                },
              ],
            },
          ],
          departments: ["Administrativo", "TI"],
          totalEmployees: 2,
        }),
      } as any)

      const wrapper = mount(OrgChartModule)
      await new Promise((r) => setTimeout(r, 50))

      expect(wrapper.text()).toContain("Organograma Interativo")
      expect(wrapper.text()).toContain("Diretor Executivo")
      expect(wrapper.text()).toContain("Administrativo")
    })
  })

  // 2. Desligamento / Offboarding
  describe("OffboardingModule.vue — Desligamento & Simulador Rescisório CLT", () => {
    it("renderiza o simulador rescisório CLT e exibe os parâmetros contratuais", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("calculate-severance")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              result: {
                totalBruto: 15000,
                totalLiquido: 13500,
                proventos: {
                  saldoSalario: { dias: 15, valor: 2500 },
                  avisoPrevio: { dias: 30, valor: 5000 },
                  decimoTerceiro: { meses: 10, valor: 4166.67 },
                  feriasProporcionais: { meses: 10, valor: 4166.67 },
                  tercoConstitucional: 1388.89,
                },
                descontos: { inss: 1000, irrf: 500 },
                fgts: { multaPercentual: 40, multaValor: 6000 },
              },
            }),
          } as any)
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, offboardings: [] }),
        } as any)
      })

      const wrapper = mount(OffboardingModule)
      await new Promise((r) => setTimeout(r, 50))

      expect(wrapper.text()).toContain("Desligamento & Offboarding")
      expect(wrapper.text()).toContain("Processos Ativos")
      expect(wrapper.text()).toContain("Simulador CLT")
    })
  })

  // 3. Treinamentos & NRs
  describe("TrainingsModule.vue — Treinamentos, NRs & Certificações", () => {
    it("renderiza catálogo de cursos e matriz de conformidade regulatória", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("compliance")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, complianceRate: 92 }),
          } as any)
        }
        if (url.includes("catalog")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              trainings: [
                {
                  id: "tr_nr06",
                  title: "NR-06 — Equipamento de Proteção Individual",
                  category: "normativa",
                  nr_code: "NR-06",
                  duration_hours: 8,
                  description: "Treinamento obrigatório para EPIs",
                  status: "ativo",
                },
              ],
            }),
          } as any)
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, trainings: [] }),
        } as any)
      })

      const wrapper = mount(TrainingsModule)
      await new Promise((r) => setTimeout(r, 50))

      expect(wrapper.text()).toContain("Treinamentos, NRs & Certificações")
      expect(wrapper.text()).toContain("NR-06 — Equipamento de Proteção Individual")
      expect(wrapper.text()).toContain("92% em dia")
    })
  })

  // 4. Pesquisa de Clima Organizacional & eNPS
  describe("ClimateSurveyModule.vue — Pesquisa de Clima & eNPS Anônimo", () => {
    it("renderiza dashboard de eNPS com cálculo de zonas e dimensões", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("dashboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              enpsScore: 55,
              zone: "Zona de Excelência",
              totalResponses: 20,
              promoters: 14,
              passives: 4,
              detractors: 2,
              dimensionAverages: {
                leadership: 9.1,
                compensation: 8.2,
                environment: 9.4,
                workLifeBalance: 8.9,
              },
            }),
          } as any)
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            surveys: [
              {
                id: "surv_01",
                title: "Pesquisa de Clima 2026",
                description: "Avaliação institucional",
                status: "ativa",
                anonymous: 1,
                total_responses: 20,
                enps_score: 55,
              },
            ],
          }),
        } as any)
      })

      const wrapper = mount(ClimateSurveyModule)
      await new Promise((r) => setTimeout(r, 50))

      expect(wrapper.text()).toContain("Pesquisa de Clima Organizacional & eNPS")
      expect(wrapper.text()).toContain("+55")
      expect(wrapper.text()).toContain("Zona de Excelência")
      expect(wrapper.text()).toContain("Liderança & Gestão")
    })
  })
})
