import React from 'react';
import ExcelJS from 'exceljs';
import type { Worksheet, Workbook, Row, Column, Cell } from 'exceljs';
import { useEffect, useRef, useState } from 'react';
import type { Merge, SheetItem } from './types';
import { ExcelCanvas } from '../canvas/Canvas.ts';
import * as XLSX from 'xlsx';
import { virtualScroll } from './scroll';

type ExcelProps = {
  url: string;
  onInitLoad?: () => void;
  onError?: (err: Error) => void;
  LoadingComponent?: React.FC<{ message?: string }>;
};

const parseUnLogin = (text: string) => {
  try {
    const json = JSON.parse(text);
    if (
      typeof json === 'object' &&
      json.success !== undefined &&
      json.success === false
    ) {
      return new Error(json.msg || json.message || '文件不存在');
    }
  } catch (e) {}
};

function Excel(props: ExcelProps) {
  const [sheetList, setSheetList] = useState<SheetItem[]>([]);
  const [currentSheetId, setCurrentSheetId] = useState<number>();
  const ref = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState<boolean>();
  const [loadingMessage, setLoadingMessage] = useState<string>();
  const excelCanvasInstance = useRef<ExcelCanvas>();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.url) return;

    setLoading(true);
    setLoadingMessage('文件加载中...');

    let responseContentType: string;
    fetch(props.url)
      .then((res) => {
        responseContentType = res.headers.get('content-type') || '';
        return res.arrayBuffer();
      })
      .then((buffer) => {
        // 如果是未登录状态，则会返回 { success: false, code: -702, msg: '' }
        // 所以截取前100个字符是足够的
        const text = new TextDecoder().decode(buffer.slice(0, 100));
        const error = parseUnLogin(text);
        if (error) {
          return Promise.reject(error);
        }

        const isXls =
          responseContentType?.includes('vnd.ms-excel') ||
          (props.url.includes('.xls') && !props.url.includes('.xlsx'));
        const isCsv =
          responseContentType?.includes('text/csv') ||
          props.url.includes('.csv');

        if (isXls || isCsv) {
          let workbook;
          if (isCsv) {
            // 使用文本作为输入，而不是 arrayBuffer
            const text = new TextDecoder().decode(buffer);
            workbook = XLSX.read(text, { type: 'string', raw: true });
          } else {
            workbook = XLSX.read(buffer, { type: 'array' });
          }
          buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        }

        // 资源下载完成
        setLoadingMessage('数据解析中...');
        return new ExcelJS.Workbook().xlsx
          .load(buffer)
          .then((workbook: Workbook) => {
            const sheetList: SheetItem[] = [];

            // console.log(workbook)
            workbook.eachSheet((worksheet: Worksheet, sheetId: number) => {
              const sheetItem: SheetItem = {
                id: sheetId,
                name: worksheet.name,
                columns: [],
                rows: [],
                merges: [],
                worksheet,
              };
              // set sheet column
              for (let i = 0; i < worksheet.columnCount; i++) {
                const column: Column = worksheet.getColumn(i + 1);
                if (column.hidden) {
                  continue;
                }
                sheetItem.columns.push(column);
              }
              // set sheet row
              for (let i = 0; i < worksheet.rowCount; i++) {
                const row: Row = worksheet.getRow(i + 1);
                if (row.hidden) {
                  continue;
                }
                // set sheet row cell merges
                for (let j = 0; j < row.cellCount; j++) {
                  const cell: Cell = row.getCell(j + 1);
                  // console.log('cell._address', cell.fullAddress)
                  if (cell.isMerged) {
                    const targetAddress: Merge | undefined =
                      sheetItem.merges.find(
                        (item: any) =>
                          item.address === cell.master.fullAddress.address,
                      );
                    if (targetAddress) {
                      targetAddress.cells.push(cell);
                    } else {
                      sheetItem.merges.push({
                        address: cell.fullAddress.address,
                        master: cell,
                        cells: [cell],
                      });
                    }
                  }
                }
                sheetItem.rows.push(row);
              }
              // viewerParams.sheetList.push(sheetItem)
              sheetList.push(sheetItem);
            });

            // console.log(sheetList)
            // 数据解析完成
            setSheetList(sheetList);
            setCurrentSheetId(sheetList[0].id);
          });
      })
      .catch((err) => {
        setLoading(false);
        setLoadingMessage(err.message);
        props.onError?.(err);
      });
  }, [props.url]);

  useEffect(() => {
    if (!currentSheetId || !ref.current || !rootRef.current) return;

    setLoadingMessage('渲染中...');
    setLoading(true);

    // 获取根结点大小
    const rootRect = rootRef.current.getBoundingClientRect();
    // let handleScroll: (e: Event) => void
    const viewportWidth = rootRect.width;
    const viewportHeight = rootRect.height - 48;

    let currentRender: ExcelCanvas;
    const currentSheet = sheetList.find(
      (item: SheetItem) => item.id === currentSheetId,
    );
    if (currentSheet && ref.current) {
      excelCanvasInstance.current = currentRender = new ExcelCanvas({
        sheetItem: currentSheet,
        canvas: ref.current,
        viewport: {
          width: viewportWidth,
          height: viewportHeight,
          scrollX: 0,
          scrollY: 0,
        },
        onInitLoad: () => {
          setLoading(false);
          setLoadingMessage('');
          props.onInitLoad?.();
          // 仅首次加载或切换表格时重置滚动条
          if (!ref.current!.dataset.hasScrolled) {
            const scrollEl = ref.current!.parentNode as HTMLDivElement;
            scrollEl.scrollTop = 0;
            scrollEl.scrollLeft = 0;
            ref.current!.dataset.hasScrolled = 'true';
          }
        },
        onError: (err) => {
          setLoading(false);
          setLoadingMessage(err.message);
          props.onError?.(err);
        },
      });

      // 设置 sheet 工具条的宽度
      const sheetBar = ref.current.parentNode!.querySelector(
        '.excel-preview__bar',
      ) as HTMLElement;
      // sheetBar.style.width = `${currentRender.width}px`
      const currentWidth = sheetBar.offsetWidth;
      // console.log(currentWidth, ref.current.offsetWidth)
      sheetBar.style.width = `${Math.min.call(null, currentWidth, ref.current.offsetWidth)}px`;

      virtualScroll.init(
        viewportWidth,
        viewportHeight,
        currentRender.realContentWidth,
        currentRender.realContentHeight,
        () => {
          currentRender.calculateRenderCells({
            scrollX: virtualScroll.scrollLeft,
            scrollY: virtualScroll.scrollTop,
          });
          requestAnimationFrame(() => {
            currentRender.destroy();
            currentRender.render().then(() => {
              virtualScroll.renderScrollbar(currentRender.ctx);
            });
          });
        },
      );
      virtualScroll.listen(ref.current);
    }

    return () => {
      currentRender?.destroy();
      virtualScroll.unListen(ref.current!);
    };
  }, [currentSheetId, ref.current]);

  return (
    <div
      ref={rootRef}
      className="excel-preview"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        fontSize: 14,
      }}
    >
      {loading && (
        <div
          className="excel-preview__loading"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            // background: 'rgba(0,0,0,.5)',
            background: 'rgba(255,255,255,1)',
            zIndex: 1,
          }}
        >
          {props.LoadingComponent ? (
            <props.LoadingComponent message={loadingMessage} />
          ) : (
            <div
              className="excel-preview__loading-message"
              style={{
                color: '#999999',
                fontSize: 16,
              }}
            >
              {loadingMessage}
            </div>
          )}
        </div>
      )}

      <div
        className="excel-preview__wrap"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 0,
          width: '100%',
          height: '100%',
          overflow: 'auto',
        }}
      >
        <canvas ref={ref} />

        <div
          className="excel-preview__bar"
          style={{
            display: 'flex',
            position: 'sticky',
            left: 0,
            bottom: 0,
            background: '#eee',
            border: '1px solid #ccc',
            height: 48,
            flexShrink: 0,
            flexGrow: 0,
          }}
        >
          <div
            className="excel-preview__sheet"
            style={{
              display: 'flex',
              height: '100%',
              overflow: 'auto',
              paddingLeft: 50,
              width: '100%',
            }}
          >
            {sheetList.map((item: SheetItem, i) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '8px 0px 8px 0px',
                  whiteSpace: 'nowrap',
                  ...(currentSheetId === item.id ? {} : {}),
                }}
                onClick={() => {
                  setCurrentSheetId(item.id);
                }}
              >
                <div
                  className="excel-preview__sheet-name"
                  style={{
                    padding: '5px 0',
                    borderRadius: '8px',
                    // border: '1px solid #ccc',
                    ...(currentSheetId === item.id
                      ? {
                          background: '#fff',
                          boxShadow: '0 3px 5px rgba(0,0,0,.1)',
                          // borderTopWidth: 0,
                          fontWeight: 'bold',
                          color: '#367A55',
                          padding: '5px 15px',
                        }
                      : {}),
                  }}
                >
                  {item.name}
                </div>

                {i < sheetList.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      height: '50%',
                      background: '#ccc',
                      margin: '0 15px',
                      borderRadius: 4,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/*放大缩小*/}
          {/*<div className="excel-preview__zoom">*/}
          {/*  <div onClick={() => {*/}
          {/*    excelCanvasInstance.current?.zoom(-0.1)*/}
          {/*  }}>*/}
          {/*    减*/}
          {/*  </div>*/}
          {/*  <div onClick={() => {*/}
          {/*    excelCanvasInstance.current?.zoom(0.1)*/}
          {/*  }}>*/}
          {/*    加*/}
          {/*  </div>*/}
          {/*</div>*/}
        </div>
      </div>
    </div>
  );
}

export default Excel;
