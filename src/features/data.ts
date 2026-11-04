// Plugin data is stored as *shared* plugin data under a fixed namespace, not private plugin data.
// Private data is only readable by the exact plugin ID that wrote it; shared data is readable by
// any copy of this plugin (dev import, published, a colleague's build), so notes work for everyone.
// Legacy private data written by earlier versions is still read, and cleared when next written.

export const DATA_NAMESPACE = 'uxdannotations';

export function getData(node: BaseNode, key: string): string {
  const shared = node.getSharedPluginData(DATA_NAMESPACE, key);
  return shared !== '' ? shared : node.getPluginData(key);
}

export function setData(node: BaseNode, key: string, value: string): void {
  node.setSharedPluginData(DATA_NAMESPACE, key, value);
  if (node.getPluginData(key) !== '') node.setPluginData(key, ''); // drop migrated legacy value
}
