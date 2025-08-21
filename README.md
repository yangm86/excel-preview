# excel-preview

![](./screenshot.jpg)

使用 canvas 实现的一个轻量的预览 .xlsx / .xls / .csv 格式文件的 react 组件。

## 背景

在与 agent、知识库文档的交互过程中，通常会涉及到文件预览，比如 .xlsx / .docx / .ppt / .pdf / .wps / .dps 等等。

目前除了 excel 文件，其他格式几乎都可以转换为 pdf 后再去进行预览，方案比较成熟。

想要实现单纯的 excel 文件预览，而不需要编辑能力，目前已有的开源库几乎都很重。

## 使用方式

```jsx
import ExcelPreview from 'react-preview-excel'

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ExcelPreview
        url="/example1.xlsx"
        onInitLoad={() => {
          console.log('onInitLoad');
        }}
        onError={(err) => {
          console.log('onError', err);
        }}
        LoadingComponent={({ message }) => (
          <div>
            <p style={{ color: 'blue' }}>{message}</p>
          </div>
        )}
      />
    </div>
  )
}
```

## 介绍

从零手撸一个 excel 文件预览，支持 .xlsx / .xls / .csv 格式文件预览。

依赖库：

```json
{
    "dayjs": "^1.11.13",
    "exceljs": "^4.4.0",
    "xlsx": "^0.18.5"
}
```

- dayjs 用来处理单元格的日期格式
- xlsx 用来做格式转换，将 .csv 和 .xls 统一转成 .xlsx 格式
- exceljs 用来解析 excel 文件

示例文件：

- example1.xlsx 基础示例 2 个 sheet
- example2.xls xls 文件
- example3.csv csv 文件
- example-large.xlsx 超大数据示例

## 待实现

- [ ] 放大缩小
- [x] 单元格选中
- [ ] 单元格文本复制
- [ ] 滚动条拖拽
- [ ] 画布无限滚动自适应填充默认单元格
- [ ] 文本右对齐，好像是 exceljs 不支持
- [ ] 文本换行与溢出处理，目前默认是自动换行
- [ ] resize 窗口自适应

## 共建

本项目使用 rsbuild 初始化，欢迎 PR 贡献代码，也欢迎提出 issue 讨论。

## License

MIT


