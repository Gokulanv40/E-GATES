const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Export tabular data to Excel buffer
 * @param {Array<{header: string, key: string, width?: number}>} columns
 * @param {Array<Object>} data
 * @param {string} [sheetName='Report']
 * @returns {Promise<Buffer>}
 */
async function exportToExcel(columns, data, sheetName = 'Report') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Layout Association System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Configure Columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 5, 15),
  }));

  // Format Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Dark blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Add Data Rows
  data.forEach((item, index) => {
    const row = worksheet.addRow(item);
    row.height = 20;

    // Alternating zebra striping
    const isEven = index % 2 === 0;
    row.eachCell((cell) => {
      cell.font = { size: 10 };
      cell.alignment = { vertical: 'middle' };
      if (!isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

/**
 * Export tabular data to PDF buffer
 * @param {string} title
 * @param {Array<{header: string, key: string, width?: number}>} columns
 * @param {Array<Object>} data
 * @returns {Promise<Buffer>}
 */
function exportToPdf(title, columns, data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header Banner
      doc.rect(40, 40, doc.page.width - 80, 50).fill('#1E40AF');

      doc.fillColor('#FFFFFF')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(title, 55, 52, { width: doc.page.width - 110, align: 'left' });

      doc.fillColor('#93C5FD')
        .fontSize(9)
        .font('Helvetica')
        .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 55, 72);

      let yPos = 110;
      const startX = 40;
      const printableWidth = doc.page.width - 80;
      const colCount = columns.length;
      const colWidth = printableWidth / colCount;

      // Table Header Row
      doc.rect(startX, yPos, printableWidth, 24).fill('#E2E8F0');
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);

      columns.forEach((col, i) => {
        const x = startX + i * colWidth;
        doc.text(col.header, x + 4, yPos + 7, {
          width: colWidth - 8,
          align: 'left',
          ellipsis: true,
        });
      });

      yPos += 26;

      // Table Rows
      doc.font('Helvetica').fontSize(8);
      data.forEach((row, index) => {
        // Page break check
        if (yPos > doc.page.height - 70) {
          doc.addPage();
          yPos = 50;

          // Repeat headers on new page
          doc.rect(startX, yPos, printableWidth, 24).fill('#E2E8F0');
          doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
          columns.forEach((col, i) => {
            const x = startX + i * colWidth;
            doc.text(col.header, x + 4, yPos + 7, {
              width: colWidth - 8,
              align: 'left',
              ellipsis: true,
            });
          });
          yPos += 26;
          doc.font('Helvetica').fontSize(8);
        }

        // Row background
        if (index % 2 === 1) {
          doc.rect(startX, yPos, printableWidth, 20).fill('#F8FAFC');
        }

        doc.fillColor('#334155');
        columns.forEach((col, i) => {
          const x = startX + i * colWidth;
          const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '';
          doc.text(val, x + 4, yPos + 5, {
            width: colWidth - 8,
            align: 'left',
            ellipsis: true,
          });
        });

        // Bottom border line
        doc.strokeColor('#E2E8F0').lineWidth(0.5)
          .moveTo(startX, yPos + 20)
          .lineTo(startX + printableWidth, yPos + 20)
          .stroke();

        yPos += 21;
      });

      // Add footers on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#64748B')
          .fontSize(8)
          .font('Helvetica')
          .text(
            'Powered by JishnuInfotech — Layout Association Management System',
            40,
            doc.page.height - 35,
            { align: 'center', width: doc.page.width - 80 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  exportToExcel,
  exportToPdf,
};
