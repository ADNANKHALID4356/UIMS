/**
 * ExportService — Sprint 7: PDF & Excel Export
 * Client-side export using jsPDF + SheetJS patterns
 * Works in renderer process (browser context)
 * 
 * Note: Since we're in an Electron app without bundled jsPDF/xlsx,
 * we use a lightweight approach: generate CSV (universally importable)
 * and printable HTML (for PDF via window.print).
 */

/**
 * Export data as CSV file
 * @param {Array<object>} data - Array of row objects
 * @param {string} filename - Filename without extension
 * @param {Array<string>} columns - Optional column keys to include
 */
export function exportToCSV(data, filename = 'export', columns = null) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const keys = columns || Object.keys(data[0]);
  
  // Header row
  const header = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(',');

  // Data rows
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val = row[k];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export report data as a printable HTML page (opens print dialog → Save as PDF)
 * @param {string} title - Report title
 * @param {string} htmlContent - Rendered HTML table/content
 * @param {object} meta - Optional metadata (dates, generated_at, etc.)
 */
export function exportToPDF(title, htmlContent, meta = {}) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for PDF export.');
    return;
  }

  const metaLines = [];
  if (meta.start_date && meta.end_date) {
    metaLines.push(`<p style="color:#666;font-size:12px;">Period: ${meta.start_date} to ${meta.end_date}</p>`);
  }
  if (meta.generated_at) {
    metaLines.push(`<p style="color:#666;font-size:12px;">Generated: ${new Date(meta.generated_at).toLocaleString()}</p>`);
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { font-size: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; padding: 8px; border: 1px solid #d1d5db; font-weight: 600; }
        td { padding: 6px 8px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        .summary { display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
        .summary-card { padding: 12px 16px; background: #f3f4f6; border-radius: 6px; min-width: 140px; }
        .summary-card .label { font-size: 11px; color: #6b7280; }
        .summary-card .value { font-size: 18px; font-weight: bold; color: #111827; }
        .text-right { text-align: right; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${metaLines.join('')}
      ${htmlContent}
      <script>
        setTimeout(() => { window.print(); window.close(); }, 500);
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Build an HTML table string from data array
 * @param {Array<object>} data
 * @param {Array<{key: string, label: string, align?: string, format?: Function}>} columns
 */
export function buildHTMLTable(data, columns) {
  if (!data || data.length === 0) return '<p>No data available</p>';

  const headerCells = columns
    .map((c) => `<th${c.align === 'right' ? ' class="text-right"' : ''}>${c.label}</th>`)
    .join('');

  const bodyRows = data
    .map((row) => {
      const cells = columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.format ? c.format(raw) : (raw ?? '');
          return `<td${c.align === 'right' ? ' class="text-right"' : ''}>${val}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

/**
 * Build summary cards HTML for PDF
 */
export function buildSummaryCards(items) {
  const cards = items
    .map((item) => `<div class="summary-card"><div class="label">${item.label}</div><div class="value">${item.value}</div></div>`)
    .join('');
  return `<div class="summary">${cards}</div>`;
}

/**
 * Export data as Excel (.xlsx) file using ExcelJS
 * @param {Array<object>} data - Array of row objects
 * @param {string} filename - Filename without extension
 * @param {Array<{key: string, label: string, width?: number}>} columns - Column definitions
 * @param {object} options - Optional: { sheetName, title, meta }
 */
export async function exportToExcel(data, filename = 'export', columns = null, options = {}) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Enterprise Inventory System';
    workbook.created = new Date();

    const sheetName = options.sheetName || 'Report';
    const sheet = workbook.addWorksheet(sheetName);

    // Resolve columns
    const keys = columns
      ? columns.map((c) => (typeof c === 'string' ? { key: c, label: c } : c))
      : Object.keys(data[0]).map((k) => ({ key: k, label: k }));

    // Title row (optional)
    let startRow = 1;
    if (options.title) {
      sheet.mergeCells(1, 1, 1, keys.length);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = options.title;
      titleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } };
      titleCell.alignment = { horizontal: 'center' };
      startRow = 2;

      // Meta row (date range, generated time)
      if (options.meta) {
        const parts = [];
        if (options.meta.start_date && options.meta.end_date) {
          parts.push(`Period: ${options.meta.start_date} to ${options.meta.end_date}`);
        }
        if (options.meta.generated_at) {
          parts.push(`Generated: ${new Date(options.meta.generated_at).toLocaleString()}`);
        }
        if (parts.length > 0) {
          sheet.mergeCells(2, 1, 2, keys.length);
          const metaCell = sheet.getCell(2, 1);
          metaCell.value = parts.join('  |  ');
          metaCell.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
          metaCell.alignment = { horizontal: 'center' };
          startRow = 3;
        }
      }
      startRow += 1; // blank row
    }

    // Header row
    const headerRow = sheet.getRow(startRow);
    keys.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 24;

    // Data rows
    data.forEach((row, rowIdx) => {
      const excelRow = sheet.getRow(startRow + 1 + rowIdx);
      keys.forEach((col, colIdx) => {
        const cell = excelRow.getCell(colIdx + 1);
        const raw = row[col.key];
        cell.value = raw !== null && raw !== undefined ? raw : '';
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        // Alternate row fill
        if (rowIdx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }
      });
    });

    // Auto-width columns
    keys.forEach((col, idx) => {
      const maxLen = Math.max(
        col.label.length,
        ...data.map((r) => String(r[col.key] ?? '').length)
      );
      sheet.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 2, 10), 40);
    });

    // Auto-filter
    sheet.autoFilter = {
      from: { row: startRow, column: 1 },
      to: { row: startRow, column: keys.length },
    };

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, `${filename}.xlsx`);
  } catch (err) {
    console.error('Excel export failed:', err);
    // Fallback to CSV
    console.warn('Falling back to CSV export');
    const fallbackColumns = columns
      ? columns.map((c) => (typeof c === 'string' ? c : c.key))
      : null;
    exportToCSV(data, filename, fallbackColumns);
  }
}

/**
 * Helper: trigger download of a Blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default { exportToCSV, exportToPDF, exportToExcel, buildHTMLTable, buildSummaryCards };
