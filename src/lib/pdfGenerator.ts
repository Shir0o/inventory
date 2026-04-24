import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateMonthlyReport = (
  inventory: any[],
  events: any[],
  auditLogs: any[],
  settings: any
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const date = new Date();
  const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });

  // --- Header ---
  doc.setFillColor(10, 37, 64); // Primary color
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.orgName || 'LITERATURE INVENTORY SYSTEM', 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`MONTHLY DISTRIBUTION REPORT - ${monthYear.toUpperCase()}`, 20, 30);

  // --- Summary Section ---
  doc.setTextColor(10, 37, 64);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 20, 55);

  const totalItems = inventory.length;
  const totalStock = inventory.reduce((acc, item) => acc + (item.stockLevel || 0), 0);
  const totalDistributions = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);
  const lowStockItems = inventory.filter(item => item.status === 'Low' || item.status === 'Out').length;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Unique Items: ${totalItems}`, 20, 65);
  doc.text(`Total Units in Stock: ${totalStock.toLocaleString()}`, 20, 72);
  doc.text(`Total Materials Distributed (Lifetime): ${totalDistributions.toLocaleString()}`, 20, 79);
  doc.text(`Critical/Low Stock Items: ${lowStockItems}`, 20, 86);

  // --- Distributions Table ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Recent Distribution Events', 20, 110);

  const eventRows = events.slice(0, 10).map(event => [
    event.name,
    event.date?.toDate ? event.date.toDate().toLocaleDateString() : new Date(event.date).toLocaleDateString(),
    event.location,
    event.materialsDistributed.toLocaleString(),
    event.status
  ]);

  doc.autoTable({
    startY: 115,
    head: [['Event Name', 'Date', 'Location', 'Distributed', 'Status']],
    body: eventRows,
    headStyles: { fillColor: [10, 37, 64] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 20, right: 20 }
  });

  // --- Low Stock Table ---
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Low Stock Alerts', 20, finalY + 15);

  const lowStockRows = inventory
    .filter(item => item.status === 'Low' || item.status === 'Out')
    .map(item => [
      item.sku,
      item.title,
      item.category,
      item.stockLevel.toLocaleString(),
      item.status
    ]);

  doc.autoTable({
    startY: finalY + 20,
    head: [['SKU', 'Title', 'Category', 'Stock Level', 'Status']],
    body: lowStockRows,
    headStyles: { fillColor: [255, 115, 105] }, // Tertiary color for alerts
    alternateRowStyles: { fillColor: [255, 245, 245] },
    margin: { left: 20, right: 20 }
  });

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`Monthly_Report_${monthYear.replace(' ', '_')}.pdf`);
};
