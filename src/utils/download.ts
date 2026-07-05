/** Trigger a browser download for an in-memory blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Download plain text (or any string content) as a file. */
export function downloadText(
  content: string,
  fileName: string,
  mime = 'text/plain;charset=utf-8',
): void {
  downloadBlob(new Blob([content], { type: mime }), fileName)
}

/** Download a JSON-serializable value with pretty formatting. */
export function downloadJson(data: unknown, fileName: string): void {
  downloadText(JSON.stringify(data, null, 2), fileName, 'application/json')
}
