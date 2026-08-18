export type WorkbookSheet = {
  name: string;
  rows: Record<string, any>[];
};

const loadXLSX = () => import('xlsx');

export async function exportWorkbook(fileName: string, sheets: WorkbookSheet[]): Promise<void> {
  const XLSX = await loadXLSX();
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const safeName = (sheet.name || 'Sheet').slice(0, 31);
    const rows = sheet.rows.length > 0 ? sheet.rows : [{ note: 'No data' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  });

  XLSX.writeFile(workbook, fileName);
}
