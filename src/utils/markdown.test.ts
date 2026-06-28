import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('marks markdown images for bounded UI rendering', () => {
    const html = renderMarkdown('![示例图](https://example.com/image.png)')

    expect(html).toContain('class="md-image"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
  })
})
