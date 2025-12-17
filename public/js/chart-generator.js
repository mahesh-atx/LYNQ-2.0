/*
  chart-generator.js
  Chart.js wrapper for data visualization in LYNQ AI
*/

// Chart color palette (modern, vibrant)
const CHART_COLORS = [
  'rgba(102, 126, 234, 0.8)',  // Purple-blue
  'rgba(245, 158, 11, 0.8)',   // Orange
  'rgba(16, 185, 129, 0.8)',   // Green
  'rgba(236, 72, 153, 0.8)',   // Pink
  'rgba(139, 92, 246, 0.8)',   // Purple
  'rgba(6, 182, 212, 0.8)',    // Cyan
  'rgba(251, 146, 60, 0.8)',   // Light orange
  'rgba(167, 139, 250, 0.8)'   // Light purple
];

const CHART_BORDERS = CHART_COLORS.map(c => c.replace('0.8', '1'));

// Store chart instances for cleanup
const dataChartInstances = new Map();

/**
 * Detect best chart type based on data characteristics
 */
function detectBestChartType(data) {
  const { headers, stats } = data;
  const numericColumns = Object.entries(stats.columns)
    .filter(([_, s]) => s.type === 'numeric');
  
  // Time series detection (if first column looks like dates/months)
  const firstColValues = data.data.map(row => row[headers[0]]);
  const looksLikeTimeSeries = firstColValues.every(v => 
    typeof v === 'string' && (
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(v) ||
      /^\d{4}[-\/]\d{2}/.test(v) ||
      /^(q[1-4]|week|month)/i.test(v)
    )
  );
  
  if (looksLikeTimeSeries && numericColumns.length >= 1) {
    return 'line';
  }
  
  // Pie chart for single numeric column with few categories
  if (numericColumns.length === 1 && data.data.length <= 8) {
    return 'pie';
  }
  
  // Scatter for comparing two numeric columns
  if (numericColumns.length === 2 && data.data.length > 5) {
    return 'scatter';
  }
  
  // Default to bar chart
  return 'bar';
}

/**
 * Create a chart in a container
 * @param {string} containerId - ID of the container element
 * @param {string} chartType - Type of chart (bar, line, pie, scatter)
 * @param {Object} data - Parsed data object
 * @param {Object} options - Chart options
 * @returns {Chart} Chart.js instance
 */
function createChart(containerId, chartType, data, options = {}) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded');
    return null;
  }
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return null;
  }
  
  // Clean up existing chart
  if (dataChartInstances.has(containerId)) {
    dataChartInstances.get(containerId).destroy();
  }
  
  // Create canvas if not exists
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  
  const ctx = canvas.getContext('2d');
  const chartData = prepareChartData(chartType, data, options);
  
  const chart = new Chart(ctx, {
    type: chartType === 'scatter' ? 'scatter' : chartType,
    data: chartData,
    options: getChartOptions(chartType, options)
  });
  
  dataChartInstances.set(containerId, chart);
  return chart;
}

/**
 * Prepare data for Chart.js format
 */
function prepareChartData(chartType, data, options = {}) {
  const { headers, data: rows, stats } = data;
  
  // Get label column (usually first column)
  const labelCol = options.labelColumn || headers[0];
  const labels = rows.map(row => row[labelCol]);
  
  // Get numeric columns for datasets
  const numericCols = headers.filter(h => 
    stats.columns[h]?.type === 'numeric' && h !== labelCol
  );
  
  // Use specified columns or all numeric
  const dataCols = options.dataColumns || numericCols.slice(0, 4);
  
  if (chartType === 'pie' || chartType === 'doughnut') {
    // Pie needs single dataset
    const dataCol = dataCols[0] || numericCols[0];
    return {
      labels: labels,
      datasets: [{
        data: rows.map(row => row[dataCol]),
        backgroundColor: CHART_COLORS.slice(0, rows.length),
        borderColor: CHART_BORDERS.slice(0, rows.length),
        borderWidth: 2
      }]
    };
  }
  
  if (chartType === 'scatter') {
    // Scatter needs x,y pairs
    const xCol = dataCols[0] || numericCols[0];
    const yCol = dataCols[1] || numericCols[1];
    return {
      datasets: [{
        label: `${xCol} vs ${yCol}`,
        data: rows.map(row => ({ x: row[xCol], y: row[yCol] })),
        backgroundColor: CHART_COLORS[0],
        borderColor: CHART_BORDERS[0],
        pointRadius: 6
      }]
    };
  }
  
  // Bar and Line charts
  const datasets = dataCols.map((col, i) => ({
    label: col,
    data: rows.map(row => row[col]),
    backgroundColor: chartType === 'line' 
      ? CHART_COLORS[i].replace('0.8', '0.2')
      : CHART_COLORS[i],
    borderColor: CHART_BORDERS[i],
    borderWidth: 2,
    tension: 0.3,
    fill: chartType === 'line'
  }));
  
  return { labels, datasets };
}

/**
 * Get chart options based on type
 */
function getChartOptions(chartType, customOptions = {}) {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb',
          font: { family: 'Inter, sans-serif', size: 12 }
        }
      },
      title: {
        display: !!customOptions.title,
        text: customOptions.title || '',
        color: '#f3f4f6',
        font: { family: 'Inter, sans-serif', size: 16, weight: 'bold' }
      }
    }
  };
  
  if (chartType !== 'pie' && chartType !== 'doughnut') {
    baseOptions.scales = {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' }
      }
    };
  }
  
  return { ...baseOptions, ...customOptions };
}

/**
 * Create chart from AI instruction (parse text command)
 * @param {string} instruction - e.g., "Create a bar chart of Sales by Month"
 * @param {Object} data - Parsed data object
 * @returns {Object} Chart configuration
 */
function parseChartInstruction(instruction, data) {
  const lower = instruction.toLowerCase();
  
  // Detect chart type
  let chartType = 'bar';
  if (lower.includes('line') || lower.includes('trend')) chartType = 'line';
  if (lower.includes('pie') || lower.includes('distribution')) chartType = 'pie';
  if (lower.includes('scatter') || lower.includes('correlation')) chartType = 'scatter';
  if (lower.includes('doughnut') || lower.includes('donut')) chartType = 'doughnut';
  
  // Try to detect columns from instruction
  const { headers } = data;
  const mentionedColumns = headers.filter(h => 
    lower.includes(h.toLowerCase())
  );
  
  return {
    chartType,
    dataColumns: mentionedColumns.length > 0 ? mentionedColumns : null,
    title: instruction
  };
}

/**
 * Generate chart HTML for insertion into chat
 */
function generateChartHTML(chartId, height = 300) {
  return `
    <div class="chart-container" id="${chartId}" style="height: ${height}px; width: 100%; margin: 16px 0;">
      <canvas></canvas>
    </div>
  `;
}

/**
 * Destroy all chart instances
 */
function destroyAllCharts() {
  dataChartInstances.forEach(chart => chart.destroy());
  dataChartInstances.clear();
}

// Export for global access
window.detectBestChartType = detectBestChartType;
window.createChart = createChart;
window.parseChartInstruction = parseChartInstruction;
window.generateChartHTML = generateChartHTML;
window.destroyAllCharts = destroyAllCharts;
window.CHART_COLORS = CHART_COLORS;
