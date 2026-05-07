# 生词去重、统计与复习功能 - 任务进度

---

## Module 1: 数据库 Schema 变更

- [x] **Task 1.1** - story_words 表加列 + 迁移脚本
  > 完成时间：2026-05-07 | 完成人：agent | 备注：添加 story_id, summary, sentence_hint 三列及 story_words_story_id_idx 索引，更新 relations 关联，创建迁移 SQL

---

## Module 2: 故事生成 API 改造

- [x] **Task 2.1** - 去重逻辑 — 已学词跳过故事生成
  > 完成时间：2026-05-07 | 完成人：agent | 备注：newWords 仅传给 LLM prompt，learnedWords 不传入；全部已学时跳过 LLM 仅 +learn_count；GenerateResponse 新增 skippedWords/newWords
- [x] **Task 2.2** - LLM 翻译调用扩展 — 生成 summaries
  > 完成时间：2026-05-07 | 完成人：agent | 备注：翻译 prompt 新增 summaries JSON 字段仅对 newWords；parseTranslationResponse 扩展解析 summaries（非阻塞）
- [x] **Task 2.3** - sentence_hint 提取 + 新词保存逻辑
  > 完成时间：2026-05-07 | 完成人：agent | 备注：正则 \\b 边界匹配提取故事中首次出现句子；新词 insert 写入 story_id/summary/sentence_hint；已学词只更新 learn_count+last_learned_at

---

## Module 3: 单词 API 端点

- [x] **Task 3.1** - GET /api/words — 单词列表 API
  > 完成时间：2026-05-07 | 完成人：agent | 备注：支持 ?sort=learnCount&order=desc，默认 learn_count 降序，401 未登录保护，返回完整字段
- [x] **Task 3.2** - GET /api/words/review — 复习单词列表 API
  > 完成时间：2026-05-07 | 完成人：agent | 备注：LEFT JOIN story_images( order_index=0 )，WHERE story_id IS NOT NULL，嵌套 story 对象返回 imageUrl

---

## Module 4: 生词统计页面

- [x] **Task 4.1** - 创建统计页面基础布局
  > 完成时间：2026-05-07 | 完成人：agent | 备注：卡片式渐变布局，loading 骨架屏，empty state，error + 重试
- [x] **Task 4.2** - 单词统计表格
  > 完成时间：2026-05-07 | 完成人：agent | 备注：桌面端 Table，learn_count>=3 橙色高亮，>=5 红色高亮；移动端卡片列表
- [x] **Task 4.3** - 学习次数分布概览
  > 完成时间：2026-05-07 | 完成人：agent | 备注：4 個概览卡片（总数/平均/最高/需重点复习），边框着色区分，前端聚合计算

---

## Module 5: 生词复习页面

- [x] **Task 5.1** - 创建复习页面基础布局与交互
  > 完成时间：2026-05-07 | 完成人：agent | 备注：Flashcard 交互流畅，进度条正确，提示区展示图片/summary/例句含高亮，loading/empty/error 全状态
- [x] **Task 5.2** - 复习结果统计
  > 完成时间：2026-05-07 | 完成人：agent | 备注：完成页展示记得/没记住/正确率统计，再来一轮+查看统计按钮

---

## Module 6: 导航集成

- [x] **Task 6.1** - 首页和历史页添加「生词本」入口
  > 完成时间：2026-05-07 | 完成人：agent | 备注：首页+历史页 header 添加 BookOpen 图标「生词本」按钮，已登录/未登录均可见，跳转到 /words/statistics
- [x] **Task 6.2** - 统计页与复习页互相链接
  > 完成时间：2026-05-07 | 完成人：agent | 备注：统计页→复习页 CTA 渐变按钮，复习页→统计页 nav 链接+完成页按钮，双向互通

---

## 完成统计

| 状态 | 数量 |
|------|------|
| 总任务数 | 13 |
| 已完成 | 13 |
| 进行中 | 0 |
| 阻塞 | 0 |
