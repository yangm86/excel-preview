export const virtualScroll = {
  viewportWidth: 0,
  viewportHeight: 0,
  contentWidth: 0,
  contentHeight: 0,
  scrollTop: 0,
  scrollLeft: 0,
  scrollbarSize: 10,
  isDragging: false,
  renderViewport: () => {},
  handleWheel: (_e: WheelEvent) => {},
  handleMousedown: (_e: MouseEvent) => {},
  handleMousemove: (_e: MouseEvent) => {},
  handleMouseup: (_e: MouseEvent) => {},

  init(
    viewportWidth: number,
    viewportHeight: number,
    contentWidth: number,
    contentHeight: number,
    renderViewport: () => void,
  ) {
    // console.log(viewportWidth, viewportHeight, contentWidth, contentHeight)
    this.viewportHeight = viewportHeight;
    this.contentWidth = contentWidth;
    this.contentHeight = contentHeight;
    this.viewportWidth = viewportWidth;
    this.scrollbarSize = 10;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.renderViewport = renderViewport;
  },

  getScrollbarMetrics() {
    const thumbHeight = Math.max(
      20,
      this.viewportHeight * (this.viewportHeight / this.contentHeight),
    );
    const thumbWidth = Math.max(
      20,
      this.viewportWidth * (this.viewportWidth / this.contentWidth),
    );
    const thumbPositionY =
      (this.scrollTop / this.contentHeight) * this.viewportHeight;
    const thumbPositionX =
      (this.scrollLeft / this.contentWidth) * this.viewportWidth;

    return { thumbHeight, thumbWidth, thumbPositionY, thumbPositionX };
  },

  listen(canvas: HTMLCanvasElement) {
    // 滚动条拖拽事件
    let dragStartY = 0;
    let dragStartX = 0;
    // 之前的值
    let preScrollTop = 0;
    let preScrollLeft = 0;

    this.handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // 垂直滚动 (deltaY 处理不同浏览器兼容性)
      // this.scrollTop = Math.max(0,
      //   Math.min(
      //     this.contentHeight - this.viewportHeight,
      //     this.scrollTop + e.deltaY
      //   )
      // );
      // 水平滚动 (deltaX 处理不同浏览器兼容性)
      // this.scrollLeft = Math.max(0,
      //   Math.min(
      //     this.contentWidth - this.viewportWidth,
      //     this.scrollLeft + e.deltaX
      //   )
      // );
      this.scrollLeft += e.deltaX;
      this.scrollTop += e.deltaY;

      // console.log(this.contentWidth, this.viewportWidth, this.contentWidth - this.viewportWidth)
      if (
        this.scrollLeft >=
        this.contentWidth - this.viewportWidth + this.scrollbarSize
      ) {
        this.scrollLeft =
          this.contentWidth - this.viewportWidth + this.scrollbarSize;
      }
      if (
        this.scrollTop >=
        this.contentHeight - this.viewportHeight + this.scrollbarSize
      ) {
        this.scrollTop =
          this.contentHeight - this.viewportHeight + this.scrollbarSize;
      }

      if (this.scrollTop < 0) {
        this.scrollTop = 0;
      }
      if (this.scrollLeft < 0) {
        this.scrollLeft = 0;
      }

      this.renderViewport();
    };

    this.handleMousedown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      preScrollTop = this.scrollTop;
      preScrollLeft = this.scrollLeft;

      // 检查是否点击在滚动条上
      // if (x > this.viewportWidth - this.scrollbarSize) {
      //   this.isDragging = true;
      //   dragStartY = y - this.getScrollbarMetrics().thumbPositionY;
      // }
      // if (y > this.viewportHeight - this.scrollbarSize) {
      //   this.isDragging = true;
      //   dragStartX = x - this.getScrollbarMetrics().thumbPositionX;
      // }

      this.isDragging = true;
      dragStartX = x;
      dragStartY = y;
    };

    this.handleMousemove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 计算新的滚动位置
      // const newThumbPosY = Math.max(0,
      //   Math.min(
      //     this.viewportHeight - this.getScrollbarMetrics().thumbHeight,
      //     y - dragStartY
      //   )
      // );
      // const newThumbPosX = Math.max(0,
      //   Math.min(
      //     this.viewportWidth - this.getScrollbarMetrics().thumbHeight,
      //     x - dragStartX
      //   )
      // );
      const newThumbPosX = dragStartX - x;
      const newThumbPosY = dragStartY - y;

      this.scrollTop =
        preScrollTop +
        (newThumbPosY / this.viewportHeight) * this.contentHeight;
      this.scrollLeft =
        preScrollLeft + (newThumbPosX / this.viewportWidth) * this.contentWidth;
      if (this.scrollTop < 0) {
        this.scrollTop = 0;
      }
      if (this.scrollLeft < 0) {
        this.scrollLeft = 0;
      }
      this.renderViewport();
    };

    this.handleMouseup = () => {
      this.isDragging = false;
    };

    // 鼠标滚轮事件
    canvas.addEventListener('wheel', this.handleWheel);
    // canvas.addEventListener('mousedown', this.handleMousedown);
    // document.addEventListener('mousemove', this.handleMousemove);
    // document.addEventListener('mouseup', this.handleMouseup);
  },

  unListen(canvas: HTMLCanvasElement) {
    canvas.removeEventListener('wheel', this.handleWheel);
    // canvas.removeEventListener('mousedown', this.handleMousedown);
    // document.removeEventListener('mousemove', this.handleMousemove);
    // document.removeEventListener('mouseup', this.handleMouseup);
  },

  renderScrollbar(ctx: CanvasRenderingContext2D) {
    const { thumbWidth, thumbHeight, thumbPositionY, thumbPositionX } =
      this.getScrollbarMetrics();

    const hasHorizontalScrollbar = thumbWidth < this.viewportWidth;
    const hasVerticalScrollbar = thumbHeight < this.viewportHeight;
    // console.log('hasHorizontalScrollbar', hasHorizontalScrollbar)
    // console.log('hasVerticalScrollbar', hasVerticalScrollbar)

    ctx.fillStyle = '#e0e0e0';
    // 垂直滚动条
    if (hasVerticalScrollbar) {
      ctx.fillRect(
        this.viewportWidth - this.scrollbarSize,
        0,
        this.scrollbarSize,
        this.viewportHeight,
      );
    }

    // 水平滚动条
    if (hasHorizontalScrollbar) {
      ctx.fillRect(
        0,
        this.viewportHeight - this.scrollbarSize,
        this.viewportWidth,
        this.scrollbarSize,
      );
    }

    ctx.fillStyle = '#b0b0b0';
    // 水平滚动条滑块
    if (hasHorizontalScrollbar) {
      ctx.fillRect(
        thumbPositionX,
        this.viewportHeight - (this.scrollbarSize * 3) / 4,
        thumbWidth,
        this.scrollbarSize / 2,
      );
    }

    // 滚动条滑块
    if (hasVerticalScrollbar) {
      ctx.fillRect(
        this.viewportWidth - (this.scrollbarSize * 3) / 4,
        thumbPositionY,
        this.scrollbarSize / 2,
        thumbHeight,
      );
    }
  },
};
