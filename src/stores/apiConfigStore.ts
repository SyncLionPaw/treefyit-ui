import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ApiMode = 'local' | 'cloud'

const DEFAULT_LOCAL_BASE_URL = ''
const DEFAULT_CLOUD_BASE_URL = 'https://api.treefyit.example.com'
const LOCAL_BACKEND_PORT = '8765'

function resolveLocalStreamBaseUrl() {
  if (typeof window === 'undefined') return `http://localhost:${LOCAL_BACKEND_PORT}`
  return `${window.location.protocol}//${window.location.hostname}:${LOCAL_BACKEND_PORT}`
}

export const useApiConfigStore = defineStore('apiConfig', () => {
  const mode = ref<ApiMode>('local')
  const cloudBaseUrl = ref(DEFAULT_CLOUD_BASE_URL)

  const baseUrl = computed(() => (
    mode.value === 'local'
      ? DEFAULT_LOCAL_BASE_URL
      : cloudBaseUrl.value
  ).replace(/\/$/, ''))
  const streamBaseUrl = computed(() => (
    mode.value === 'local'
      ? resolveLocalStreamBaseUrl()
      : cloudBaseUrl.value
  ).replace(/\/$/, ''))
  const displayBaseUrl = computed(() => (
    mode.value === 'local' && !baseUrl.value
      ? `same-origin /api proxy -> ${resolveLocalStreamBaseUrl()}`
      : baseUrl.value
  ))
  const displayStreamBaseUrl = computed(() => (
    mode.value === 'local'
      ? streamBaseUrl.value
      : displayBaseUrl.value
  ))

  function setMode(nextMode: ApiMode) {
    mode.value = nextMode
  }

  function updateCloudBaseUrl(url: string) {
    cloudBaseUrl.value = url.trim() || DEFAULT_CLOUD_BASE_URL
  }

  return {
    mode,
    cloudBaseUrl,
    baseUrl,
    streamBaseUrl,
    displayBaseUrl,
    displayStreamBaseUrl,
    setMode,
    updateCloudBaseUrl,
  }
})
