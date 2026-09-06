function toCsvField(value: string): string {
  return /["\r\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Same escaping/blob/download-link mechanics as ListView's built-in CSV
 * export, factored out for the couple of screens (Dashboard, Budget Report)
 * that export an already-fully-loaded small dataset rather than walking
 * paginated API results. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [
    headers.map(toCsvField).join(','),
    ...rows.map((row) => row.map((cell) => toCsvField(cell === null || cell === undefined ? '' : String(cell))).join(',')),
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
