# 生词去重、统计与复习功能 - 任务拆分文档

## 概述
1. 生成故事前去重：已学单词跳过不生成，但 learn_count++
2. story_words 表关联故事并存储提示信息
3. 生词统计页（按学习次数排序）
4. 生词复习页（flashcard + 提示）

---

## Module 1: 数据库 Schema 变更

### Task 1.1: story_words 表加列 + 迁移脚本
**文件**: `src/storage/database/shared/schema.ts`, `drizzle/0005_add_word_story_link.sql`

**实现要点**:
- `story_words` 表新增三列：
  - `story_id` varchar(36) — FK → stories.id，关联最初学会的故事
  - `summary` text — LLM 生成的单词释义概括段落
  - `sentence_hint` text — 故事中该单词首次出现的句子
- 创建迁移脚本 `drizzle/0005_add_word_story_link.sql`
- Drizzle schema 类型同步更新

**验收标准**:
- [ ] 迁移脚本包含三个 ALTER TABLE ADD COLUMN 语句
- [ ] schema.ts 中 storyWords 定义包含新三列
- [ ] `npm run db:push` 执行成功，数据库表结构更新
- [ ] StoryWord 类型自动包含新字段

---

## Module 2: 故事生成 API 改造

### Task 2.1: 去重逻辑 — 已学词跳过故事生成
**文件**: `src/app/api/generate/route.ts`

**实现要点**:
- 提交单词后，查询 story_words 区分 `newWords` vs `learnedWords`
- 只有 `newWords` 传给 LLM 生成故事（prompt 中只列新词）
- `learnedWords` 不传入故事 prompt
- 全部为 learnedWords 时：仅 +learn_count，返回特殊响应（不调 LLM）
- GenerateResponse 新增 `skippedWords: string[]` 和 `newWords: string[]`

**验收标准**:
- [ ] 已学单词不出现在 LLM story prompt 中
- [ ] 已学单词的 learn_count 正确 +1，last_learned_at 更新
- [ ] 全部已学时跳过 LLM 调用，返回提示
- [ ] 新单词正常生成故事
- [ ] 混合场景（部分新部分旧）正确工作

### Task 2.2: LLM 翻译调用扩展 — 生成 summaries
**文件**: `src/app/api/generate/route.ts`

**实现要点**:
- 翻译 LLM prompt 的 JSON 输出新增 `summaries` 字段
  - 格式：`{ "word1": "中文概括段落", "word2": "中文概括段落" }`
  - 只对 `newWords` 生成（不是全部提交单词）
  - 概括内容：该单词在这个故事里的释义、用法、语境
- `parseTranslationResponse()` 函数更新，解析 `summaries`
- 鲁棒解析（处理 LLM JSON 格式问题）

**验收标准**:
- [ ] LLM prompt 明确要求输出 summaries 字段
- [ ] summaries 只包含 newWords（不包含已学词）
- [ ] parseTranslationResponse 正确解析 summaries
- [ ] JSON 解析失败时不阻塞主流程

### Task 2.3: sentence_hint 提取 + 新词保存逻辑
**文件**: `src/app/api/generate/route.ts`

**实现要点**:
- 对每个 newWord 扫描 story 英文文本
- 正则匹配提取第一个包含该词（word boundary）的句子
- sentence_hint 即为该首句
- 新单词 insert 时写入 `story_id`、`summary`、`sentence_hint`
- 已学单词 update 时只改 learn_count + last_learned_at（不改 story_id 等）

**验收标准**:
- [ ] 每个新词正确提取故事中首次出现的句子
- [ ] 单词不在故事中（LLM 遗漏）时 sentence_hint 为空
- [ ] 新记录包含 story_id 关联到本次生成的故事
- [ ] 已学词的 story_id/summary/sentence_hint 保持不变

---

## Module 3: 单词 API 端点

### Task 3.1: GET /api/words — 单词列表 API
**文件**: `src/app/api/words/route.ts`（新建）

**实现要点**:
- 查询当前用户所有 story_words
- 支持 `?sort=learnCount&order=desc` 查询参数（默认按 learn_count 降序）
- 返回字段：id, word, translation, learnCount, firstLearnedAt, lastLearnedAt, summary, sentenceHint, storyId
- 需要认证（user_id cookie）

**验收标准**:
- [ ] GET /api/words 返回用户所有单词
- [ ] 默认按 learn_count 降序
- [ ] 未登录返回 401
- [ ] 响应格式清晰，字段完整

### Task 3.2: GET /api/words/review — 复习单词列表 API
**文件**: `src/app/api/words/review/route.ts`（新建）

**实现要点**:
- 查询用户所有有 story_id 的 story_words
- JOIN story_images 取第一张图片（order_index=0）
- 返回字段：id, word, translation, summary, sentenceHint, learnCount, story: { id, imageUrl }
- 按 learn_count 降序排列（高频词优先复习）
- 需要认证

