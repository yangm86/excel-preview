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
    // let preScrollTop = 0;
    // let preScrollLeft = 0;

    this.handleWheel = (e: WheelEvent) => {
      e.preventDefault();

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
      const { thumbHeight, thumbWidth, thumbPositionY, thumbPositionX } = this.getScrollbarMetrics();

      // preScrollTop = this.scrollTop;
      // preScrollLeft = this.scrollLeft;

      // 重置拖拽起始位置
      dragStartX = 0;
      dragStartY = 0;

      // 检查是否点击在垂直滚动条滑块上
      if (x >= this.viewportWidth - this.scrollbarSize &&
          y >= thumbPositionY &&
          y <= thumbPositionY + thumbHeight) {
        this.isDragging = true;
        dragStartY = y - thumbPositionY;
      }
      // 检查是否点击在水平滚动条滑块上
      else if (y >= this.viewportHeight - this.scrollbarSize &&
               x >= thumbPositionX &&
               x <= thumbPositionX + thumbWidth) {
        this.isDragging = true;
        dragStartX = x - thumbPositionX;
      }
      // // 检查是否点击在垂直滚动条轨道上（非滑块部分）
      // else if (x >= this.viewportWidth - this.scrollbarSize) {
      //   // 点击轨道时，直接跳转到对应位置
      //   const clickRatio = y / this.viewportHeight;
      //   this.scrollTop = clickRatio * this.contentHeight;
      //   this.renderViewport();
      // }
      // // 检查是否点击在水平滚动条轨道上（非滑块部分）
      // else if (y >= this.viewportHeight - this.scrollbarSize) {
      //   // 点击轨道时，直接跳转到对应位置
      //   const clickRatio = x / this.viewportWidth;
      //   this.scrollLeft = clickRatio * this.contentWidth;
      //   this.renderViewport();
      // }
    };

    this.handleMousemove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { thumbHeight, thumbWidth } = this.getScrollbarMetrics();

      // 获取当前滚动条滑块位置
      const currentThumbPositionY = (this.scrollTop / this.contentHeight) * this.viewportHeight;
      const currentThumbPositionX = (this.scrollLeft / this.contentWidth) * this.viewportWidth;

      // 记录拖拽开始时点击的是哪个滚动条
      // 垂直滚动条拖拽标记
      const isDraggingVertical = dragStartY !== 0 && Math.abs(currentThumbPositionY - (y - dragStartY)) < thumbHeight * 2;
      // 水平滚动条拖拽标记
      const isDraggingHorizontal = dragStartX !== 0 && Math.abs(currentThumbPositionX - (x - dragStartX)) < thumbWidth * 2;

      // 计算新的滚动位置
      if (isDraggingVertical) {
        // 垂直滚动条拖拽
        const availableHeight = this.viewportHeight - thumbHeight;
        const newThumbPosY = Math.max(0, Math.min(availableHeight, y - dragStartY));
        const scrollRatio = newThumbPosY / availableHeight;
        this.scrollTop = scrollRatio * (this.contentHeight - this.viewportHeight + this.scrollbarSize);
      } else if (isDraggingHorizontal) {
        // 水平滚动条拖拽
        const availableWidth = this.viewportWidth - thumbWidth;
        const newThumbPosX = Math.max(0, Math.min(availableWidth, x - dragStartX));
        const scrollRatio = newThumbPosX / availableWidth;
        this.scrollLeft = scrollRatio * (this.contentWidth - this.viewportWidth + this.scrollbarSize);
      }

      // 确保滚动位置在有效范围内
      if (this.scrollTop < 0) {
        this.scrollTop = 0;
      } else if (this.scrollTop > this.contentHeight - this.viewportHeight + this.scrollbarSize) {
        this.scrollTop = this.contentHeight - this.viewportHeight + this.scrollbarSize;
      }

      if (this.scrollLeft < 0) {
        this.scrollLeft = 0;
      } else if (this.scrollLeft > this.contentWidth - this.viewportWidth + this.scrollbarSize) {
        this.scrollLeft = this.contentWidth - this.viewportWidth + this.scrollbarSize;
      }

      this.renderViewport();
    };

    this.handleMouseup = () => {
      this.isDragging = false;
      // 重置拖拽起始位置
      dragStartX = 0;
      dragStartY = 0;
    };

    // 鼠标滚轮事件
    canvas.addEventListener('wheel', this.handleWheel);
    canvas.addEventListener('mousedown', this.handleMousedown);
    document.addEventListener('mousemove', this.handleMousemove);
    document.addEventListener('mouseup', this.handleMouseup);
  },

  unListen(canvas: HTMLCanvasElement) {
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('mousedown', this.handleMousedown);
    document.removeEventListener('mousemove', this.handleMousemove);
    document.removeEventListener('mouseup', this.handleMouseup);
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
