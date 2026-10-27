import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import SelfServicePortal from "../SelfServicePortal.vue"
import * as storeModule from "../../store"

const mockPortalData = {
  ok: true,
  employee: {
    id: "emp_colab_01",
    name: "Gabriel Santos",
    email: "colaborador@peoplehub.com.br",
    role: "Desenvolvedor Full-Stack",
    department: "TI",
    manager: "Gestor TI",
    hireDate: "2023-03-15",
    tenure: "3 anos",
    phone: "(11) 98765-4321",
    address: "Rua das Flores, 120",
    city: "São Paulo",
    state: "SP",
    cep: "01310-100",
    contractType: "CLT",
    workSchedule: "Segunda a Sexta (44h)",
  },
  requests: [
    {
      id: "REQ-101",
      type: "Declaração de Vínculo",
      requester: "Gabriel Santos",
      department: "TI",
      date: "2026-10-20",
      status: "Em Análise",
      priority: "Média",
      description: "Declaração para matrícula em curso de pós-graduação.",
    },
    {
      id: "REQ-102",
      type: "Atualização Cadastral",
      requester: "Gabriel Santos",
      department: "TI",
      date: "2026-10-18",
      status: "Aprovado",
      priority: "Baixa",
      description: "Alteração de número de celular.",
    },
  ],
  documents: [
    {
      id: "DOC-201",
      name: "Contrato de Trabalho CLT",
      category: "Contratos",
      employeeName: "Gabriel Santos",
      date: "2023-03-15",
      status: "Emitido",
      fileUrl: "/api/documents/DOC-201/download",
      type: "PDF",
      origin: "administrativo",
      file_size: 154200,
    },
    {
      id: "DOC-202",
      name: "Comprovante de Residência",
      category: "Comprovantes",
      employeeName: "Gabriel Santos",
      date: "2026-10-15",
      status: "Enviado",
      fileUrl: "/api/documents/DOC-202/download",
      type: "PDF",
      origin: "pessoal",
      file_size: 98400,
    },
  ],
  vacation: {
    diasDisponiveis: 25,
    diasUtilizados: 5,
    proximoPeriodo: "Período Aquisitivo 2025/2026",
    temFeriasPendentes: false,
  },
}

