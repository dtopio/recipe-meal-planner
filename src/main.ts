import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useAuthStore } from '@/stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

async function bootstrap() {
  const auth = useAuthStore(pinia)
  await auth.initialize()

  app.use(router)
  await router.isReady()
  app.mount('#app')
}

bootstrap()
