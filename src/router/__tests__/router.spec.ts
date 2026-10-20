import { describe, it, expect, beforeEach } from "vitest"
import router from "../index"
import { isAuthenticated, currentUser, type AuthUser } from "../../store"

describe("Vue Router — Proteção de Rotas e Navegação RBAC", () => {
  beforeEach(async () => {
    // Reset do estado de autenticação antes de cada teste
    isAuthenticated.value = false
    currentUser.value = null
    await router.push("/login")
  })

  it("redireciona usuário não autenticado para /login ao tentar acessar rotas internas", async () => {
    isAuthenticated.value = false
    currentUser.value = null

    await router.push("/home")
    expect(router.currentRoute.value.path).toBe("/login")

    await router.push("/colaboradores")
    expect(router.currentRoute.value.path).toBe("/login")

    await router.push("/documentos")
    expect(router.currentRoute.value.path).toBe("/login")

    await router.push("/solicitacoes")
    expect(router.currentRoute.value.path).toBe("/login")
  })

  it("permite acesso direto a /login para usuários deslogados", async () => {
    isAuthenticated.value = false
    currentUser.value = null

    await router.push("/login")
    expect(router.currentRoute.value.path).toBe("/login")
  })

  it("redireciona usuário autenticado para /home ao tentar acessar a tela de /login (evita trap de navegação)", async () => {
    isAuthenticated.value = true
    currentUser.value = {
      id: "u_admin",
      name: "Admin User",
      email: "admin@empresa.com",
      role: "Administrador de Sistemas",
      userRole: "ADMIN",
      roleType: "ti",
      initials: "AD",
      department: "Tecnologia",
    } as AuthUser

    // Estando em /home
    await router.push("/home")
    expect(router.currentRoute.value.path).toBe("/home")

    // Ao tentar ir para /login estando logado, o guard redireciona de volta para /home
    await router.push("/login")
    expect(router.currentRoute.value.path).toBe("/home")
  })

  it("bloqueia navegação em rotas internas quando mustChangePassword for obrigatório", async () => {
    isAuthenticated.value = true
    currentUser.value = {
      id: "u_new",
      name: "Novo Colaborador",
      email: "novo@empresa.com",
      role: "Assistente Operacional",
      userRole: "COLABORADOR",
      roleType: "colaborador",
      initials: "NC",
      department: "Operações",
      mustChangePassword: true,
    } as AuthUser

    // Estando em /login, tentar ir para /home deve ser bloqueado (next(false))
    await router.push("/login")
    try {
      await router.push("/home")
    } catch {
      // Vue Router lança erro ao chamar next(false)
    }
    expect(router.currentRoute.value.path).toBe("/login")
  })

  it("bloqueia acesso a rotas restritas por RBAC (ex: /usuarios exige ADMIN)", async () => {
    // Autenticado como COLABORADOR
    isAuthenticated.value = true
    currentUser.value = {
      id: "u_colab",
      name: "Gabriel Santos",
      email: "colaborador@empresa.com",
      role: "Desenvolvedor de Software",
      userRole: "COLABORADOR",
      roleType: "colaborador",
      initials: "GS",
      department: "TI",
    } as AuthUser

    await router.push("/usuarios")
    expect(router.currentRoute.value.path).toBe("/acesso-negado")
  })

  it("permite acesso a /usuarios para usuário com perfil ADMIN", async () => {
    isAuthenticated.value = true
    currentUser.value = {
      id: "u_admin",
      name: "Administrador Geral",
      email: "admin@empresa.com",
      role: "Administrador de Sistemas",
      userRole: "ADMIN",
      roleType: "ti",
      initials: "AD",
      department: "Tecnologia",
    } as AuthUser

    await router.push("/usuarios")
    expect(router.currentRoute.value.path).toBe("/usuarios")
  })

  it("permite acesso a rotas compartilhadas (onboarding/relatórios) para perfis RH e GESTOR", async () => {
    isAuthenticated.value = true
    currentUser.value = {
      id: "u_rh",
      name: "Mariana Alcantara",
      email: "rh@empresa.com",
      role: "Gestora de RH",
      userRole: "RH",
      roleType: "rh",
      initials: "MA",
      department: "Recursos Humanos",
    } as AuthUser

    await router.push("/onboarding")
    expect(router.currentRoute.value.path).toBe("/onboarding")

    await router.push("/relatorios")
    expect(router.currentRoute.value.path).toBe("/relatorios")
  })
})
