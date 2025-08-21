import type { Cell } from 'exceljs';

/**
 * 获取屏幕DPI（近似值）
 * @returns {number} 屏幕DPI值
 */
function getScreenDPI() {
  // 创建1英寸大小的元素测量实际像素
  const div = document.createElement('div');
  div.style.width = '1in';
  div.style.height = '1in';
  div.style.position = 'absolute';
  div.style.left = '-100%';
  document.body.appendChild(div);

  const dpi = Math.round(div.offsetWidth); // 1英寸对应的像素值
  document.body.removeChild(div);

  return dpi || 96; // 默认返回96如果测量失败
}

const dpi = getScreenDPI();

/**
 * 将ExcelJS列宽转换为像素值
 * @param {number} excelWidth - ExcelJS解析出的列宽（字符单位）
 // * @param {number} [dpi=96] - 屏幕DPI（默认96）
 * @param {number} [baseCharWidth=7] - 基础字符宽度（默认7像素）
 * @returns {number} 像素值
 */
export function w2px(excelWidth: number = 15, baseCharWidth = 7) {
  // cur.width > 0 ? cur.width : 100
  // if (excelWidth > 0) {
  //
  // } else {
  //   excelWidth = 15
  // }
  // Excel列宽到像素的转换公式: (字符宽度 * baseCharWidth) + 5
  return Math.round(excelWidth * baseCharWidth + 5);
}

/**
 * 将ExcelJS行高转换为像素值
 * @param {number} excelHeight - ExcelJS解析出的行高（点单位）
 * @param {number} [dpi=96] - 屏幕DPI（默认96）
 * @returns {number} 像素值
 */
export function h2px(excelHeight: number = 18) {
  // 1点 = 1/72英寸，像素 = 点 * (DPI / 72)
  return Math.round(excelHeight * (dpi / 72));
}

export function pxToPt(px: number) {
  return px * (72 / dpi); // 或者 px / 1.333333
}

export function ptToPx(pt: number) {
  return pt * (dpi / 72);
}

export function argb2rgb(argb?: string) {
  if (!argb) {
    return 'rgb(0,0,0)';
  }

  return `rgb(${parseInt(argb.slice(2, 4), 16)}, 
                        ${parseInt(argb.slice(4, 6), 16)}, 
                        ${parseInt(argb.slice(6, 8), 16)})`;
}

export function getFontColor(font: Cell['style']['font']): string {
  // if (!font?.color?.argb && font?.color?.theme === undefined) return '#000000';

  const argb = font?.color?.argb;
  const theme = font?.color?.theme;

  // 处理 theme color
  if (theme !== undefined) {
    // 这里需要定义 Excel 主题颜色映射
    const themeColors = [
      '#FFFFFF',
      '#000000',
      '#E7E6E6',
      '#44546A',
      '#4472C4',
      '#ED7D31',
      '#A5A5A5',
      '#FFC000',
      '#5B9BD5', // 主题8对应#5B9BD5
    ];
    return themeColors[theme] || '#000000';
  }

  // 处理常规 ARGB 颜色
  if (typeof argb === 'string') {
    return `#${argb.slice(2)}`; // 去掉 alpha 通道
  }

  return '#000000';
}

export function copyText(str: string) {
  const input = document.createElement('input');
  input.value = str;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}
