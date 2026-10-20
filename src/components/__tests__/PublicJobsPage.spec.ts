import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import PublicJobsPage from "../PublicJobsPage.vue"

const mockPublicJobs = [
  {
    id: "job_pub_01",
    title: "Engenheiro de Software Full Stack",
    department: "Tecnologia",
    role: "Desenvolvedor",
    work_model: "remoto",
    contract_type: "CLT",
    location: "São Paulo - SP (Remoto)",
    positions_count: 2,
    salary_min: 9000,
    salary_max: 13000,
    salary_is_confidential: 0,
    description: "Atuar no desenvolvimento do ecossistema PeopleHub RH.",
    requirements: "TypeScript, Vue 3, Node.js e SQL.",
    responsibilities: "Desenvolver novos módulos e manter estabilidade.",
    benefits: "Vale Refeição, Seguro de Vida, Plano de Saúde.",
    published_at: new Date().toISOString(),
  },
]

describe("PublicJobsPage.vue — Página Pública de Carreiras & Oportunidades", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/recruitment/public/jobs")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, jobs: mockPublicJobs }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
  })

  it("renderiza o cabeçalho público e as vagas disponíveis", async () => {
    const wrapper = mount(PublicJobsPage)
    await flushPromises()

    expect(wrapper.text()).toContain("PeopleHub")
    expect(wrapper.text()).toContain("Carreiras")
    expect(wrapper.text()).toContain("Construa sua história com a gente")
    expect(wrapper.text()).toContain("Engenheiro de Software Full Stack")
    expect(wrapper.text()).toContain("Tecnologia")
    expect(wrapper.text()).toContain("remoto")
  })

  it("permite abrir o modal de candidatura com termos da LGPD", async () => {
    const wrapper = mount(PublicJobsPage)
    await flushPromises()

    const applyBtn = wrapper.findAll("button").find((b) => b.text().includes("Ver Detalhes e Candidatar-se"))
    expect(applyBtn).toBeDefined()
    await applyBtn?.trigger("click")

    expect(wrapper.text()).toContain("Formulário de Inscrição")
    expect(wrapper.text()).toContain("Nome Completo *")
    expect(wrapper.text()).toContain("E-mail *")
    expect(wrapper.text()).toContain("LGPD (Lei Geral de Proteção de Dados")
  })
})
