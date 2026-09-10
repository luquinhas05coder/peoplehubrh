import { defineStore } from "pinia"
import { ref, computed } from "vue"
import type { AuthUser, UserRoleType } from "../store"
import { PRESET_USERS } from "../store"

export const useAuthStore = defineStore("auth", () => {
  const isAuthenticated = ref<boolean>(false)
  const currentUser = ref<AuthUser | null>(null)
  const authStep = ref<"login" | "mfa" | "done">("login")
  const sessionToken = ref<string>("")

  const userRoleType = computed<UserRoleType>(() => currentUser.value?.roleType || "rh")

  const permissions = computed(() => {
    const r = userRoleType.value
    return {
      canManageEmployees: r === "rh" || r === "dp" || r === "ti",
      canManagePayroll: r === "dp" || r === "rh",
      canManageIT: r === "ti" || r === "rh",
      canApproveRequests: r === "rh" || r === "dp" || r === "ti",
      isColaborador: r === "colaborador",
    }
  })

  function loginAsPreset(roleType: UserRoleType) {
    currentUser.value = PRESET_USERS[roleType]
    isAuthenticated.value = true
    authStep.value = "done"
  }

  function logout() {
    currentUser.value = null
    isAuthenticated.value = false
    authStep.value = "login"
    sessionToken.value = ""
  }

  return {
    isAuthenticated,
    currentUser,
    authStep,
    sessionToken,
    userRoleType,
    permissions,
    loginAsPreset,
    logout,
  }
})
