import type { Cell, Column, Row, Worksheet } from 'exceljs';

export interface Merge {
  address: string;
  master: Cell;
  cells: Cell[];
}

export interface SheetItem {
  id: number;
  name: string;
  columns: Column[];
  rows: Row[];
  merges: Merge[];
  worksheet: Worksheet;
  // rendered: boolean
}
