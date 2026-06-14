import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ApiMode = 'local' | 'cloud'

const DEFAULT_LOCAL_BASE_URL = ''
const DEFAULT_CLOUD_BASE_URL = 'https://api.treefyit.example.com'
const DEFAULT_LOCAL_LLM_BASE_URL = ''

export const useApiConfigStore = defineStore('apiConfig', () => {
  const mode = ref<ApiMode>('local')
  const cloudBaseUrl = ref(DEFAULT_CLOUD_BASE_URL)
  const localLlmBaseUrl = ref(DEFAULT_LOCAL_LLM_BASE_URL)
  const localApiKey = ref('')

  const baseUrl = computed(() => (
    mode.value === 'local'
      ? DEFAULT_LOCAL_BASE_URL
      : cloudBaseUrl.value
  ).replace(/\/$/, ''))
  const displayBaseUrl = computed(() => (
    mode.value === 'local' && !baseUrl.value
      ? 'same-origin /api proxy -> http://localhost:8765'
      : baseUrl.value
  ))
  const displayLocalLlmBaseUrl = computed(() => (
    localLlmBaseUrl.value || 'custom LLM provider base URL'
  ))

  function setMode(nextMode: ApiMode) {
    mode.value = nextMode
  }

  function updateLocalLlmBaseUrl(url: string) {
    localLlmBaseUrl.value = url.trim().replace(/\/$/, '') || DEFAULT_LOCAL_LLM_BASE_URL
  }

  function updateCloudBaseUrl(url: string) {
    cloudBaseUrl.value = url.trim() || DEFAULT_CLOUD_BASE_URL
  }

  function updateLocalApiKey(apiKey: string) {
    localApiKey.value = apiKey.trim()
  }

  return {
    mode,
    cloudBaseUrl,
    localLlmBaseUrl,
    localApiKey,
    baseUrl,
    displayBaseUrl,
    displayLocalLlmBaseUrl,
    setMode,
    updateLocalLlmBaseUrl,
    updateCloudBaseUrl,
    updateLocalApiKey,
  }
})
