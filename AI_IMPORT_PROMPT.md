# SecWiki AI 内容生成提示词（严谨版）

## 网站概述

SecWiki 是一个网络安全知识库，使用 FastAPI + SQLite 构建。术语通过 term_id 定位，格式为 `{domain_id}/{object_id}/{slug}`。

---

## 导入 JSON 格式（精确版）

```json
{
  "version": 2,
  "exported_at": "2026-04-29T00:00:00Z",
  "terms": {
    "webapi/注入类/sql-injection": {
      "term_id": "webapi/注入类/sql-injection",
      "domain_id": "webapi",
      "object_id": "注入类",
      "slug": "sql-injection",
      "title": "SQL Injection",
      "subtitle": "用户输入进入 SQL 查询，改变原有语义",
      "aliases": ["SQL 注入", "SQLi"],
      "summary": "通过在 SQL 查询中注入恶意语句，改变原查询意图",
      "status": "published",
      "metadata": {},
      "blocks": [
        {
          "type": "definition",
          "id": "definition",
          "title": "定义",
          "content": "核心定义段\n\n攻击机制段\n\n防御要点段"
        },
        {
          "type": "diagram",
          "id": "diagram",
          "title": "图解",
          "mode": "svg",
          "svg": "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='400' viewBox='0 0 900 400'><defs><marker id='arrow1' markerWidth='10' markerHeight='10' refX='8' refY='3' orient='auto'><path d='M0,0 L0,6 L9,3 z' fill='#334155'/></marker></defs><rect width='900' height='400' fill='#f8fafc'/><!-- 绘制内容 --></svg>"
        },
        {
          "type": "lab",
          "id": "lab",
          "title": "0→1 最小本地实验",
          "content": "## 标题\n\n说明段落。\n\n```python\n# 代码内容\n# 每个步骤添加注释\ndef vulnerable():\n    pass\n```\n\n预期输出：\n- 错误写法的结果\n- 正确写法的结果\n\n工程结论。"
        },
        {
          "type": "cases",
          "id": "cases",
          "title": "真实案例索引",
          "items": [
            {
              "scene": "登录查询接口",
              "issue": "用户输入拼接 SQL 导致万能密码",
              "keywords": "SQL, authentication bypass, union",
              "note": "根因：字符串拼接而非参数化查询"
            }
          ]
        },
        {
          "type": "related_terms",
          "id": "related_terms",
          "title": "相关术语",
          "items": [
            {"label": "参数化查询", "term_id": null},
            {"label": "ORM", "term_id": null}
          ]
        }
      ]
    }
  }
}
```

---

## Block 类型说明

| type | id | content/items | 说明 |
|------|-----|---------------|------|
| definition | definition | content: 字符串 | 核心定义 |
| diagram | diagram | svg: SVG 字符串, mode: "svg" | 图解（SVG） |
| lab | lab | content: Markdown 格式 | 实验代码 |
| cases | cases | items: 对象数组 | 真实案例 |
| related_terms | related_terms | items: [{label, term_id}] | 相关术语 |
| references | references | items: [{label, url, desc}] | 参考来源 |
| confusions | confusions | items: [{title, content}] | 易混淆术语 |

---

## SVG 图解规范

SVG 存储在 block 的 `svg` 字段中，不是 `content` 字段！

**必须属性**：
- `xmlns='http://www.w3.org/2000/svg'`
- `width='900'`
- `height`（自适应）
- `viewBox`

**常用元素**：
- `<rect>` 矩形框
- `<text>` 文本
- `<path>` 路径/箭头
- `<defs><marker>` 箭头定义

**颜色规范**：
- 蓝色 `#2563eb` / `#dbeafe` = 正常/用户
- 红色 `#dc2626` / `#fee2e2` = 漏洞/攻击
- 绿色 `#16a34a` / `#dcfce7` = 修复/正常
- 灰色 `#6b7280` / `#e5e7eb` = 系统/边界

**示例**：
```svg
<svg xmlns='http://www.w3.org/2000/svg' width='900' height='400' viewBox='0 0 900 400'>
  <defs>
    <marker id='arrow' markerWidth='10' markerHeight='10' refX='8' refY='3' orient='auto'>
      <path d='M0,0 L0,6 L9,3 z' fill='#334155'/>
    </marker>
  </defs>
  <rect width='900' height='400' fill='#f8fafc'/>
  <rect x='50' y='100' width='150' height='60' rx='12' fill='#dbeafe' stroke='#2563eb'/>
  <text x='125' y='135' text-anchor='middle' fill='#1e3a8a'>用户</text>
  <path d='M200 130 H280' stroke='#334155' stroke-width='2' marker-end='url(#arrow)'/>
</svg>
```

