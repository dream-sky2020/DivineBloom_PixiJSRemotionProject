export function getDirectChildren(parent: Element): Element[] {
  return Array.from(parent.children) as Element[];
}

export function getDirectChildByTag(parent: Element, tagName: string): Element | undefined {
  return getDirectChildren(parent).find((child) => child.tagName === tagName);
}
