import MarkdownIt from 'markdown-it'

interface MathToken {
  marker: string
  latex: string
  displayMode: boolean
}

function normalizeTableCell(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

function convertTableElement(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll('tr')).map(row => (
    Array.from(row.children)
      .filter(cell => ['TD', 'TH'].includes(cell.tagName))
      .map(cell => normalizeTableCell(cell.textContent || ''))
  )).filter(row => row.length)

  if (!rows.length) return ''

  const columnCount = Math.max(...rows.map(row => row.length))
  const normalizedRows = rows.map(row => Array.from({ length: columnCount }, (_, index) => row[index] || ''))
  const header = normalizedRows[0]
  const separator = header.map(() => '---')
  const body = normalizedRows.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function fallbackConvertHtmlTable(html: string) {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || []
  const rows = rowMatches.map(row => (
    (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [])
      .map(cell => normalizeTableCell(cell.replace(/<[^>]+>/g, '')))
  )).filter(row => row.length)

  if (!rows.length) return html

  const columnCount = Math.max(...rows.map(row => row.length))
  const normalizedRows = rows.map(row => Array.from({ length: columnCount }, (_, index) => row[index] || ''))
  const header = normalizedRows[0]
  const separator = header.map(() => '---')
  const body = normalizedRows.slice(1)

  return `\n\n${[
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')}\n\n`
}

function convertHtmlTables(text: string) {
  if (!/<table[\s>]/i.test(text)) return text

  return text.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    if (typeof document === 'undefined') return fallbackConvertHtmlTable(tableHtml)

    const template = document.createElement('template')
    template.innerHTML = tableHtml.trim()
    const table = template.content.querySelector('table')
    if (!table) return tableHtml

    const markdownTable = convertTableElement(table)
    return markdownTable ? `\n\n${markdownTable}\n\n` : tableHtml
  })
}

function normalizeMarkdown(text: string) {
  return convertHtmlTables(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractMath(text: string) {
  const tokens: MathToken[] = []
  let nextText = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex: string) => {
    const marker = `TREEFYIT_MATH_${tokens.length}_TOKEN`
    tokens.push({ marker, latex: latex.trim(), displayMode: true })
    return `\n\n${marker}\n\n`
  })

  nextText = nextText.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (match: string, prefix: string, latex: string) => {
    const trimmed = latex.trim()
    if (!trimmed) return match

    const marker = `TREEFYIT_MATH_${tokens.length}_TOKEN`
    tokens.push({ marker, latex: trimmed, displayMode: false })
    return `${prefix}${marker}`
  })

  return { text: nextText, tokens }
}

function renderMathToken(token: MathToken) {
  const katex = typeof window !== 'undefined' ? window.katex : undefined
  if (!katex) {
    const delimiter = token.displayMode ? '$$' : '$'
    return `<span class="math-fallback">${delimiter}${escapeHtml(token.latex)}${delimiter}</span>`
  }

  try {
    return katex.renderToString(token.latex, {
      displayMode: token.displayMode,
      throwOnError: false,
      errorColor: '#dc2626',
    })
  } catch {
    const delimiter = token.displayMode ? '$$' : '$'
    return `<span class="math-fallback">${delimiter}${escapeHtml(token.latex)}${delimiter}</span>`
  }
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true,
})

const defaultImageRenderer = markdown.renderer.rules.image

markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('class', 'md-image')
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')
  return defaultImageRenderer
    ? defaultImageRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

export function renderMarkdown(text: string) {
  const normalized = normalizeMarkdown(text)
  if (!normalized) return ''

  const { text: textWithMathMarkers, tokens } = extractMath(normalized)
  let html = markdown.render(textWithMathMarkers)
  for (const token of tokens) {
    html = html.replaceAll(token.marker, renderMathToken(token))
  }
  return html
}
