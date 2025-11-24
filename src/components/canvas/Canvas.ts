import type {
  SheetItem,
  IRow,
  IColumn,
  Cell,
  ExcelCanvasOptions,
} from '../Excel/types.ts';
import { w2px, h2px, argb2rgb, getFontColor } from './utils.ts';
import type {
  CellRichTextValue,
  FillPattern,
  Image,
  CellHyperlinkValue,
} from 'exceljs';
import dayjs from 'dayjs';

const indexColumnWidth = 50;
const lineWidth = 1;
const headerBg = '#eeeeee';
const headerBd = '#cccccc';
const headerColor = '#666666';
const defaultCellBg = '#ffffff';
const originX = 1;
const originY = 1;

const defaultFont = {
  size: 10,
  name: 'Arial',
  color: {
    argb: 'ff666666',
  },
};

type TextStyleFn = (index: number) => Cell['style'] | undefined;
type TextStyle = Cell['style'] | TextStyleFn;
export type CellInfo = {
  id: string;
  x: number;
  y: number;
  col: number;
  row: number;
  width: number;
  height: number;
  text: string;
};

export class ExcelCanvas {
  private sheetItem: SheetItem;
  private canvas: HTMLCanvasElement;

  public ctx: CanvasRenderingContext2D;
  public realContentWidth: number = 0;
  public realContentHeight: number = 0;

  private dpr = window.devicePixelRatio || 1;

  onInitLoad: ExcelCanvasOptions['onInitLoad'];
  onError: ExcelCanvasOptions['onError'];

  public viewport: ExcelCanvasOptions['viewport'];

  private renderColumns: IColumn[] = [];
  private renderRows: IRow[] = [];

  public cellsInfo: CellInfo[] = [];

  constructor(options: ExcelCanvasOptions) {
    this.sheetItem = options.sheetItem;
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.onInitLoad = options.onInitLoad;
    this.onError = options.onError;
    this.viewport = options.viewport;

    this.calculateRenderCells();
    const {
      columns,
      rows,
      worksheet: {
        properties: { defaultRowHeight },
      },
    } = this.sheetItem;

    // 计算宽高
    this.realContentWidth = columns.reduce(
      (pre, cur) => pre + w2px(cur.width),
      indexColumnWidth + originX,
    );
    this.realContentHeight = rows.reduce(
      (pre, cur) => pre + h2px(cur.height),
      h2px(defaultRowHeight) + originY,
    );

    this.setCanvasSize();
    this.ctx.lineWidth = lineWidth;
    this.render()
      .then(() => {
        this.onInitLoad?.();
      })
      .catch((err) => {
        this.onError?.(err);
      });
  }

  setCanvasSize() {
    const dpr = this.dpr;
    const canvasWidth = this.viewport.width;
    const canvasHeight = this.viewport.height;
    // console.log(1, canvasHeight)
    this.canvas.width = Math.round(canvasWidth * dpr);
    this.canvas.height = Math.round(canvasHeight * dpr);
    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = canvasWidth + 'px';
    this.canvas.style.height = canvasHeight + 'px';
  }

