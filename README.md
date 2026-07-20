# 平台算法权力实验室

一个关于平台派单、劳动风险与规则公平的开源互动学习项目。

[在线体验](https://johncodes404.github.io/platform-dispatch-algorithm-lab/) · [课堂游戏设计](docs/GAME_DESIGN.md) · [参与贡献](CONTRIBUTING.md) · [开发路线图](docs/ROADMAP.md)

> 当我们改变“效率、收益、安全、公平”的权重，订单、风险和收益会被重新分配给谁？

## 项目是什么

本项目把抽象的平台派单算法做成一个可以操作、比较和讨论的透明模型。学习者可以调整权重、切换天气与供需情境、检查每位骑手的候选得分，并观察平台目标如何改变劳动者的工作机会、劳动强度与风险。

它适合：

- 大中小学的算法素养、劳动教育、经济与社会课程；
- 教师、研究者和社会工作者组织课堂讨论；
- 开发者共同探索“可解释算法”和公共利益设计；
- 普通公众理解平台、劳动者、消费者、商户与政府之间的复杂关系。

本项目不是任何真实平台的源代码，也不声称能够还原某家企业的私有算法。它是一个刻意简化、可解释、可质疑的教学模型。

## 立即开始

在线打开：[GitHub Pages 演示](https://johncodes404.github.io/platform-dispatch-algorithm-lab/)

推荐体验顺序：

1. 先观察“效率优先”预设下系统把订单派给谁。
2. 切换“劳动友好”或“安全优先”，比较获胜者和解释卡片。
3. 触发暴雨、晚高峰或供需紧张事件。
4. 打开决策透视，检查硬约束、归一化指标和分项得分。
5. 讨论：谁获得了收益，谁承担了风险，谁有权改变规则？

所有计算都在浏览器本地完成，不需要登录，也不会上传操作数据。

## 当前功能

- 可调节效率、平台收益、安全、公平等目标权重；
- 多种政策预设与社会事件；
- 候选骑手评分、排序和派单解释；
- 决策透视与指标归一化展示；
- 高峰订单连续模拟；
- 可独立运行的 Python 教学模型和单元测试；
- 纯 HTML、CSS、JavaScript 实现，便于部署与二次开发。

## 本地运行

无需构建工具，使用任意静态服务器即可：

    python -m http.server 8000 --directory public/lab

然后打开 http://localhost:8000 。

Python 教学模型：

    python python/dispatch_simulator.py
    python -m unittest python/test_dispatch_simulator.py

## 算法模型概览

网页先应用不可妥协的硬约束，再对可行候选人计算综合成本；总成本越低，排名越靠前。

    总成本 =
      效率权重 × 时间成本
      + 收益权重 × 平台成本
      + 安全权重 × 风险成本
      + 公平权重 × 负担不均成本
      + 情境修正

所有分项会归一化到 0–1 范围，方便观察权重变化。详细说明见 [开发文档](docs/DEVELOPMENT.md)。

## 文档导航

| 文档 | 用途 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 给 AI 编程助手的项目指令与安全边界 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献方式、分支与评审规范 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 架构、数据流、算法和调试方式 |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | 简明文件夹结构和文件职责 |
| [docs/TEAM_WORKFLOW.md](docs/TEAM_WORKFLOW.md) | 团队分工、协作流程与完成标准 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 下一阶段开发计划 |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | 多角色课堂游戏设计草案 |
| [docs/TEACHING_GUIDE.md](docs/TEACHING_GUIDE.md) | 课堂使用方法和复盘问题 |
| [docs/PROMOTION.md](docs/PROMOTION.md) | 对外介绍、朋友圈文案和参与入口 |

## 项目结构

    .
    ├── AGENTS.md
    ├── CONTRIBUTING.md
    ├── docs/
    ├── public/lab/
    ├── python/
    └── .github/

完整说明见 [docs/STRUCTURE.md](docs/STRUCTURE.md)。

## 如何参与

你不必会编程。可以贡献课堂案例、角色事件、研究资料、视觉设计、无障碍建议、测试反馈或代码。

开始前请阅读 [贡献指南](CONTRIBUTING.md)。较大的新功能建议先创建 Issue，说明它解决的教学问题，再进入设计和开发。

## 下一步：从实验室到课堂游戏

项目计划逐步加入平台经营者、投资者、劳动者、商户、消费者和监管者等角色。每个角色拥有不同目标和信息，在多轮事件中共同决定“蛋糕如何做大、风险由谁承担、规则由谁制定”。游戏重点不是寻找唯一正确答案，而是让参与者看见目标冲突、反馈回路与责任边界。

详见 [游戏设计](docs/GAME_DESIGN.md) 和 [路线图](docs/ROADMAP.md)。

## 开源许可

代码与项目文档采用 [MIT License](LICENSE)。欢迎学习、修改和传播；引用研究材料时，请同时遵守原始资料的许可要求。