describe("SelfServicePortal.vue — Portal de Autoatendimento do Colaborador", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.colaborador }
  })

  it("renderiza o portal, consulta /api/employees/me e exibe os dados do colaborador", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      json: async () => mockPortalData,
    } as any)

    const wrapper = mount(SelfServicePortal)
    await flushPromises()

    expect(wrapper.text()).toContain("Portal de Autoatendimento")
    expect(wrapper.text()).toContain("Gabriel Santos")
    expect(wrapper.text()).toContain("Desenvolvedor Full-Stack")
    expect(wrapper.text()).toContain("TI")
    expect(wrapper.text()).toContain("Gestor TI")
    expect(wrapper.text()).toContain("25 dias") // Saldo de férias
    expect(wrapper.text()).toContain("(11) 98765-4321")
    expect(wrapper.text()).toContain("Rua das Flores, 120")
  })

  it("permite alternar entre as abas 'Meus Dados', 'Minhas Solicitações' e 'Meus Documentos'", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      json: async () => mockPortalData,
    } as any)

    const wrapper = mount(SelfServicePortal)
    await flushPromises()

    // Clicar na aba de solicitações
    const reqTabBtn = wrapper.findAll("nav button").find((b) => b.text().includes("Minhas Solicitações"))
    expect(reqTabBtn).toBeDefined()
    await reqTabBtn?.trigger("click")

    expect(wrapper.text()).toContain("REQ-101")
    expect(wrapper.text()).toContain("Declaração de Vínculo")
    expect(wrapper.text()).toContain("REQ-102")

    // Clicar na aba de documentos
    const docTabBtn = wrapper.findAll("nav button").find((b) => b.text().includes("Meus Documentos"))
    expect(docTabBtn).toBeDefined()
    await docTabBtn?.trigger("click")

    expect(wrapper.text()).toContain("Contrato de Trabalho CLT")
    expect(wrapper.text()).toContain("Comprovante de Residência")
    expect(wrapper.text()).toContain("Institucional")
    expect(wrapper.text()).toContain("Pessoal")
  })

  it("exibe a aba de 'Aprovações do RH' apenas quando o usuário possui perfil autorizado (RH / Admin)", async () => {
    // 1. Colaborador comum NÃO deve ver a aba de Aprovações
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.colaborador }
    vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      json: async () => mockPortalData,
    } as any)

    const colabWrapper = mount(SelfServicePortal)
    await flushPromises()
    expect(colabWrapper.text()).not.toContain("Aprovações do RH")

    // 2. Analista de RH DEVE ver a aba de Aprovações do RH
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.rh }
    const rhWrapper = mount(SelfServicePortal)
    await flushPromises()
    expect(rhWrapper.text()).toContain("Aprovações do RH")
  })

  it("abre o modal de alteração cadastral e calcula o diff das alterações propostas", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      json: async () => mockPortalData,
    } as any)

    const wrapper = mount(SelfServicePortal)
    await flushPromises()

    // Abrir modal de alteração cadastral
    const updateBtn = wrapper.findAll("button").find((b) => b.text().includes("Solicitar Atualização Cadastral"))
    expect(updateBtn).toBeDefined()
    await updateBtn?.trigger("click")

    expect(wrapper.text()).toContain("Solicitar Alteração Cadastral")

    // Alterar o telefone no formulário
    const phoneInput = wrapper.find('input[placeholder="(11) 98888-0000"]')
    expect(phoneInput.exists()).toBe(true)
    await phoneInput.setValue("(11) 99999-1234")

    // Verificar se o diff visual foi renderizado
    expect(wrapper.text()).toContain("Comparativo das Alterações Solicitadas:")
    expect(wrapper.text()).toContain("(11) 98765-4321")
    expect(wrapper.text()).toContain("(11) 99999-1234")
  })

  it("abre o modal de Nova Solicitação e permite selecionar a categoria", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValue({
      ok: true,
      json: async () => mockPortalData,
    } as any)

    const wrapper = mount(SelfServicePortal)
    await flushPromises()

    // Abrir modal de nova solicitação
    const newReqBtn = wrapper.findAll("button").find((b) => b.text().includes("Nova Solicitação"))
    expect(newReqBtn).toBeDefined()
    await newReqBtn?.trigger("click")

    expect(wrapper.text()).toContain("Abrir Nova Solicitação")
    expect(wrapper.text()).toContain("Categoria do Pedido")
    expect(wrapper.find("textarea").exists()).toBe(true)
  })

  it("permite o cancelamento de solicitação pelo colaborador quando o status for 'Em Análise'", async () => {
    window.confirm = vi.fn(() => true)
    const apiSpy = vi.spyOn(storeModule, "apiFetch").mockImplementation(async (url: any) => {
      if (typeof url === "string" && url.includes("/api/employees/me")) {
        return { ok: true, json: async () => mockPortalData } as any
      }
      return { ok: true, json: async () => ({ ok: true, message: "Cancelado com sucesso" }) } as any
    })

    const wrapper = mount(SelfServicePortal)
    await flushPromises()

    // Navegar para solicitações
    const reqTabBtn = wrapper.findAll("nav button").find((b) => b.text().includes("Minhas Solicitações"))
    await reqTabBtn?.trigger("click")

    // Encontrar botão de cancelar da solicitação REQ-101 (que está Em Análise)
    const cancelBtn = wrapper.findAll("button").find((b) => b.text() === "Cancelar")
    expect(cancelBtn).toBeDefined()
    await cancelBtn?.trigger("click")

    expect(apiSpy).toHaveBeenCalledWith(
      "/api/requests/REQ-101/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Cancelado" }),
      })
    )
  })
})
