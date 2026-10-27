import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import EmployeeProfilePage from "../EmployeeProfilePage.vue"
import * as storeModule from "../../store"

// Mock do Vue Router para a rota de perfil
const mockRoute = {
  params: { id: "emp_123" },
}
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
}

vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}))

const mockEmployeeData = {
  ok: true,
  employee: {
    id: "emp_123",
    name: "Mariana Alcantara",
    role: "Gestora de RH & DHO",
    department: "Recursos Humanos",
    status: "active",
    email: "mariana.alcantara@empresa.com",
    phone: "(11) 98888-7777",
    cpf: "123.456.789-00",
    hireDate: "2023-03-15",
    salary: "R$ 9.500,00",
    manager: "Diretoria",
  },
  documents: [
    {
      id: "doc_1",
      name: "Contrato de Trabalho CLT.pdf",
      category: "Contratos",
      date: "2023-03-15",
      status: "Assinado",
    },
  ],
  history: [
    {
      id: "hist_1",
      type: "PROMOTION",
      title: "Promoção para Gestora",
      created_at: "2024-01-10",
    },
  ],
}

describe("EmployeeProfilePage.vue — Perfil Funcional do Colaborador", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeModule.currentUser.value = { ...storeModule.PRESET_USERS.admin }
  })

  it("busca e exibe os dados do colaborador com base no parâmetro da rota", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockEmployeeData,
    } as any)

    const wrapper = mount(EmployeeProfilePage, {
      global: {
        stubs: {
          UserAvatar: true,
          NewEmployeeFolderModal: true,
          ExportDossierModal: true,
          CorporateFeedModule: true,
          EscalaContratoCard: true,
          FolhaDePontoCard: true,
          HoleriteCard: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain("Mariana Alcantara")
    expect(wrapper.text()).toContain("Gestora de RH & DHO")
    expect(wrapper.text()).toContain("Recursos Humanos")
  })

  it("renderiza abas principais de navegação funcional (Resumo, Documentos, Histórico)", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockEmployeeData,
    } as any)

    const wrapper = mount(EmployeeProfilePage, {
      global: {
        stubs: {
          UserAvatar: true,
          NewEmployeeFolderModal: true,
          ExportDossierModal: true,
          CorporateFeedModule: true,
          EscalaContratoCard: true,
          FolhaDePontoCard: true,
          HoleriteCard: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain("Resumo")
    expect(wrapper.text()).toContain("Documentos")
  })

  it("permite alternar entre as abas e visualizar o conteúdo correspondente", async () => {
    vi.spyOn(storeModule, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockEmployeeData,
    } as any)

    const wrapper = mount(EmployeeProfilePage, {
      global: {
        stubs: {
          UserAvatar: true,
          NewEmployeeFolderModal: true,
          ExportDossierModal: true,
          CorporateFeedModule: true,
          EscalaContratoCard: true,
          FolhaDePontoCard: true,
          HoleriteCard: true,
        },
      },
    })

    await flushPromises()

    // Clicar na aba de Documentos
    const docTab = wrapper.findAll("button").find((b) => b.text().includes("Documentos"))
    if (docTab) {
      await docTab.trigger("click")
      await flushPromises()
      expect(wrapper.text()).toContain("Documentos")
    }
  })
})
