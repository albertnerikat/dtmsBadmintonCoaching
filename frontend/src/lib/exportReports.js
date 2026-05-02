/**
 * Export report data as CSV
 */
export function exportAsCSV(reportData) {
  const { period, filters, summary, students } = reportData;

  // Header rows
  const headers = [
    ['Period Outstanding Report'],
    [`Date Range: ${period.start_date} to ${period.end_date}`],
    [`Filters: Age Category=${filters.age_category || 'All'}, Hide Free=${filters.hide_free_only}`],
    [],
    ['Summary'],
    [`Total Students: ${summary.total_students}`],
    [`Total Previous Balance: $${summary.total_previous_balance.toFixed(2)}`],
    [`Total Period Outstanding: $${summary.total_period_outstanding.toFixed(2)}`],
    [`Total Outstanding: $${summary.total_outstanding.toFixed(2)}`],
    [],
    ['Student Details'],
  ];

  // Column headers
  const columnHeaders = [
    'Student Name',
    'Age Category',
    'Previous Balance',
    'Period Outstanding',
    'Total Outstanding',
  ];

  // Data rows
  const dataRows = students.map(s => [
    s.name,
    s.age_category,
    `$${s.previous_balance.toFixed(2)}`,
    `$${s.period_outstanding.toFixed(2)}`,
    `$${s.total_outstanding.toFixed(2)}`,
  ]);

  // Combine all rows
  const allRows = [...headers, columnHeaders, ...dataRows];

  // Convert to CSV
  const csv = allRows.map(row =>
    row.map(cell => {
      // Escape cells with commas or quotes
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reports_outstanding_${period.start_date}_to_${period.end_date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export report data as PDF
 * Note: This sends data to backend for PDF generation
 */
export async function exportAsPDF(reportData) {
  try {
    const response = await fetch('/api/reports/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports_outstanding_${reportData.period.start_date}_to_${reportData.period.end_date}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Error exporting PDF: ${error.message}`);
  }
}
