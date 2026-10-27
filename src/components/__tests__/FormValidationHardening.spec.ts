import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import NewEmployeeFolderModal from "../NewEmployeeFolderModal.vue"
import NewRequestModal from "../NewRequestModal.vue"
import * as storeModule from "../../store"

describe("Validações de Formulário & Prevenção de Falhas (Hardening)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("NewEmployeeFolderModal.vue — Validações de Formulário de Colaborador", () => {
    it("1. Impede submissão e exibe erros inline se campos obrigatórios ou CPF forem inválidos", async () => {
      const wrapper = mount(NewEmployeeFolderModal)

      // Submeter formulário vazio
      await wrapper.find("form").trigger("submit.prevent")
      await flushPromises()

      const text = wrapper.text()
      expect(text).toContain("Nome completo é obrigatório")
      expect(text).toContain("CPF é obrigatório")
      expect(text).toContain("E-mail institucional é obrigatório")

      // Não deve emitir evento de sucesso nem fechar
      expect(wrapper.emitted("saved")).toBeUndefined()
      expect(wrapper.emitted("close")).toBeUndefined()
    })

    it("2. Valida algoritmo de CPF e rejeita CPFs com dígitos verificadores inválidos", async () => {
      const wrapper = mount(NewEmployeeFolderModal)

      const cpfInput = wrapper.find("input[placeholder='000.000.000-00']")
      await cpfInput.setValue("111.111.111-11")

      await wrapper.find("form").trigger("submit.prevent")
      await flushPromises()

      expect(wrapper.text()).toContain("CPF inválido")
    })

    it("3. Preserva dados digitados e impede fechamento se chamada à API falhar", async () => {
      vi.spyOn(storeModule, "createEmployeeFolder").mockResolvedValue(null)

      const wrapper = mount(NewEmployeeFolderModal)

      // Preenche dados válidos
      const nameInput = wrapper.find("input[placeholder='ex: Carlos Eduardo dos Santos']")
      await nameInput.setValue("Mariana Souza")

      const cpfInput = wrapper.find("input[placeholder='000.000.000-00']")
      // CPF matematicamente válido para teste: 52998224725
      await cpfInput.setValue("529.982.247-25")

      const emailInput = wrapper.find("input[placeholder='carlos.santos@empresa.com']")
      await emailInput.setValue("mariana.souza@empresa.com.br")

      const phoneInput = wrapper.find("input[placeholder='(11) 98888-0000']")
      await phoneInput.setValue("(11) 99999-8888")

      const roleInput = wrapper.find("input[placeholder='ex: Engenheiro de Software Pleno']")
      await roleInput.setValue("Analista de RH")

      await wrapper.find("form").trigger("submit.prevent")
      await flushPromises()

      // Não deve emitir saved se a API retornou null
      expect(wrapper.emitted("saved")).toBeUndefined()
      expect(wrapper.emitted("close")).toBeUndefined()

      // Os campos continuam preenchidos no formulário (dados não são perdidos)
      expect((nameInput.element as HTMLInputElement).value).toBe("Mariana Souza")
      expect((emailInput.element as HTMLInputElement).value).toBe("mariana.souza@empresa.com.br")
    })
  })

  describe("NewRequestModal.vue — Validações de Solicitações e Intervalo de Datas", () => {
    it("1. Rejeita intervalo de datas inválido quando data de término for anterior à de início", async () => {
      storeModule.currentUser.value = {
        id: "usr_gestor",
        name: "Carlos Gestor",
        email: "carlos@empresa.com",
        role: "Gestor",
        userRole: "GESTOR",
        roleType: "gestor",
        department: "TI",
        tenantId: "tenant_default",
      } as any

      const wrapper = mount(NewRequestModal, {
        props: { isDocumentOnly: false },
      })

      // Selecionar tipo ferias (segundo select do formulário de gestor)
      const selects = wrapper.findAll("select")
      const typeSelect = selects[1]
      await typeSelect.setValue("ferias")
      await flushPromises()

      // Preencher título e descrição
      const titleInput = wrapper.find("input[placeholder*='Emissão de Contra-Cheque']")
      await titleInput.setValue("Férias 2026")

      const descTextarea = wrapper.find("textarea")
      await descTextarea.setValue("Solicitação de férias anuais")

      // Preencher datas inconsistentes: início 2026-11-20 e término 2026-11-10
      const dateInputs = wrapper.findAll("input[type='date']")
      expect(dateInputs.length).toBeGreaterThanOrEqual(2)
      await dateInputs[0].setValue("2026-11-20")
      await dateInputs[1].setValue("2026-11-10")

      await wrapper.find("form").trigger("submit.prevent")
      await flushPromises()

      expect(wrapper.text()).toContain("A data de término não pode ser anterior à data de início")
      expect(wrapper.emitted("created")).toBeUndefined()
    })

    it("2. Preserva campos se createRequest retornar null em falha de conexão", async () => {
      vi.spyOn(storeModule, "createRequest").mockResolvedValue(null)

      storeModule.currentUser.value = {
        id: "usr_colab",
        name: "Juliana Mendes",
        email: "juliana@empresa.com",
        role: "Desenvolvedora",
        userRole: "COLABORADOR",
        roleType: "colaborador",
        department: "TI",
        tenantId: "tenant_default",
      } as any

      const wrapper = mount(NewRequestModal, {
        props: { isDocumentOnly: true },
      })

      const nameInput = wrapper.find("input[placeholder='Escreva seu nome completo']")
      await nameInput.setValue("Juliana Mendes")

      const descInput = wrapper.find("textarea")
      await descInput.setValue("Declaração para banco")

      await wrapper.find("form").trigger("submit.prevent")
      await flushPromises()

      // Não fechou e manteve dados
      expect(wrapper.emitted("created")).toBeUndefined()
      expect(wrapper.emitted("close")).toBeUndefined()
      expect((nameInput.element as HTMLInputElement).value).toBe("Juliana Mendes")
      expect((descInput.element as HTMLTextAreaElement).value).toBe("Declaração para banco")
    })
  })
})
