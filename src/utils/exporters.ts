export const exportToFountain = (htmlContent: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  let fountain = '';

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const className = element.className;
      const text = element.textContent?.trim() || '';

      if (className.includes('scene-heading')) {
        fountain += `${text.toUpperCase()}\n\n`;
      } else if (className.includes('character')) {
        fountain += `${text.toUpperCase()}\n`;
      } else if (className.includes('dialogue')) {
        fountain += `${text}\n\n`;
      } else if (className.includes('action')) {
        fountain += `${text}\n\n`;
      } else if (className.includes('transition')) {
        fountain += `${text.toUpperCase()}\n\n`;
      }
    }
  });

  return fountain;
};

export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPDF = async (element: HTMLElement, filename: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const styles = `
    <style>
      @page { margin: 1in; }
      body { font-family: 'Courier New', monospace; font-size: 12pt; }
      .scene-heading { text-transform: uppercase; font-weight: bold; margin: 2em 0 1em; }
      .character { text-transform: uppercase; margin: 1em 0 0 2in; }
      .dialogue { margin: 0 1.5in 1em 1in; }
      .action { margin: 1em 0; }
      .transition { text-transform: uppercase; text-align: right; margin: 1em 0; }
    </style>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        ${styles}
      </head>
      <body>${element.innerHTML}</body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};
