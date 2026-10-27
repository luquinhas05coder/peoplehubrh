import { createApp } from "vue"
import { createPinia } from "pinia"
import router from "./router"
import "./style.css"
import App from "./App.vue"
import { showToast } from "./store"

const app = createApp(App)
const pinia = createPinia()

// Captura global de erros de renderização e componentes Vue para evitar telas brancas
app.config.errorHandler = (err, _instance, info) => {
  console.error("❌ [Global Vue Error]:", err, info)
  showToast("Ocorreu uma falha inesperada na interface. Tente atualizar a página se persistir.", "error")
}

// Captura de rejeições assíncronas não tratadas (ex: falhas de rede globais)
window.addEventListener("unhandledrejection", (event) => {
  console.error("❌ [Unhandled Promise Rejection]:", event.reason)
  const isNetwork = event.reason?.message?.toLowerCase().includes("fetch") ||
                    event.reason?.message?.toLowerCase().includes("network") ||
                    event.reason?.name === "TypeError"
  if (isNetwork) {
    showToast("Problema de conexão com o servidor. Verifique sua internet.", "warning")
  }
})

app.use(pinia)
app.use(router)
app.mount("#app")