  // 计算当前视口返回+滚动条位置下
  // 展示哪些行、列数据
  // 以及滚动差值
  calculateRenderCells(currentScroll?: { scrollX: number; scrollY: number }) {
    // console.log('scrollX', currentScroll?.scrollX, 'scrollY', currentScroll?.scrollY)
    const {
      columns: _columns,
      rows: _rows,
      worksheet: {
        properties: { defaultRowHeight },
      },
      rowsSlice,
      columnsSlice,
    } = this.sheetItem;
    const { width, height } = this.viewport;
    // console.log(width, scrollX)
    const scrollX = (this.viewport.scrollX =
      currentScroll?.scrollX ?? this.viewport.scrollX);
    const scrollY = (this.viewport.scrollY =
      currentScroll?.scrollY ?? this.viewport.scrollY);

    this.renderColumns = [];
    this.renderRows = [];

    // 找到起始行
    const rowSliceIndex = rowsSlice.findIndex((x) => x[0] > scrollY);
    // console.log('rowSliceIndex', rowSliceIndex, rowsSlice[rowSliceIndex - 1])
    const [_, rowIndexFromSlice] = rowsSlice[
      rowSliceIndex - 1
    ] ?? [0, 0, 0];
    const rows = _rows.slice(rowIndexFromSlice);
    // console.log(rows.map(x => x.number), rowTopFromSlice, rowSliceIndex, scrollY)

    // 找到起始列
    const columnSliceIndex = columnsSlice.findIndex((x) => x[0] > scrollX);
    const [_2, columnIndexFromSlice] = columnsSlice[
      columnSliceIndex - 1
    ] ?? [0, 0, 0];
    const columns = _columns.slice(columnIndexFromSlice);

    // 初始左右距离
    // let cellTop = h2px(defaultRowHeight) + rowTopFromSlice;

    // 遍历行
    let rowsWhileCount = 0;
    for (const row of rows) {
      rowsWhileCount += 1;
      const cellTop = h2px(defaultRowHeight) + row.top;

      const cellHeight = h2px(row.height);
      const isRowInViewport =
        cellTop < scrollY + height && cellTop + cellHeight > scrollY;

      // if (row.number === 8) {
      //   console.log('row.number', row.top, cellTop, scrollY + height, cellTop + cellHeight, scrollY)
      // }
      if (isRowInViewport) {
        this.renderRows.push(row);
      } else if (this.renderRows.length) {
        // console.log('rowsWhileCount', rowsWhileCount)
        break;
      }

      // cellTop += cellHeight;
    }

    // 遍历列
    let columnsWhileCount = 0;
    // let cellLeft = indexColumnWidth + columnLeftFromSlice;
    for (const column of columns) {
      columnsWhileCount += 1;
      const cellLeft = indexColumnWidth + column.left

      const cellWidth = w2px(column.width);
      const isColumnInViewport =
        cellLeft < scrollX + width && cellLeft + cellWidth > scrollX;
      if (isColumnInViewport) {
        this.renderColumns.push(column);
      } else if (this.renderColumns.length) {
        // console.log('columnsWhileCount', columnsWhileCount)
        break;
      }
      // cellLeft += cellWidth;
    }

    // 处理合并单元格所在的行和列
    this.renderRows.forEach((row) => {
      // cellLeft = indexColumnWidth;

      this.renderColumns.forEach((column) => {
        const cell = row.getCell(column.number) as Cell;
        if (cell.isMerged) {
          const merge = this.sheetItem.merges.find(
            (item) => item.address === cell.master._address,
          );

          if (merge) {
            // 合并的单元格中有在 viewport 的，需要将合并的单元格都渲染出来
            merge.cells.forEach((_cellMerge) => {
              const cellMerge = _cellMerge as Cell;
              if (
                this.renderRows.every((x) => x.number !== cellMerge._row.number)
              ) {
                this.renderRows.push(cellMerge._row);
              }
              if (
                this.renderColumns.every(
                  (x) => x.number !== cellMerge._column.number,
                )
              ) {
                this.renderColumns.push(cellMerge._column);
              }
            });
          }
        }

        // cellLeft += w2px(column.width);
      });

      // cellTop += h2px(row.height);
    });

    // 排序
    this.renderRows = this.renderRows.sort((a, b) => a.number - b.number);
    this.renderColumns = this.renderColumns.sort((a, b) => a.number - b.number);

    // 计算偏移
    // 单元格滚动一部分的差值 =
    // 滚动条的位置 - 当前渲染的起始行列的位置
    this.viewport.scrollXDiff = scrollX - (this.renderColumns[0]?.left ?? 0);
    this.viewport.scrollYDiff = scrollY - (this.renderRows[0]?.top ?? 0);
    // console.log('渲染列', this.renderColumns[0].letter, this.renderColumns[this.renderColumns.length - 1].letter)
    // console.log('遍历的列数', columnsWhileCount)
    // console.log('渲染行', this.renderRows[0]?.number, this.renderRows[this.renderRows.length - 1]?.number)
    // console.log('遍历的行数', rowsWhileCount)

    // console.log('scrollY', scrollY, 'rowTopFromSlice', rowTopFromSlice, 'top', this.renderRows[0].top, 'scrollYDiff', this.viewport.scrollYDiff)
  }

