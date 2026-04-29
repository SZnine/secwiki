# SecWiki 安全知识库

一个基于 FastAPI + SQLite 的网络安全术语知识库，支持 AI 批量导入功能。

## 功能特性

- **知识分类体系**：16 个安全知识域，涵盖 Web 安全、网络攻防、云安全、AI 安全等
- **术语管理**：增删改查，支持版本历史
- **AI 批量导入**：四步向导，支持自定义提示词模板
- **深色模式**：一键切换明暗主题
- **搜索**：快速检索术语
- **导入导出**：JSON 格式，支持覆盖/合并两种模式

## 快速开始

### 环境要求

- Python 3.10+
- 现代浏览器

### 安装

```bash
pip install -r requirements.txt
```

### 启动

#### Windows

双击 `启动.bat` 或运行：

```bash
python -m backend.app.seed   # 初始化数据库
python -m uvicorn backend.app.main:app --reload --port 8000
```

#### Linux / macOS

```bash
python -m backend.app.seed   # 初始化数据库
python -m uvicorn backend.app.main:app --reload --port 8000
```

### 访问

打开浏览器访问 http://localhost:8000

## 项目结构

```
secwiki/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI 应用入口
│       ├── db.py             # 数据库初始化
│       ├── seed.py           # 默认分类数据
│       ├── schemas.py         # Pydantic 模型
│       └── api/              # API 路由
│           ├── taxonomy.py   # 分类体系
│           ├── terms.py      # 术语 CRUD
│           ├── search.py     # 搜索
│           ├── history.py    # 版本历史
│           └── import_export.py  # 导入导出
├── frontend/
│   ├── index.html           # 页面入口
│   ├── style.css            # 样式
│   ├── app.js              # 主控制器
│   ├── api.js              # API 调用
│   ├── state.js            # 状态管理
│   └── blocks.js           # 内容块渲染
├── AI_IMPORT_PROMPT.md      # AI 导入提示词模板
├── requirements.txt         # Python 依赖
└── 启动.bat                 # Windows 启动脚本
```

## AI 批量导入

1. 点击「导入」按钮进入向导
2. **Step 1**：输入术语名称，查看匹配结果
3. **Step 2**：复制生成的 AI 提示词
4. **Step 3**：将 AI 返回的 JSON 粘贴并验证
5. **Step 4**：查看导入结果

## 数据库

数据库文件：`secwiki.db`（SQLite）

首次启动时会自动初始化 16 个安全知识域的分类体系。

## 技术栈

- **后端**：FastAPI + SQLite + Pydantic
- **前端**：原生 JavaScript，无框架依赖
- **样式**：CSS Variables，支持明暗主题

## License

MIT
