/*
  data-analysis.js
  Core data analysis functionality for LYNQ AI
  - CSV/JSON/Excel parsing
  - Statistical calculations
  - Data structure normalization
*/

// --- DATA STATE ---
let currentDataSet = null; // Holds parsed data { headers: [], rows: [], stats: {} }

// ============================================
// FILE PARSING FUNCTIONS
// ============================================

/**
 * Parse CSV text into structured data
 * @param {string} text - CSV content
 * @returns {Object} { headers: string[], rows: any[][], data: object[] }
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return null;

  // Parse headers (first row)
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows = [];
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      rows.push(values);
      
      // Create object with header keys
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = autoConvertType(values[idx]);
      });
      data.push(rowObj);
    }
  }

  return { headers, rows, data };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

/**
 * Auto-convert string values to appropriate types
 */
function autoConvertType(value) {
  if (value === '' || value === null || value === undefined) return null;
  
  // Try number
  const num = parseFloat(value);
  if (!isNaN(num) && isFinite(num)) return num;
  
  // Try boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // Return as string
  return value;
}

/**
 * Parse JSON text into structured data
 * @param {string} text - JSON content
 * @returns {Object} { headers: string[], rows: any[][], data: object[] }
 */
function parseJSON(text) {
  try {
    const parsed = JSON.parse(text);
    
    // Handle array of objects
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      const headers = Object.keys(parsed[0]);
      const rows = parsed.map(obj => headers.map(h => obj[h]));
      return { headers, rows, data: parsed };
    }
    
    // Handle single object with arrays
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const headers = Object.keys(parsed);
      const firstVal = parsed[headers[0]];
      
      if (Array.isArray(firstVal)) {
        const rowCount = firstVal.length;
        const rows = [];
        const data = [];
        
        for (let i = 0; i < rowCount; i++) {
          const row = headers.map(h => parsed[h][i]);
          rows.push(row);
          
          const rowObj = {};
          headers.forEach((h, idx) => rowObj[h] = row[idx]);
          data.push(rowObj);
        }
        
        return { headers, rows, data };
      }
    }
    
    return null;
  } catch (e) {
    console.error('JSON parse error:', e);
    return null;
  }
}

/**
 * Parse Excel file using SheetJS (xlsx library)
 * @param {ArrayBuffer} buffer - Excel file content
 * @returns {Object} { headers: string[], rows: any[][], data: object[] }
 */
function parseExcel(buffer) {
  if (typeof XLSX === 'undefined') {
    console.error('XLSX library not loaded');
    return null;
  }
  
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    if (jsonData.length === 0) return null;
    
    const headers = jsonData[0].map(h => String(h));
    const rows = jsonData.slice(1);
    const data = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = autoConvertType(row[i]));
      return obj;
    });
    
    return { headers, rows, data };
  } catch (e) {
    console.error('Excel parse error:', e);
    return null;
  }
}

// ============================================
// STATISTICAL FUNCTIONS
// ============================================

/**
 * Calculate basic statistics for a numeric column
 */
function calculateColumnStats(values) {
  const numbers = values.filter(v => typeof v === 'number' && !isNaN(v));
  
  if (numbers.length === 0) {
    return { type: 'non-numeric', count: values.length };
  }
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  const mean = sum / numbers.length;
  
  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  
  // Mode
  const frequency = {};
  numbers.forEach(n => frequency[n] = (frequency[n] || 0) + 1);
  const maxFreq = Math.max(...Object.values(frequency));
  const mode = Object.keys(frequency)
    .filter(k => frequency[k] === maxFreq)
    .map(Number);
  
  // Standard deviation
  const variance = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    type: 'numeric',
    count: numbers.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sum: sum,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    mode: mode.length <= 3 ? mode : mode.slice(0, 3),
    stdDev: Math.round(stdDev * 100) / 100,
    range: sorted[sorted.length - 1] - sorted[0]
  };
}

/**
 * Calculate statistics for entire dataset
 */
function calculateDatasetStats(parsedData) {
  const { headers, data } = parsedData;
  const stats = {
    rowCount: data.length,
    columnCount: headers.length,
    columns: {}
  };
  
  headers.forEach(header => {
    const values = data.map(row => row[header]);
    stats.columns[header] = calculateColumnStats(values);
  });
  
  return stats;
}

/**
 * Calculate correlation between two numeric columns
 */