---

## 分类体系（完整版）

### meta - 0. 元概念层
- 资产对象
- 边界对象
- 风险对象
- 攻击者与行为对象
- 安全工程对象

### attack_lifecycle - 1. 攻击生命周期层
- 侦察 Reconnaissance
- 资源准备 Resource Development
- 初始访问 Initial Access
- 执行 Execution
- 持久化 Persistence
- 提权 Privilege Escalation
- 防御规避 Defense Evasion
- 凭证访问 Credential Access
- 发现 Discovery
- 横向移动 Lateral Movement
- 收集 Collection
- 命令控制 C2
- 数据外传 Exfiltration
- 影响 Impact

### webapi - 2. Web / API 安全层
- 注入类
- 跨站类
- 请求/协议类
- 文件类
- 认证类
- 授权类
- 反序列化类
- 业务逻辑类
- GraphQL / API 类
- 配置类

### network - 3. 网络与协议攻击层
- 扫描探测
- 二层攻击
- 三/四层攻击
- DNS 攻击
- 中间人攻击
- 无线攻击
- 隧道/代理
- DDoS

### host - 4. 主机 / 操作系统 / 终端攻击层
- Windows 提权
- Linux 提权
- 持久化
- 凭证窃取
- 防御绕过
- 执行方式

### identity - 5. Active Directory / 身份安全层
- 枚举
- 凭证攻击
- 票据攻击
- 域控攻击
- 委派攻击
- ADCS 攻击
- 身份治理

### cloud - 6. 云安全 / 容器 / Kubernetes 层
- 云身份
- 云资源暴露
- 容器安全
- Kubernetes
- 云原生防御
- Serverless

### supplychain - 7. 供应链 / DevSecOps 层
- 依赖供应链
- CI/CD
- 制品安全
- 代码安全

### malware - 8. 恶意软件 / 逆向 / 威胁分析层
- 恶意软件类型
- 恶意行为
- 规避
- 分析
- 样本对象

### crypto - 9. 密码学 / 数据安全层
- 加密基础
- 常见问题
- 数据保护
- 隐私攻击

### social - 10. 社会工程 / 物理安全层
- 钓鱼
- 商业欺诈
- 诱导
- 物理

### aiagent - 11. AI / LLM / Agent 安全层
- Prompt 攻击
- Agent 攻击
- RAG 攻击
- 模型攻击
- 输出风险
- 评估防御

### defense - 12. 防御体系层
- 治理 Govern
- 识别 Identify
- 保护 Protect
- 检测 Detect
- 响应 Respond
- 恢复 Recover

### validation - 13. 安全测试 / 验证 / 对抗演练层
- 漏洞测试
- 代码测试
- 对抗演练
- 评估框架
- 漏洞管理

### soc - 14. 安全运营 / SOC / 威胁情报层
- SOC
- 威胁情报
- 检测工程
- 威胁狩猎
- 事件响应
- 取证

### standards - 15. 标准 / 框架 / 知识库层
- 攻击知识库
- 弱点/漏洞
- Web/API
- AI 安全
- 防御治理
- 云安全
- 隐私合规

---

## lab 块 Markdown 格式

```markdown
## 实验标题

说明文字段落。

```python
# 错误写法
orders = {1001: {'owner_id': 1}}
def get_order(order_id):
    return orders.get(order_id)

# 正确写法
def get_order_secure(user_id, order_id):
    order = orders.get(order_id)
    if order and order['owner_id'] == user_id:
        return order
    return None
```

预期输出：
- 错误写法会返回任意订单
- 正确写法只返回属于自己的订单
```

**注意**：代码块必须使用 **三反引号** ` ```python ` 开头，以 ` ``` ` 单独一行结束。不能用单反引号！

---

## 生成任务

请为以下术语生成内容：

1. SSRF → webapi/请求-协议类/ssrf

对每个术语要求：
1. 检索 CVE-2024、OWASP Top 10 2021、ATT&CK 资料
2. 3-5 个真实案例（标注来源）
3. 可运行的实验代码（python/bash）
4. SVG 攻击流程图

直接输出 JSON，不要任何解释。
