import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import RecruitmentModule from "../RecruitmentModule.vue"
import * as storeModule from "../../store"

const mockJobs = [
  {
    id: "job_01",
    title: "Desenvolvedor(a) Full Stack Sênior",
    department: "Tecnologia da Informação",
    role: "Engenheiro de Software",
    work_model: "hibrido",
    contract_type: "CLT",
    location: "São Paulo, SP",
    positions_count: 2,
    status: "aberta",
    is_public: true,
    created_at: new Date().toISOString(),
    total_candidates: 2,
  },
]

const mockCandidates = [
  {
    id: "cand_01",
    name: "Lucas Martins Oliveira",
    email: "lucas.martins@exemplo.com",
    source: "linkedin",
    application_id: "app_01",
    job_id: "job_01",
    stage: "entrevista",
    rating: 4.5,
    applied_at: new Date().toISOString(),
    job_title: "Desenvolvedor(a) Full Stack Sênior",
  },
]

const mockInterviews = [
  {
    id: "int_01",
    application_id: "app_01",
    candidate_name: "Lucas Martins Oliveira",
    job_title: "Desenvolvedor(a) Full Stack Sênior",
    interviewer_name: "Mariana Alcantara",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 60,
    meeting_link: "https://meet.google.com/ph-tech-int",
    status: "agendada",
  },
]

const mockMetrics = {
  totalJobs: 3,
  openJobsCount: 2,
  closedJobsCount: 1,
  totalCandidates: 5,
  jobsByStatus: { aberta: 2, encerrada: 1 },
  candidatesByStage: { inscricao: 1, entrevista: 1, contratado: 1 },
  candidatesBySource: { linkedin: 2, site_carreiras: 2 },
  avgTimeToHireDays: 14,
  conversionRate: 20,
}

describe("RecruitmentModule.vue — Recrutamento & Seleção (ATS)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/recruitment/jobs")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, jobs: mockJobs }),
          })
        }
        if (url.includes("/api/recruitment/candidates")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, candidates: mockCandidates }),
          })
        }
        if (url.includes("/api/recruitment/interviews")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, interviews: mockInterviews }),
          })
        }
        if (url.includes("/api/recruitment/metrics")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, metrics: mockMetrics }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
  })

  it("renderiza o cabeçalho do módulo ATS e as abas principais", async () => {
    const wrapper = mount(RecruitmentModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Recrutamento & Seleção (ATS)")
    expect(wrapper.text()).toContain("Pipeline de Candidatos")
    expect(wrapper.text()).toContain("Vagas Abertas")
    expect(wrapper.text()).toContain("Agenda de Entrevistas")
    expect(wrapper.text()).toContain("Métricas & Funil")
  })

  it("renderiza o pipeline Kanban com as etapas e o card do candidato", async () => {
    const wrapper = mount(RecruitmentModule)
    await flushPromises()

    expect(wrapper.text()).toContain("Inscrições")
    expect(wrapper.text()).toContain("Triagem")
    expect(wrapper.text()).toContain("Entrevistas")
    expect(wrapper.text()).toContain("Teste Técnico")
    expect(wrapper.text()).toContain("Aprovados")
    expect(wrapper.text()).toContain("Contratados")
    expect(wrapper.text()).toContain("Lucas Martins Oliveira")
  })

  it("permite alternar para a aba de Vagas Abertas", async () => {
    const wrapper = mount(RecruitmentModule)
    await flushPromises()

    const vagasBtn = wrapper.findAll("button").find((b) => b.text().includes("Vagas Abertas"))
    expect(vagasBtn).toBeDefined()
    await vagasBtn?.trigger("click")

    expect(wrapper.text()).toContain("Desenvolvedor(a) Full Stack Sênior")
    expect(wrapper.text()).toContain("Tecnologia da Informação")
  })

  it("permite alternar para a aba de Métricas & Funil de Contratação", async () => {
    const wrapper = mount(RecruitmentModule)
    await flushPromises()

    const metricasBtn = wrapper.findAll("button").find((b) => b.text().includes("Métricas & Funil"))
    expect(metricasBtn).toBeDefined()
    await metricasBtn?.trigger("click")

    expect(wrapper.text()).toContain("Vagas Ativas")
    expect(wrapper.text()).toContain("Total de Candidatos")
    expect(wrapper.text()).toContain("Tempo Médio de Contratação")
  })
})
