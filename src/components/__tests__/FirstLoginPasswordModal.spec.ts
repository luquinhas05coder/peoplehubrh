import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import FirstLoginPasswordModal from "../FirstLoginPasswordModal.vue"
import * as storeModule from "../../store"

describe("FirstLoginPasswordModal.vue — Redefinição de Senha no Primeiro Acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renderiza o modal de primeiro acesso com inputs e avisos de segurança", () => {
    const wrapper = mount(FirstLoginPasswordModal)

    expect(wrapper.text()).toContain("Primeiro Acesso Obrigatório")
    expect(wrapper.text()).toContain("Defina sua Nova Senha")

    const inputs = wrapper.findAll("input[type='password'], input[type='text']")
    expect(inputs.length).toBe(2)
  })

  it("desabilita botão de confirmação enquanto requisitos mínimos não forem atendidos", () => {
    const wrapper = mount(FirstLoginPasswordModal)
    const submitBtn = wrapper.find("button[type='submit']")

    expect(submitBtn.attributes("disabled")).toBeDefined()
  })

  it("calcula força da senha conforme complexidade", async () => {
    const wrapper = mount(FirstLoginPasswordModal)
    const inputs = wrapper.findAll("input")
    const newPassInput = inputs[0]

    // Senha com menos de 6 caracteres (score 1: apenas números)
    await newPassInput.setValue("12345")
    expect(wrapper.text()).toContain("Força da senha:")
    expect(wrapper.text()).toContain("Fraca")

    // Senha com 6 caracteres simples (score 2: comprimento >= 6 + números)
    await newPassInput.setValue("123456")
    expect(wrapper.text()).toContain("Razoável")

    // Senha com maiúsculas, minúsculas, números e símbolos
    await newPassInput.setValue("SenhaForte@2026")
    expect(wrapper.text()).toContain("Forte")
  })

  it("valida que senhas diferentes bloqueiam a submissão", async () => {
    const wrapper = mount(FirstLoginPasswordModal)
    const inputs = wrapper.findAll("input")

    await inputs[0].setValue("SenhaSegura@123")
    await inputs[1].setValue("SenhaDiferente@123")

    const submitBtn = wrapper.find("button[type='submit']")
    expect(submitBtn.attributes("disabled")).toBeDefined()
    expect(wrapper.text()).toContain("As senhas ainda não coincidem")
  })

  it("habilita botão e envia formulário quando requisitos são satisfeitos", async () => {
    const changeSpy = vi.spyOn(storeModule, "changeFirstLoginPassword").mockResolvedValueOnce({
      ok: true,
    })

    const wrapper = mount(FirstLoginPasswordModal)
    const inputs = wrapper.findAll("input")

    await inputs[0].setValue("NovaSenha@2026")
    await inputs[1].setValue("NovaSenha@2026")

    const submitBtn = wrapper.find("button[type='submit']")
    expect(submitBtn.attributes("disabled")).toBeUndefined()

    await wrapper.find("form").trigger("submit.prevent")
    await flushPromises()

    expect(changeSpy).toHaveBeenCalledWith("NovaSenha@2026")
  })

  it("exibe mensagem de erro quando a API rejeita a nova senha", async () => {
    vi.spyOn(storeModule, "changeFirstLoginPassword").mockResolvedValueOnce({
      ok: false,
      error: "A senha já foi utilizada anteriormente. Escolha uma senha inédita.",
    })

    const wrapper = mount(FirstLoginPasswordModal)
    const inputs = wrapper.findAll("input")

    await inputs[0].setValue("SenhaAntiga@123")
    await inputs[1].setValue("SenhaAntiga@123")

    await wrapper.find("form").trigger("submit.prevent")
    await flushPromises()

    expect(wrapper.text()).toContain("A senha já foi utilizada anteriormente. Escolha uma senha inédita.")
  })
})
