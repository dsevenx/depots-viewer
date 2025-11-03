/**
 * CSV utility functions for import/export
 */

/**
 * Result of parsing a CSV file
 */
export interface ParseResult<T> {
  success: T[];
  errors: { row: number; error: string }[];
}

/**
 * Detects the delimiter used in a CSV file (comma or semicolon)
 */
function detectDelimiter(csvString: string): ',' | ';' {
  const firstLine = csvString.split('\n')[0];
  if (!firstLine) return ',';

  let commaCount = 0;
  let semicolonCount = 0;
  let insideQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];

    if (char === '"') {
      if (insideQuotes && firstLine[i + 1] === '"') {
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (!insideQuotes) {
      if (char === ',') commaCount++;
      else if (char === ';') semicolonCount++;
    }
  }

  // Use semicolon if there are more semicolons than commas
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Converts an array of objects to CSV string
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headers: string[]
): string {
  if (data.length === 0) return headers.join(',') + '\n';

  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle dates
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        // Escape values containing commas or quotes
        const stringValue = String(value ?? '');
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ];

  return csvRows.join('\n');
}

/**
 * Parses CSV header row with specified delimiter
 */
function parseCSVHeader(line: string, delimiter: ',' | ';'): string[] {
  const headers: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let j = 0; j < line.length; j++) {
    const char = line[j];

    if (char === '"') {
      if (insideQuotes && line[j + 1] === '"') {
        currentValue += '"';
        j++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      headers.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  headers.push(currentValue.trim());
  return headers;
}

/**
 * Parses CSV string to array of objects
 * Automatically detects delimiter (comma or semicolon)
 */
export function csvToArray(csvString: string): Record<string, string>[] {
  const lines = csvString.trim().split('\n');
  if (lines.length <= 1) return []; // Need at least header + 1 data row

  // Detect delimiter from first line
  const delimiter = detectDelimiter(csvString);

  // Parse header row properly with detected delimiter
  const headers = parseCSVHeader(lines[0], delimiter);
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        if (insideQuotes && line[j + 1] === '"') {
          // Escaped quote
          currentValue += '"';
          j++;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        // End of value
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    // Push last value
    values.push(currentValue.trim());

    // Create object from headers and values
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    result.push(obj);
  }

  return result;
}

/**
 * Downloads a file with given content and filename
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads a file uploaded by user
 */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
    reader.readAsText(file);
  });
}
