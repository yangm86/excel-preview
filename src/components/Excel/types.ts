import type { Cell as ExcelCell, Column, Row, Worksheet } from 'exceljs';

export interface Merge {
  address: string;
  master: Cell;
  cells: Cell[];
}

export type IRow = Row & {
  top: number;
};
export type IColumn = Column & {
  left: number;
};

export interface SheetItem {
  id: number;
  name: string;
  columns: IColumn[];
  rows: IRow[];
  merges: Merge[];
  worksheet: Worksheet;
  // rendered: boolean

  columnsSlice: [number, number, number][];
  rowsSlice: [number, number, number][];
}

export type Cell = ExcelCell & {
  _address: string;
  _column: IColumn;
  _row: IRow;
  master: Cell;
};

export type ExcelCanvasOptions = {
  sheetItem: SheetItem;
  canvas: HTMLCanvasElement;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    scrollXDiff?: number;
    scrollYDiff?: number;
  };
  onInitLoad?: () => void;
  onError?: (error: Error) => void;
};
