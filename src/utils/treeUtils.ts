import type { TreeNode, FlatNode, LinkData } from '../types'
import { sourceToColor } from './colorPalette'

export function flattenTree(
  roots: TreeNode[],
  sourceName?: string
): { nodes: FlatNode[]; links: LinkData[] } {
  const nodes: FlatNode[] = []
  const links: LinkData[] = []

  function walk(node: TreeNode, depth: number, parentId: string | null, src: string) {
    const id = node.id || `${nodes.length}`
    const source = node.source || src
    const color = node.color || sourceToColor(source)
    const fallbackTokenCount = Math.max(
      1,
      Math.ceil(`${node.title} ${node.summary || ''} ${node.text || ''}`.length / 4)
    )

    const flat: FlatNode = {
      id,
      title: node.title,
      path: node.path || id,
      depth,
      tokenCount: node.tokenCount || fallbackTokenCount,
      source,
      color,
      parentId,
      text: node.text || '',
      summary: node.summary || '',
    }
    nodes.push(flat)

    if (parentId) {
      links.push({ source: parentId, target: id })
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child, depth + 1, id, source)
      }
    }
  }

  for (const root of roots) {
    const src = root.source || sourceName || root.title
    walk(root, 0, null, src)
  }

  return { nodes, links }
}

export function assignPaths(roots: TreeNode[]): TreeNode[] {
  function walk(nodes: TreeNode[], prefix: string): TreeNode[] {
    return nodes.map((node, i) => {
      const path = prefix ? `${prefix}.${i}` : `${i}`
      return {
        ...node,
        id: path,
        path,
        depth: prefix ? prefix.split('.').length : 0,
        children: node.children ? walk(node.children, path) : undefined,
      }
    })
  }
  return walk(roots, '')
}
