# 文件夹结构说明

    .
    ├── .github/
    │   ├── ISSUE_TEMPLATE/          # 错误、功能与课堂反馈模板
    │   ├── PULL_REQUEST_TEMPLATE.md # PR 自检清单
    │   └── workflows/pages.yml      # GitHub Pages 自动发布
    ├── docs/
    │   ├── DEVELOPMENT.md           # 架构、算法、调试与发布
    │   ├── GAME_DESIGN.md           # 多角色课堂游戏设计
    │   ├── ROADMAP.md               # 分阶段开发计划
    │   ├── STRUCTURE.md             # 本文件
    │   ├── TEAM_WORKFLOW.md         # 团队协作说明
    │   ├── TEACHING_GUIDE.md        # 课堂使用方法
    │   └── PROMOTION.md             # 对外介绍和招募文案
    ├── public/lab/
    │   ├── index.html               # 公开网页入口与语义结构
    │   ├── styles.css               # 视觉、布局、响应式与动画
    │   ├── app.js                   # 浏览器派单模型和全部交互
    │   └── .nojekyll                # Pages 按原样发布静态文件
    ├── python/
    │   ├── dispatch_simulator.py    # 可测试的 Python 教学模型
    │   ├── test_dispatch_simulator.py
    │   └── PROJECT_NOTES.md         # 算法治理概念说明
    ├── AGENTS.md                    # AI 编程助手必须遵守的项目规则
    ├── CONTRIBUTING.md              # 贡献指南
    ├── CODE_OF_CONDUCT.md           # 社区行为准则
    ├── LICENSE                      # MIT 开源许可
    └── README.md                    # 项目公开入口

## 去哪里修改

| 需求 | 主要文件 | 通常还要检查 |
| --- | --- | --- |
| 改页面内容 | public/lab/index.html | styles.css、教学文档 |
| 改视觉或响应式 | public/lab/styles.css | index.html、键盘焦点 |
| 改权重、评分、事件 | public/lab/app.js | Python、测试、DEVELOPMENT |
| 改模型数据结构 | python/dispatch_simulator.py | 测试、网页映射 |
| 加课堂活动 | docs/TEACHING_GUIDE.md | GAME_DESIGN、README |
| 加游戏角色/回合 | docs/GAME_DESIGN.md | ROADMAP、开发 Issue |
| 改部署 | .github/workflows/pages.yml | README 的运行方式 |
| 改协作规则 | CONTRIBUTING.md | TEAM_WORKFLOW、模板 |

## 保持结构简洁的原则

- 可运行代码只放在 public/lab 和 python。
- 项目说明放根目录，专题长文放 docs。
- 自动化和 GitHub 协作模板放 .github。
- 不提交依赖目录、构建产物、编辑器缓存、密钥或真实个人数据。
- 新增一级目录前，先说明现有目录为什么无法承载它。
