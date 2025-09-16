export interface CsvParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseCsv(content: string): CsvParseResult {
  const text = normalizeNewlines(content);
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      const nextChar = text[i + 1];
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (inQuotes) {
    // Unterminated quote, push the current field to avoid losing data
    currentRow.push(currentField);
  } else if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const cleanedRows = rows
    .map(row => row.map(cell => cell.replace(/\ufeff/g, '')))
    .filter(row => row.some(cell => cell.trim() !== ''));

  if (cleanedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = cleanedRows[0].map(cell => cell.trim());
  const dataRows = cleanedRows.slice(1).map(row => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const key = header;
      const value = row[index] ?? '';
      record[key] = value.trim();
    });
    return record;
  });

  return { headers, rows: dataRows };
}

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  const text = await file.text();
  return parseCsv(text);
}
