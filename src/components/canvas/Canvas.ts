import type { SheetItem } from '../excel/types.ts';
import { w2px, h2px, argb2rgb, getFontColor } from './utils.ts';
import type {
  Cell as ExcelCell,
  Column,
  Row,
  CellRichTextValue,
  FillPattern,
  Image,
  CellHyperlinkValue,
} from 'exceljs';
import dayjs from 'dayjs';

type Cell = ExcelCell & {
  _address: string;
  _column: Column;
  _row: Row;
  master: Cell;
};
type ExcelCanvasOptions = {
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

export class ExcelCanvas {
  private sheetItem: SheetItem;
  private canvas: HTMLCanvasElement;

  public ctx: CanvasRenderingContext2D;
  public realContentWidth: number = 0;
  public realContentHeight: number = 0;

  private dpr = window.devicePixelRatio || 1;

  onInitLoad: ExcelCanvasOptions['onInitLoad'];
  onError: ExcelCanvasOptions['onError'];

  private viewport: ExcelCanvasOptions['viewport'];

  private renderColumns: Column[] = [];
  private renderRows: Row[] = [];

  private cellsInfo: Array<{
    x: number;
    y: number;
    col: number;
    row: number;
    width: number;
    height: number;
  }> = [];

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

    const dpr = this.dpr;

    // 计算宽高
    this.realContentWidth = columns.reduce(
      (pre, cur) => pre + w2px(cur.width),
      indexColumnWidth + originX,
    );
    this.realContentHeight = rows.reduce(
      (pre, cur) => pre + h2px(cur.height),
      h2px(defaultRowHeight) + originY,
    );

    const canvasWidth = this.viewport.width;
    const canvasHeight = this.viewport.height;
    // console.log(1, canvasHeight)
    this.canvas.width = Math.round(canvasWidth * dpr);
    this.canvas.height = Math.round(canvasHeight * dpr);
    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = canvasWidth + 'px';
    this.canvas.style.height = canvasHeight + 'px';

    this.ctx.lineWidth = lineWidth;
    this.render()
      .then(() => {
        this.onInitLoad?.();
      })
      .catch((err) => {
        this.onError?.(err);
      });
  }

  // 计算当前视口返回+滚动条位置下展示哪些单元格
  calculateRenderCells(currentScroll?: { scrollX: number; scrollY: number }) {
    const {
      columns,
      rows,
      worksheet: {
        properties: { defaultRowHeight },
      },
    } = this.sheetItem;
    const { width, height } = this.viewport;
    // console.log(width, scrollX)
    const scrollX = (this.viewport.scrollX =
      currentScroll?.scrollX ?? this.viewport.scrollX);
    const scrollY = (this.viewport.scrollY =
      currentScroll?.scrollY ?? this.viewport.scrollY);

    let cellLeft = indexColumnWidth;
    let scrollXDiff: number | undefined = undefined;
    this.renderColumns = columns.filter((col) => {
      const colLeft = cellLeft;
      const colRight = cellLeft + w2px(col.width);

      // 1. 针对列：左侧视口相交、完全包含、右侧视口相交
      const isColumnInViewport =
        (colLeft <= scrollX &&
          colRight < scrollX + width &&
          colRight > scrollX) ||
        (colLeft >= scrollX && colRight <= scrollX + width) ||
        (colLeft >= scrollX &&
          colLeft < scrollX + width &&
          colRight > scrollX + width);

      // 计算当前单元格的滚动差值
      if (isColumnInViewport && scrollXDiff === undefined) {
        scrollXDiff = scrollX - cellLeft + indexColumnWidth;
      }

      cellLeft += w2px(col.width);

      return isColumnInViewport;
    });
    this.viewport.scrollXDiff = scrollXDiff;

    let cellTop = h2px(defaultRowHeight);
    let scrollYDiff: number | undefined = undefined;
    this.renderRows = rows.filter((row) => {
      const rowTop = cellTop;
      const rowBottom = cellTop + h2px(row.height);

      // 1. 针对行：上侧视口相交、完全包含、下侧视口相交
      const isRowInViewport =
        (rowTop <= scrollY &&
          rowBottom < scrollY + height &&
          rowBottom > scrollY) ||
        (rowTop >= scrollY && rowBottom <= scrollY + height) ||
        (rowTop >= scrollY &&
          rowTop < scrollY + height &&
          rowBottom > scrollY + height);

      // 计算当前单元格的滚动差值
      if (isRowInViewport && scrollYDiff === undefined) {
        scrollYDiff = scrollY - cellTop + h2px(defaultRowHeight);
      }

      cellTop += h2px(row.height);

      return isRowInViewport;
    });
    this.viewport.scrollYDiff = scrollYDiff;

    // console.log('渲染列', this.renderColumns[0].letter, this.renderColumns[this.renderColumns.length - 1].letter)
    // console.log('渲染行', this.renderRows[0].number, this.renderRows[this.renderRows.length - 1].number)
  }

  zoom(scale: number) {
    this.ctx.scale(this.dpr + scale, this.dpr + scale);
  }

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
      const rowHeight = h2px(row.height);

      // 每一列
      this.renderColumns.forEach((column) => {
        // 获取每一个单元格
        const cell = row.getCell(column.number) as Cell;

        if (cell._address === 'E3') {
          // console.log(cell.model.type, cell.value)
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

              this.renderCell(
                calWidth,
                calHeight,
                cellWidthMerge,
                cellHeightMerge,
                merge.master.style,
              );

              const richText = (cell.value as CellRichTextValue)?.richText;
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
            x: calWidth,
            y: calHeight,
            width: cellW,
            height: cellH,
            row: cell._row.number - 1,
            col: cell._column.number - 1,
          });
          this.renderCell(calWidth, calHeight, cellW, cellH, cell.style);
          const richText = (cell.value as CellRichTextValue)?.richText;
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

    await this.renderImages();

    // this.canvas.height = Math.round(calHeight * this.dpr)
    // this.canvas.style.height = calHeight + 'px'
    // console.log(calHeight)
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
        properties: { defaultRowHeight },
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
      text = dayjs(excelDateToJSDate(text as number)).format('M月D日');
    } else if (valueType === 4) {
      // Date
      let format = 'YYYY/MM/DD';
      // if (styleFormat.numFmt === 'mm-dd-yy') {
      // }
      text = dayjs(text as Date).format(format);
    } else if (valueType === 5) {
      // Hyperlink
      text = (text as CellHyperlinkValue)?.text;
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
            acc + Math.floor(this.ctx.measureText(cur).width / cellWidth),
          0,
        );
      y = (cellHeight - textLinesCount * h2px(defaultRowHeight)) / 2;
      if (y < 0) {
        y = 0;
      }
      y += cellTop + 3;
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
            x = (cellWidth - this.ctx.measureText(line).width) / 2;
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

    this.renderPlainText(
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