**验收标准**:
- [ ] GET /api/words/review 返回有故事的单词列表
- [ ] 每个单词包含关联故事的第一张图片 URL
- [ ] 按 learn_count 降序
- [ ] 无故事的单词不出现在复习列表

---

## Module 4: 生词统计页面

### Task 4.1: 创建统计页面基础布局
**文件**: `src/app/words/statistics/page.tsx`（新建）

**实现要点**:
- 创建 `/words/statistics` 路由
- 页面采用卡片式布局
- 顶部导航：返回首页 + 链接复习页
- 使用项目统一渐变背景和样式
- 添加 loading 骨架屏和 empty state

**验收标准**:
- [ ] 页面可正常访问 `/words/statistics`
- [ ] 布局美观，符合现有设计风格
- [ ] 有 loading 和 empty state
- [ ] 导航链接正常工作

### Task 4.2: 单词统计表格
**文件**: `src/app/words/statistics/page.tsx`

**实现要点**:
- 从 `/api/words` 获取数据
- 表格列：单词、中文释义、学习次数、首次学习、最近学习
- 按 learn_count 降序排列
- learn_count ≥ 3 的行用橙色高亮，≥ 5 的用红色高亮（标记高频遗忘词）
- 响应式设计（移动端简化列）

**验收标准**:
- [ ] 表格正确显示所有单词统计数据
- [ ] 高频词行正确高亮着色
- [ ] 数据加载状态正确处理
- [ ] 移动端显示正常

### Task 4.3: 学习次数分布概览
**文件**: `src/app/words/statistics/page.tsx`

**实现要点**:
- 页面顶部展示概览卡片：总单词数、平均学习次数、最高学习次数、需要重点关注的单词数（learn_count ≥ 3）
- 可选：简单的学习次数分布图（使用 Recharts）

**验收标准**:
- [ ] 概览卡片显示正确的统计数据
- [ ] 数据来自 API 实时计算（或前端聚合）
- [ ] 样式与页面统一

---

## Module 5: 生词复习页面

### Task 5.1: 创建复习页面基础布局与交互
**文件**: `src/app/words/review/page.tsx`（新建）

**实现要点**:
- 创建 `/words/review` 路由
- Flashcard 式交互：
  - 卡片正面：英文单词（大字体居中）
  - 进度条：当前位置/总数
  - 「显示答案」按钮 → 展示中文翻译
  - 「提示」按钮 → 展开提示区
- 提示区内容：
  - 故事插图（从 API 获取的 imageUrl）
  - 概括段落（summary）
  - 故事例句（sentence_hint）
- 「记得了」/「没记住」按钮 → 下一个词
- 全部复习完显示完成页
- 导航：返回首页 + 链接统计页

**验收标准**:
- [ ] 页面可正常访问 `/words/review`
- [ ] Flashcard 交互流畅：显示单词 → 答案/提示 → 标记 → 下一个
- [ ] 进度条正确显示进度
- [ ] 提示区正确展示图片、概括、例句
- [ ] 复习完成页显示统计和操作按钮
- [ ] 有 loading 和 empty state（无单词时）

### Task 5.2: 复习结果统计
**文件**: `src/app/words/review/page.tsx`

**实现要点**:
- 复习过程中记录：记得数、没记住数、跳过数
- 完成页展示复习统计
- 「再来一轮」按钮重新开始
- 「返回统计」按钮跳转统计页

**验收标准**:
- [ ] 复习统计在完成页正确显示
- [ ] 「再来一轮」重新开始复习
- [ ] 统计数据在当次 session 内准确

---

## Module 6: 导航集成

### Task 6.1: 首页和历史页添加「生词本」入口
**文件**: `src/app/page.tsx`, `src/app/history/page.tsx`

**实现要点**:
- 在首页 header（错题本按钮旁边）添加「生词本」导航按钮
- 在历史页 header 同样添加
- 按钮样式与现有导航按钮一致
- 图标使用 `BookOpen` 或类似图标

**验收标准**:
- [ ] 首页 header 显示「生词本」按钮
- [ ] 历史页 header 显示「生词本」按钮
- [ ] 点击跳转到 `/words/statistics`
- [ ] 样式与现有导航协调
- [ ] 未登录用户也能看到入口（点击后可提示登录）

### Task 6.2: 统计页与复习页互相链接
**文件**: `src/app/words/statistics/page.tsx`, `src/app/words/review/page.tsx`

**实现要点**:
- 统计页添加「开始复习」按钮跳转到 `/words/review`
- 复习页添加「查看统计」按钮跳转到 `/words/statistics`
- 两页顶部 header 都包含到对方页面的链接

**验收标准**:
- [ ] 统计页 → 复习页链接正常
- [ ] 复习页 → 统计页链接正常
- [ ] 按钮样式醒目（引导用户操作）
