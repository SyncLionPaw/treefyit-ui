import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'
import { mergeStreamingText } from './streamText'

describe('mergeStreamingText', () => {
  it('appends plain incremental patches', () => {
    expect(mergeStreamingText('Hello', ' world')).toBe('Hello world')
  })

  it('keeps cumulative patches from duplicating text', () => {
    expect(mergeStreamingText('Hello', 'Hello world')).toBe('Hello world')
  })

  it('removes overlapping boundaries between patches', () => {
    expect(mergeStreamingText('Hello\n', '\nworld')).toBe('Hello\nworld')
    expect(mergeStreamingText('abc', 'bcdef')).toBe('abcdef')
  })

  it('ignores repeated patches that are already present', () => {
    expect(mergeStreamingText('Hello world', 'world')).toBe('Hello world')
    expect(mergeStreamingText('Hello world', 'Hello')).toBe('Hello world')
    expect(mergeStreamingText('same text', 'same text')).toBe('same text')
  })

  it('does not drop repeated short words that appear earlier in the stream', () => {
    const chunks = [
      '山川的形成主要与板块构造运动有关。',
      '山川',
      '也会受到外力作用影响。',
      '形成',
      '过程往往持续很久。',
    ]
    const merged = chunks.reduce(mergeStreamingText, '')

    expect(merged).toBe('山川的形成主要与板块构造运动有关。山川也会受到外力作用影响。形成过程往往持续很久。')
  })

  it('preserves repeated markdown markers until final rendering can parse them', () => {
    const chunks = ['涉及**域名授权体系**。', '**典型例子：** 喜马拉雅山。']
    const merged = chunks.reduce(mergeStreamingText, '')

    expect(merged).toBe('涉及**域名授权体系**。**典型例子：** 喜马拉雅山。')
    expect(renderMarkdown(merged)).toContain('<strong>典型例子：</strong>')
  })

  it('falls back to concatenation when there is no overlap', () => {
    expect(mergeStreamingText('foo', 'bar')).toBe('foobar')
  })

  it('renders merged markdown without duplicate paragraphs or extra blank lines', () => {
    const merged = mergeStreamingText('用户问的是“三台云水”\n', '\n这看起来像是一个景点或地名。')
    expect(merged).toBe('用户问的是“三台云水”\n这看起来像是一个景点或地名。')
    expect(renderMarkdown(merged)).toContain('<p>用户问的是“三台云水”\n这看起来像是一个景点或地名。</p>')
  })
})