function calculateCorrelation(col1Values, col2Values) {
  const pairs = [];
  for (let i = 0; i < col1Values.length; i++) {
    if (typeof col1Values[i] === 'number' && typeof col2Values[i] === 'number') {
      pairs.push([col1Values[i], col2Values[i]]);
    }
  }
  
  if (pairs.length < 3) return null;
  
  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p[0], 0);
  const sumY = pairs.reduce((s, p) => s + p[1], 0);
  const sumXY = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = pairs.reduce((s, p) => s + p[0] * p[0], 0);
  const sumY2 = pairs.reduce((s, p) => s + p[1] * p[1], 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  
  return Math.round((numerator / denominator) * 1000) / 1000;
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Process uploaded data file
 * @param {File} file - The uploaded file
 * @returns {Promise<Object>} Parsed and analyzed data
 */
async function processDataFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileType = file.type || getFileTypeFromName(file.name);
    
    reader.onload = function(e) {
      let parsed = null;
      
      if (fileType === 'text/csv' || file.name.endsWith('.csv')) {
        parsed = parseCSV(e.target.result);
      } else if (fileType === 'application/json' || file.name.endsWith('.json')) {
        parsed = parseJSON(e.target.result);
      } else if (file.name.match(/\.xlsx?$/i)) {
        parsed = parseExcel(e.target.result);
      }
      
      if (!parsed) {
        reject(new Error('Could not parse file. Supported formats: CSV, JSON, Excel'));
        return;
      }
      
      // Calculate statistics
      parsed.stats = calculateDatasetStats(parsed);
      parsed.fileName = file.name;
      
      // Store globally
      currentDataSet = parsed;
      
      console.log(`📊 Data Analysis: Parsed ${parsed.stats.rowCount} rows, ${parsed.stats.columnCount} columns`);
      resolve(parsed);
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    // Read based on file type
    if (file.name.match(/\.xlsx?$/i)) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}

/**
 * Get file type from filename extension
 */
function getFileTypeFromName(name) {
  if (name.endsWith('.csv')) return 'text/csv';
  if (name.endsWith('.json')) return 'application/json';
  if (name.match(/\.xlsx?$/i)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'unknown';
}

/**
 * Get current dataset
 */
function getCurrentDataSet() {
  return currentDataSet;
}

/**
 * Clear current dataset
 */
function clearDataSet() {
  currentDataSet = null;
}

/**
 * Generate a summary string for the AI
 * Sends ALL data for small files, sample for large files
 */
function generateDataSummaryForAI(data) {
  if (!data) return '';
  
  const { headers, stats, data: rows } = data;
  const MAX_ROWS_FULL = 100;  // Send all data if <= 100 rows
  const MAX_ROWS_SAMPLE = 50; // Otherwise send first 50 rows
  
  let summary = `\n--- UPLOADED DATA FILE ---\n`;
  summary += `File: ${data.fileName}\n`;
  summary += `Total Rows: ${stats.rowCount}, Columns: ${stats.columnCount}\n`;
  summary += `Column Names: ${headers.join(', ')}\n\n`;
  
  // Column statistics
  summary += `Column Statistics:\n`;
  for (const [col, colStats] of Object.entries(stats.columns)) {
    if (colStats.type === 'numeric') {
      summary += `- ${col}: min=${colStats.min}, max=${colStats.max}, mean=${colStats.mean}, median=${colStats.median}\n`;
    } else {
      summary += `- ${col}: categorical (${colStats.count} values)\n`;
    }
  }
  
  // Determine how many rows to send
  const isSmallDataset = rows.length <= MAX_ROWS_FULL;
  const rowsToSend = isSmallDataset ? rows : rows.slice(0, MAX_ROWS_SAMPLE);
  
  if (isSmallDataset) {
    summary += `\n=== COMPLETE DATA (all ${rows.length} rows) ===\n`;
  } else {
    summary += `\n=== DATA SAMPLE (first ${MAX_ROWS_SAMPLE} of ${rows.length} rows) ===\n`;
    summary += `NOTE: This is a sample. For queries requiring ALL data, inform user that only partial data is visible.\n`;
  }
  
  // Send data in table format
  summary += headers.join(' | ') + '\n';
  summary += headers.map(() => '---').join(' | ') + '\n';
  rowsToSend.forEach(row => {
    summary += headers.map(h => row[h] ?? '').join(' | ') + '\n';
  });
  
  summary += `\n--- END DATA FILE ---\n`;
  return summary;
}

/**
 * Generate HTML preview table for the chat
 */
function generateDataPreviewHTML(data, maxRows = 10) {
  if (!data) return '';
  
  const { headers, data: rows, stats } = data;
  
  let html = `<div class="data-preview-container">`;
  
  // Stats summary cards
  html += `<div class="data-stats-row">`;
  html += `<div class="stat-card"><span class="stat-value">${stats.rowCount}</span><span class="stat-label">Rows</span></div>`;
  html += `<div class="stat-card"><span class="stat-value">${stats.columnCount}</span><span class="stat-label">Columns</span></div>`;
  
  // Find numeric columns count
  const numericCols = Object.values(stats.columns).filter(c => c.type === 'numeric').length;
  html += `<div class="stat-card"><span class="stat-value">${numericCols}</span><span class="stat-label">Numeric</span></div>`;
  html += `</div>`;
  
  // Data table
  html += `<div class="data-table-wrapper"><table class="data-preview-table">`;
  html += `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  html += `<tbody>`;
  
  const displayRows = rows.slice(0, maxRows);
  displayRows.forEach(row => {
    html += `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`;
  });
  
  if (rows.length > maxRows) {
    html += `<tr><td colspan="${headers.length}" class="more-rows">... and ${rows.length - maxRows} more rows</td></tr>`;
  }
  
  html += `</tbody></table></div>`;
  html += `</div>`;
  
  return html;
}

// Export functions for global access
window.parseCSV = parseCSV;
window.parseJSON = parseJSON;
window.parseExcel = parseExcel;
window.processDataFile = processDataFile;
window.getCurrentDataSet = getCurrentDataSet;
window.clearDataSet = clearDataSet;
window.generateDataSummaryForAI = generateDataSummaryForAI;
window.generateDataPreviewHTML = generateDataPreviewHTML;
window.calculateColumnStats = calculateColumnStats;
window.calculateCorrelation = calculateCorrelation;
