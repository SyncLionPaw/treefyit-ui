/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}

interface Window {
  katex?: {
    renderToString: (
      latex: string,
      options?: {
        displayMode?: boolean
        throwOnError?: boolean
        errorColor?: string
      }
    ) => string
  }
}
