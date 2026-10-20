import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import LoginPage from "../LoginPage.vue"
import * as storeModule from "../../store"

// Mock do Vue Router
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

describe("LoginPage.vue — Autenticação e Interações da Tela de Login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockReset()
    mockReplace.mockReset()
  })

  it("renderiza os campos obrigatórios de e-mail e senha e botão de login", () => {
    const wrapper = mount(LoginPage)

    const emailInput = wrapper.find("#login-email")
    const passwordInput = wrapper.find("#login-password")
    const submitBtn = wrapper.find("button[type='submit']")

    expect(emailInput.exists()).toBe(true)
    expect(passwordInput.exists()).toBe(true)
    expect(submitBtn.exists()).toBe(true)
    expect(submitBtn.text()).toContain("Entrar na Plataforma")
  })

  it("alterna a visibilidade da senha ao clicar no botão de exibição", async () => {
    const wrapper = mount(LoginPage)
    const passwordInput = wrapper.find("#login-password")

    expect(passwordInput.attributes("type")).toBe("password")

    // Botão de alternar visibilidade
    const toggleBtn = wrapper.find("button[aria-label='Mostrar senha']")
    expect(toggleBtn.exists()).toBe(true)

    await toggleBtn.trigger("click")
    expect(passwordInput.attributes("type")).toBe("text")

    await toggleBtn.trigger("click")
    expect(passwordInput.attributes("type")).toBe("password")
  })

  it("preenche credenciais de administrador ao clicar no botão de Login Rápido", async () => {
    const wrapper = mount(LoginPage)

    const quickFillBtn = wrapper.find("button:has(strong)")
    expect(quickFillBtn.exists()).toBe(true)

    await quickFillBtn.trigger("click")

    const emailInput = wrapper.find<HTMLInputElement>("#login-email")
    const passwordInput = wrapper.find<HTMLInputElement>("#login-password")

    expect(emailInput.element.value).toBe("admin@empresa.com")
    expect(passwordInput.element.value).toBe("admin123")
  })

  it("exibe mensagem de erro quando submetido com campos vazios", async () => {
    const wrapper = mount(LoginPage)
    const form = wrapper.find("form")

    await form.trigger("submit.prevent")
    await flushPromises()

    expect(wrapper.text()).toContain("Preencha e-mail e senha para continuar.")
  })

  it("trata erro de credenciais inválidas retornado pela API", async () => {
    vi.spyOn(storeModule, "loginUser").mockResolvedValueOnce({
      ok: false,
      error: "Credenciais inválidas. Verifique seu e-mail e senha.",
    })

    const wrapper = mount(LoginPage)

    const emailInput = wrapper.find("#login-email")
    const passwordInput = wrapper.find("#login-password")
    await emailInput.setValue("errado@empresa.com")
    await passwordInput.setValue("senhaInvalida123")

    const form = wrapper.find("form")
    await form.trigger("submit.prevent")
    await flushPromises()

    expect(wrapper.text()).toContain("Credenciais inválidas. Verifique seu e-mail e senha.")
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("exibe estado de carregamento durante a verificação de credenciais", async () => {
    let resolveLogin: (val: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolveLogin = resolve
    })

    vi.spyOn(storeModule, "loginUser").mockReturnValueOnce(pendingPromise as any)

    const wrapper = mount(LoginPage)

    await wrapper.find("#login-email").setValue("admin@empresa.com")
    await wrapper.find("#login-password").setValue("admin123")

    await wrapper.find("form").trigger("submit.prevent")

    // Estado loading ativo
    expect(wrapper.text()).toContain("Verificando credenciais...")
    const submitBtn = wrapper.find("button[type='submit']")
    expect(submitBtn.attributes("disabled")).toBeDefined()

    // Resolver requisição
    resolveLogin!({ ok: true })
    await flushPromises()

    expect(mockReplace).toHaveBeenCalledWith("/home")
  })

  it("abre a visão de 'Esqueci a minha senha' e permite retorno à tela de login", async () => {
    const wrapper = mount(LoginPage)

    const buttons = wrapper.findAll("button")
    const forgotLink = buttons.find((b) => b.text().includes("Esqueceu a senha?"))
    expect(forgotLink).toBeDefined()

    await forgotLink!.trigger("click")
    expect(wrapper.text()).toContain("Recuperar Senha 🔑")

    // Botão de voltar ao login
    const backBtn = wrapper.findAll("button").find((b) => b.text().includes("Voltar ao Login"))
    expect(backBtn).toBeDefined()

    await backBtn!.trigger("click")
    expect(wrapper.text()).toContain("Bem-vindo de volta 👋")
  })
})
