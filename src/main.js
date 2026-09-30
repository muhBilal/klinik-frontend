import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { startTheme } from '@/lib/theme'
import '@fontsource-variable/outfit'
import './style.css'

startTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
