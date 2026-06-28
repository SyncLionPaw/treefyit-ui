import { describe, expect, it } from 'vitest'
import { resolveApiUrl, resolveStreamingApiUrl } from './apiClient'

describe('apiClient', () => {
  it('keeps regular local api requests on the same-origin proxy', () => {
    const url = resolveApiUrl(
      { mode: 'local', baseUrl: '', streamBaseUrl: 'http://localhost:8765' },
      'listBuildHistory',
    )

    expect(url).toBe('/api/history')
  })

  it('routes local streaming requests directly to the backend', () => {
    const config = {
      mode: 'local' as const,
      baseUrl: '',
      streamBaseUrl: 'http://localhost:8765',
    }

    expect(resolveStreamingApiUrl(config, 'chatTree')).toBe('http://localhost:8765/api/chat')
    expect(resolveStreamingApiUrl(config, 'buildTreeStream')).toBe('http://localhost:8765/api/build/stream')
  })
})
