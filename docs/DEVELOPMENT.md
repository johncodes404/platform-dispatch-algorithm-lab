# 开发文档

## 1. 技术目标

本项目优先保证透明、可解释和零门槛运行。当前网页没有框架、构建步骤、后端或数据库；浏览器直接加载 HTML、CSS 和 JavaScript。Python 版本提供更细的教学模型和可测试实现。

技术上的“简单”是设计选择：教师能离线运行，学生能查看源码，贡献者能把一次派单追踪到底。

## 2. 系统组成

| 部分 | 入口 | 职责 |
| --- | --- | --- |
| 互动网页 | public/lab/index.html | 组织教学内容、控件与结果区域 |
| 页面样式 | public/lab/styles.css | 视觉系统、响应式布局、状态和动画 |
| 浏览器模型 | public/lab/app.js | 情境、权重、评分、解释与连续模拟 |
| Python 模型 | python/dispatch_simulator.py | 更细的数据结构、硬约束、目标函数和命令行演示 |
| Python 测试 | python/test_dispatch_simulator.py | 核心行为与边界回归 |
| 部署 | .github/workflows/pages.yml | 将 public/lab 发布到 GitHub Pages |

## 3. 浏览器数据流

    用户调整权重或情境
      → getScenarioRiders() 生成本轮候选人快照
      → evaluate() 归一化并计算综合成本
      → renderScoreTable() 展示所有候选人
      → applyWinner() 展示获胜者、路线和风险解释
      → renderComparisons() 对比两套制度

refreshDecision() 是单次派单的统一刷新入口。新增视图时应复用它返回的 evaluation，避免在不同区域重复计算出不一致结果。

连续模拟另有一份 peakState。nextPeakOrder() 每轮使用当前权重评分，再累计骑手的订单、疲劳和收入。这一部分用于说明单次看似合理的选择如何形成长期分配后果。

## 4. 核心评分

### 4.1 硬约束

硬约束先判断候选人是否可进入排名。当前网页可开启疲劳保护线：疲劳超过 85 的候选人会被拦截。Python 模型还会拦截离线、满载和超过政策疲劳上限的人。

这是重要的治理设计：如果安全只是一项低权重软指标，它仍可能被速度或成本抵消。

### 4.2 归一化

同一指标在候选人间使用 min-max 归一化：

    normalized(x) = (x - min) / (max - min)

若该指标所有候选人相同，则全部记为 0，因为它无法区分本轮候选人。

归一化结果依赖候选集合。因此分数适合比较同一轮中的人，不应当被解释成跨时间、跨城市的绝对能力值。

### 4.3 加权目标

浏览器使用五项可见成本：

    score = Σ(normalized(feature) × weight(feature)) / Σ(weight)

指标包括：

- eta：预计送达时间；
- late：超时风险；
- cost：平台履约成本；
- fatigue：身体疲劳；
- fairness：当前分配不均。

分数越低越优先。若同分，ETA 更低者优先。

Python 模型把“公平”拆成 workload、recent_earnings，并额外加入 uncertainty，用于展示更细的制度设计。两套模型的教学主线一致，但指标粒度有意不同：网页追求即时可玩，Python 追求拆解和测试。修改概念时必须检查二者，并在文档中说明差异。

## 5. 主要 JavaScript 函数

| 函数 | 输入/状态 | 输出或副作用 |
| --- | --- | --- |
| getScenarioRiders | 基础骑手、事件 | 返回不修改原数据的情境快照 |
| normalize | 候选列表、指标名 | 返回 0–1 数组 |
| evaluate | 权重、候选人、保护线 | 返回完整结果和 winner |
| winnerExplanation | 获胜者 | 返回面向学习者的理由 |
| refreshDecision | 当前页面状态 | 统一重算并更新主要视图 |
| initialPeakState | 无 | 新建连续模拟状态 |
| nextPeakOrder | peakState、当前权重 | 推进一轮并累计后果 |
| renderPeak | peakState | 更新连续模拟界面 |

计算函数应尽量保持纯函数。DOM 操作留在 render、apply、bind 和 init 类函数中。

## 6. 本地开发

启动网页：

    python -m http.server 8000 --directory public/lab

打开 http://localhost:8000 。

运行 Python 演示和测试：

    python python/dispatch_simulator.py
    python python/dispatch_simulator.py --policy worker_friendly
    python -m unittest python/test_dispatch_simulator.py

项目没有安装依赖步骤。若未来引入工具链，必须同时说明教学收益、维护成本、离线方案和升级责任。

## 7. 常见扩展

### 新增事件

1. 在 app.js 的 eventEffects 中添加名称和说明。
2. 在 getScenarioRiders() 中明确它改变哪些观测值以及原因。
3. 在 index.html 的事件选择器加入选项。
4. 如连续模拟也需出现，在 peakEvents 中添加。
5. 检查解释是否会把外部事件错误归责给骑手。

### 新增指标

1. 定义含义、方向、单位、数据来源和可能偏差。
2. 加入 controls、预设和 evaluate() 的 keys。
3. 确保“数值越低越好”，或在进入评分前转换方向。
4. 更新界面、公式说明、Python 映射、测试和本文档。
5. 设计一个能让该指标真正改变结果的对照情境。

### 新增角色或游戏机制

先在 docs/GAME_DESIGN.md 中写明学习目标、角色资源、可见信息、行动和反馈，再开始写界面。游戏机制必须能在复盘中对应一个明确概念。

## 8. 调试顺序

遇到结果异常时依次检查：

1. 情境快照中的原始值是否正确；
2. 硬约束是否意外剔除候选人；
3. 指标方向是否统一为“越低越好”；
4. 归一化是否受到候选集合变化影响；
5. 权重总和和分项 parts 是否正确；
6. 排序和平分规则是否正确；
7. UI 是否使用同一次 evaluation。

可在浏览器开发者工具中临时检查 evaluation，但不要把调试日志长期留在发布页面。

## 9. 可访问性与性能

- 主要交互必须能用键盘完成；
- 结果不能只靠颜色区分，需同时使用文字、图标或状态；
- 新动画尊重系统的减少动态效果设置；
- 移动端宽度约 375px 时不应横向溢出；
- 音效永远是可选增强；
- 不加载与教学无关的大型依赖或追踪脚本。

## 10. 发布

推送到 main 且 public/lab 或 Pages 工作流发生变化时，GitHub Actions 会上传 public/lab 并发布 Pages。

发布后检查：

- Actions 的 deploy 作业成功；
- 在线页面能加载 CSS 和 JS；
- 完成一次权重调整、情境切换和高峰模拟；
- 页面链接和 README 一致。

更改核心算法时，同时在 PR 中记录测试结果和一个人工验证案例。