  // zoom(scale: number) {
  //   this.ctx.scale(this.dpr + scale, this.dpr + scale);
  // }

  setDefaultFont(
    font: {
      size: number;
      name: string;
      bold?: boolean;
      color?: { argb: string };
    } = defaultFont,
  ) {
    this.ctx.font = `${font.bold ? 'bold ' : ''}${font.size}pt ${font.name}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = argb2rgb(font.color?.argb);
    this.ctx.strokeStyle = argb2rgb(font.color?.argb);
  }

  async render() {
    this.cellsInfo = [];

    const {
      worksheet: {
        properties: { defaultRowHeight },
      },
    } = this.sheetItem;
    const { scrollXDiff = 0, scrollYDiff = 0 } = this.viewport;
    // console.log('this.viewport', this.viewport)
    let calWidth = indexColumnWidth - scrollXDiff;

    // 累加高度
    let calHeight = h2px(defaultRowHeight) - scrollYDiff;

    // 每一行
    this.renderRows.forEach((row) => {
      // 重置累加位置
      calWidth = indexColumnWidth - scrollXDiff;
      const rowHeight = h2px(row.height || defaultRowHeight);

      // 每一列
      this.renderColumns.forEach((column) => {
        // 获取每一个单元格
        const cell = row.getCell(column.number) as Cell;

        if (cell._address === 'L4') {
          // console.log(cell.model.type, cell)
          // console.log('x scrollXDiff', calWidth, scrollXDiff)
        }

        const cellW = w2px(cell._column.width);
        const cellH = h2px(cell._row.height);
        let cellValue = cell.value ?? '';

        if (cell.isMerged) {
          if (cell.master._address === cell._address) {
            // 合并单元格
            const merge = this.sheetItem.merges.find(
              (item) => item.address === cell._address,
            );
            // console.log(merge)
            if (merge) {
              // 找到横向合并的格子
              const hCells = merge.cells.filter(
                (c) => c.fullAddress.row === merge.master.fullAddress.row,
              );
              // 找到纵向合并的格子
              const vCells = merge.cells.filter(
                (c) => c.fullAddress.col === merge.master.fullAddress.col,
              );

              const cellWidthMerge = hCells.reduce(
                (pre, cur) => pre + w2px((cur as Cell)._column.width),
                0,
              );
              const cellHeightMerge = vCells.reduce(
                (pre, cur) => pre + h2px((cur as Cell)._row.height),
                0,
              );

              // 缓存格子信息
              this.cellsInfo.push({
                id: cell._address,
                x: calWidth,
                y: calHeight,
                width: cellWidthMerge,
                height: cellHeightMerge,
                row: cell._row.number - 1,
                col: cell._column.number - 1,
                text: cell.text,
              });

              this.renderCell(
                calWidth,
                calHeight,
                cellWidthMerge,
                cellHeightMerge,
                merge.master.style,
              );

              // @ts-ignore
              const richText = (cell.value as CellHyperlinkValue)?.text?.richText || (cell.value as CellRichTextValue)?.richText;
              if (richText) {
                this.renderRichText(
                  calWidth,
                  calHeight,
                  cellWidthMerge,
                  richText,
                  cell,
                );
              } else {
                this.renderPlainText(
                  calWidth,
                  calHeight,
                  cellWidthMerge,
                  cellHeightMerge,
                  cellValue,
                  cell.style,
                  cell,
                );
              }
            }
          }
        } else {
          // 缓存格子信息
          this.cellsInfo.push({
            id: cell._address,
            x: calWidth,
            y: calHeight,
            width: cellW,
            height: cellH,
            row: cell._row.number - 1,
            col: cell._column.number - 1,
            text: cell.text,
          });
          this.renderCell(calWidth, calHeight, cellW, cellH, cell.style);
          // @ts-ignore
          const richText = (cell.value as CellHyperlinkValue)?.text?.richText || (cell.value as CellRichTextValue)?.richText;
          if (richText) {
            this.renderRichText(calWidth, calHeight, cellW, richText, cell);
          } else {
            this.renderPlainText(
              calWidth,
              calHeight,
              cellW,
              cellH,
              cellValue,
              cell.style,
              cell,
            );
          }
        }

        calWidth += cellW;
      });

      // 第一列序号
      const fill = { fgColor: { argb: `#${headerBg}` } } as FillPattern;
      this.renderCell(
        originX,
        calHeight,
        indexColumnWidth - originX * 2,
        rowHeight,
        { fill },
      );
      this.renderPlainText(
        originX,
        calHeight,
        indexColumnWidth,
        rowHeight,
        String(row.number),
        {
          font: defaultFont,
          alignment: {
            horizontal: 'center',
            vertical: 'middle',
          },
        },
      );

      calHeight += rowHeight;
    });

    // 渲染表头
    this.setDefaultFont();
    // 重置累加位置
    calWidth = indexColumnWidth - scrollXDiff;
    this.renderColumns.forEach((column) => {
      const w = w2px(column.width);
      const h = h2px(defaultRowHeight);
      const x = calWidth;
      const y = originY;
      this.ctx.fillStyle = headerBg;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.strokeStyle = headerBd;
      this.ctx.strokeRect(x, y, w, h);
      this.ctx.fillStyle = headerColor;
      this.ctx.fillText(column.letter, calWidth + w / 2, h / 2);
      calWidth += w;
    });

    // 渲染表头第一个占位
    if (this.renderColumns.length || this.renderRows.length) {
      this.ctx.fillStyle = headerBg;
      this.ctx.strokeStyle = headerBd;
      const x = originX;
      const y = originY;
      this.ctx.fillRect(
        x,
        y,
        indexColumnWidth - originX * 2,
        h2px(defaultRowHeight),
      );
      this.ctx.strokeRect(
        x,
        y,
        indexColumnWidth - originX * 2,
        h2px(defaultRowHeight),
      );
    } else {
      this.ctx.fillText(
        '当前页没有数据～',
        this.viewport.width / 2 - 30,
        this.viewport.height / 2,
      );
    }

    await this.renderImages();

    // this.canvas.height = Math.round(calHeight * this.dpr)
    // this.canvas.style.height = calHeight + 'px'
    // console.log('this.cellsInfo[0].y', this.cellsInfo[0].y, 'scrollYDiff', scrollYDiff)
  }

  renderCell(x: number, y: number, w: number, h: number, style: Cell['style']) {
    const { fill, border } = style;
    // console.log(border)
    const fillColor = (fill as FillPattern)?.fgColor?.argb;
    // console.log(fillColor, fill)
    // 只处理了 FillPattern 的情况
    // this.ctx.lineWidth = 2
    if (fillColor) {
      this.ctx.fillStyle = argb2rgb(fillColor);
    } else {
      this.ctx.fillStyle = defaultCellBg;
    }
    this.ctx.strokeStyle = argb2rgb(
      border?.left?.color?.argb ?? `#${headerBd}`,
    );

    // const drawLine = (start: { x: number, y: number }, end: { x: number, y: number }, color: string) => {
    //   this.ctx.beginPath()
    //   this.ctx.moveTo(start.x, start.y)
    //   this.ctx.strokeStyle = color
    //   this.ctx.lineTo(end.x, end.y)
    //   this.ctx.stroke()
    // }

    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeRect(x, y, w, h);
    // // 使用 line 画 rect
    // // 左
    // // this.ctx.beginPath()
    // // this.ctx.moveTo(x, y)
    // // this.ctx.strokeStyle = argb2rgb(border?.left?.color?.argb ?? headerColor)
    // // this.ctx.lineTo(x, y + h)
    // // this.ctx.stroke()
    // drawLine({ x, y }, { x, y: y + h }, border?.left?.color?.argb ?? `#${headerColor}`)
    //
    // // 下
    // // this.ctx.strokeStyle = argb2rgb(border?.bottom?.color?.argb ?? headerColor)
    // // this.ctx.lineTo(x + w, y + h)
    // // this.ctx.stroke()
    // drawLine({ x, y: y + h }, { x: x + w, y: y + h }, border?.bottom?.color?.argb ?? `#${headerColor}`)
    //
    // // 右
    // // this.ctx.strokeStyle = argb2rgb(border?.right?.color?.argb ?? headerColor)
    // // this.ctx.strokeStyle = 'blue'
    // // this.ctx.lineTo(x + w, y)
    // // this.ctx.stroke()
    // drawLine({ x: x + w, y }, { x: x + w, y }, border?.right?.color?.argb ?? `#${headerColor}`)
    //
    // // 上
    // // this.ctx.strokeStyle = argb2rgb()
    // // this.ctx.strokeStyle = 'red'
    // // this.ctx.closePath()
    // // this.ctx.stroke()
    // drawLine({ x: x + w, y }, { x, y }, border?.top?.color?.argb ?? `#${headerColor}`)
    // this.ctx.fill()
  }

  renderPlainText(
    cellLeft: number,
    cellTop: number,
    cellWidth: number,
    cellHeight: number,
    text: Cell['value'],
    style: TextStyle,
    cell?: Cell,
  ) {
    const {
      worksheet: {
        properties: { defaultRowHeight = 15 },
      },
    } = this.sheetItem;
    const valueType = cell?.model?.type;

    // 0 null 1 Merge
    if (valueType === 2) {
      // Number
      function excelDateToJSDate(excelDate: number) {
        // Excel 的 0 = 1899-12-31，但 JS 的 Date 从 1970 开始计算
        const utcDays = Math.floor(excelDate - 25569); // 25569 = 1970-01-01 的 Excel 日期
        const utcValue = utcDays * 86400 * 1000; // 毫秒
        return new Date(utcValue);
      }
      if (cell?.value instanceof Date) {
        text = dayjs(excelDateToJSDate(text as number)).format('M月D日');
      } else {
        text = String(text);
      }
      // text = dayjs(excelDateToJSDate(text as number)).format('M月D日');
    } else if (valueType === 4) {
      // Date
      let format = 'YYYY/MM/DD';
      // if (styleFormat.numFmt === 'mm-dd-yy') {
      // }
      text = dayjs(text as Date).format(format);
    } else if (valueType === 5) {
      // Hyperlink
      text = (text as CellHyperlinkValue)?.text || text as string;
    } else {
      // String
      text = String(text);
    }

    const isFnStyle = typeof style === 'function';

    const setStyle = (index?: number) => {
      const result =
        typeof style === 'function' && index !== undefined
          ? style(index)
          : (style as Cell['style']);

      // 避免不必要的重复设置
      if (!result) {
        return;
      }

      const { font, alignment } = result;
      // console.log(font)
      this.ctx.font = `${font?.bold ? 'bold ' : ''}${font?.size ?? defaultFont.size}pt ${font?.name ?? defaultFont.name}`;
      // @ts-ignore
      this.ctx.textAlign = alignment?.horizontal || 'left';
      // @ts-ignore
      this.ctx.textBaseline = alignment?.vertical || 'middle';
      // console.log(font, getFontColor(font))
      this.ctx.fillStyle = getFontColor(font);
      return result;
    };

    // 设置样式
    // if (!isFnStyle) {
    //   setStyle()
    // }

    const textLines = text.split('\n');

    let x = cellLeft + 3;
    let y = cellTop + 3;
    const alignment = cell?.alignment || (style as Cell['style'])?.alignment;
    if (alignment?.vertical === 'middle') {
      // 文本的行数 = \n 的数量 + 自动换行的数量
      const textLinesCount =
        textLines.length +
        textLines.reduce(
          (acc, cur) =>
            acc + Math.round(this.ctx.measureText(cur).width / cellWidth),
          0,
        );
      y = (cellHeight - textLinesCount * h2px(defaultRowHeight)) / 2;
      if (y < 0) {
        y = 0;
      }
      y += cellTop + 3;
    }

    if (cell?.address === 'C11') {
      // console.log(y - cellTop, alignment?.vertical, defaultRowHeight)
      // y = 0
    }

    // 逐行渲染
    textLines.forEach((line, i) => {
      if (line === '负责人') {
        // debugger
        // console.log(cell.value, style)
      }
      // 每行的起始 x
      let lineX: number;
      // 逐字渲染，计算宽度，确保自动换行
      line.split('').forEach((char, j) => {
        if (isFnStyle) {
          // 获取当前字符的索引
          // 累加的行数 + 去掉的 \n 数 + 当前行的索引
          const index =
            textLines.slice(0, i).reduce((x, y) => x + y.length, 0) + i + j;
          // 设置样式
          setStyle(index);
        } else {
          setStyle();
        }

        // 设置完样式后才能获取到 textAlign
        // const isTextLeft = this.ctx.textAlign === 'left'
        const isTextCenter = this.ctx.textAlign === 'center';
        // const halfCharWidth = this.ctx.measureText(char).width / 2

        // 初始化 x
        if (lineX === undefined) {
          if (isTextCenter) {
            // const halfCharWidth = Math.max.apply(null, line.split('').map(x => this.ctx.measureText(x).width))
            x = (cellWidth - Math.round(this.ctx.measureText(line).width)) / 2;
            if (x < 0) {
              x = 0;
            }
            x += cellLeft;
          }

          lineX = x;
        }

        // 小写字母的宽度计算出来有问题，不知什么原因
        // 统一转换大写字母的宽度
        let charWidth = Math.round(this.ctx.measureText(char).width);

        if (lineX + charWidth > cellLeft + cellWidth) {
          // 换行
          y += h2px(defaultRowHeight);
          lineX = x;
        }

        // !!! 很关键，如果字体是居中展示，会存在字符很宽被覆盖的情况，例如：1班
        // 设置成 left 展示就不会存在
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(char, lineX, y);
        lineX += charWidth;
      });

      y += h2px(defaultRowHeight);
    });

    // console.log(cell?.address, y)
    return {
      cellHeight: y
    }
  }

  renderRichText(
    cellLeft: number,
    cellTop: number,
    cellWidth: number,
    richText: CellRichTextValue['richText'],
    cell: Cell,
  ) {
    const {
      worksheet: {
        properties: { defaultRowHeight },
      },
    } = this.sheetItem;
    const cellStyle = cell.style;

    // 计算每段富文本的长度区间
    let len = 0;
    const newRichText = richText.map((item) => {
      const val = { ...item, len: [len, len + item.text.length] };
      len += item.text.length;
      return val;
    });

    return this.renderPlainText(
      cellLeft,
      cellTop,
      cellWidth,
      h2px(defaultRowHeight),
      // 将富文本拼接起来渲染
      richText.reduce((x, y) => x + y.text, ''),
      (index) => {
        // 找到 index 归属的 richText
        // for (const item of newRichText) {
        //   if (index >= item.len[0] && index < item.len[1]) {
        //     // 每个段落设置样式只需要在第一个字符时设置
        //     if (index === item.len[0]) {
        //       return {
        //         ...cellStyle,
        //         font: item?.font,
        //       }
        //     }
        //   }
        // }
        const item = newRichText.find(
          (x) => index >= x.len[0] && index < x.len[1],
        );

        const res = { ...cellStyle };
        if (item?.font) {
          res.font = item?.font;
        }
        return res;
      },
      cell,
    );
  }

  private async renderImages() {
    const { worksheet } = this.sheetItem;
    const images = worksheet.getImages();
    // console.log(111, images)

    for (const image of images) {
      const media = worksheet.workbook.getImage(
        Number(image.imageId),
      ) as Image & { type: string };
      if (!media) continue;

      // console.log(media, image)
      const img = await this.loadImage(media);
      if (!img) continue;
      const { tl, br } = image.range;

      const imgWidth = (br.nativeColOff - tl.nativeColOff) / 10000;
      const imgHeight = (br.nativeRowOff - tl.nativeRowOff) / 10000;

      const cellInfo = this.cellsInfo.find(
        (x) => x.row === tl.nativeRow && x.col === tl.nativeCol,
      );
      const offsetX = tl.nativeColOff / 10000;
      const offsetY = tl.nativeRowOff / 10000;

      // 计算图片位置和尺寸
      if (cellInfo) {
        const x = cellInfo.x + offsetX;
        const y = cellInfo.y + offsetY;

        this.ctx.drawImage(img, x, y, imgWidth, imgHeight);
      }
    }
  }

  private loadImage(
    media: Image & { type: string },
  ): Promise<HTMLImageElement | null> {
    if (!media.buffer) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      // 将 buffer 转换为 base64
      const base64 = btoa(
        new Uint8Array(media.buffer!).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      img.src = `data:${media.type}/${media.extension};base64,${base64}`;
    });
  }

  // 清除画布内容
  destroy() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
