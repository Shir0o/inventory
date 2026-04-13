/**
 * Utility to convert an array of objects to a CSV string and trigger a download.
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Extract headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV rows
  const csvRows = [
    // Header row
    headers.join(','),
    // Data rows
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle special cases: null/undefined, strings with commas, dates
        if (value === null || value === undefined) return '';
        
        let stringValue = '';
        if (value instanceof Date) {
          stringValue = value.toISOString();
        } else if (typeof value === 'object' && value.toDate) {
          // Handle Firebase Timestamps
          stringValue = value.toDate().toISOString();
        } else {
          stringValue = String(value);
        }

        // Escape quotes and wrap in quotes if contains comma or newline
        const escaped = stringValue.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') 
          ? `"${escaped}"` 
          : escaped;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
