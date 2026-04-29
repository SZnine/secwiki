const API_BASE = "/api/v1";

async function apiFetch(url, options = {}) {
  const r = await fetch(url, options);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error?.code || body.detail?.error?.code || `HTTP ${r.status}`);
  }
  return r.json();
}

const api = {
  async getTaxonomy() {
    return apiFetch(`${API_BASE}/taxonomy`);
  },

  async getDomain(domainId) {
    return apiFetch(`${API_BASE}/taxonomy/domains/${encodeURIComponent(domainId)}`);
  },

  async getTerm(termId) {
    const r = await fetch(`${API_BASE}/terms/${encodeURIComponent(termId)}`);
    if (!r.ok) return null;
    return r.json();
  },

  async createTerm(data) {
    return apiFetch(`${API_BASE}/terms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async updateTerm(termId, data) {
    return apiFetch(`${API_BASE}/terms/${encodeURIComponent(termId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async archiveTerm(termId) {
    return apiFetch(`${API_BASE}/terms/${encodeURIComponent(termId)}`, {
      method: "DELETE",
    });
  },

  async searchTerms(q) {
    return apiFetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  },

  async getHistory(termId) {
    return apiFetch(`${API_BASE}/terms/${encodeURIComponent(termId)}/history`);
  },

  async getVersion(termId, versionNo) {
    return apiFetch(`${API_BASE}/terms/${encodeURIComponent(termId)}/history/${versionNo}`);
  },

  async restoreVersion(termId, versionNo, changeNote = "") {
    return apiFetch(`${API_BASE}/terms/${encodeURIComponent(termId)}/history/${versionNo}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change_note: changeNote }),
    });
  },

  async exportAll() {
    return apiFetch(`${API_BASE}/export`);
  },

  async importContent(mode, payload) {
    return apiFetch(`${API_BASE}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, payload }),
    });
  },

  buildImportPrompt(selectedTerms, taxonomy) {
    const taxonomySection = taxonomy.domains.map(d => {
      const objs = d.objects.map(o => `- ${o.name}`).join("\n");
      return `### ${d.id} - ${d.name}\n${objs}`;
    }).join("\n\n");

    const existingTerms = selectedTerms.filter(t => !t.isNew);
    const newTerms = selectedTerms.filter(t => t.isNew);

    let taskList = "";
    if (existingTerms.length) {
      taskList += "## 已有术语（按当前分类生成内容）\n";
      existingTerms.forEach((t, i) => {
        taskList += `${i + 1}. **${t.name}** → ${t.domainId}/${t.objectId}\n`;
      });
    }
    if (newTerms.length) {
      taskList += "\n## 新术语（LLM 自行判断最佳分类位置）\n";
      newTerms.forEach((t, i) => {
        taskList += `${(existingTerms.length || 0) + i + 1}. **${t.name}**\n`;
      });
    }

    const CB = "```";
    const jsonExample = [
      '{',
      '  "version": 2,',
      '  "exported_at": "YYYY-MM-DDTHH:mm:ssZ",',
      '  "terms": {',
      '    "webapi/注入类/sql-injection": {',
      '      "term_id": "webapi/注入类/sql-injection",',
      '      "domain_id": "webapi",',
      '      "object_id": "注入类",',
      '      "slug": "sql-injection",',
      '      "title": "SQL Injection",',
      '      "subtitle": "用户输入进入 SQL 查询，改变原有语义",',
      '      "aliases": ["SQL 注入", "SQLi"],',
      '      "summary": "通过在 SQL 查询中注入恶意语句，改变原查询意图",',
      '      "status": "published",',
      '      "metadata": {},',
      '      "blocks": [',
      '        { "type": "definition", "id": "definition", "title": "定义", "content": "核心定义段\\n\\n攻击机制段\\n\\n防御要点段" },',
      '        { "type": "diagram", "id": "diagram", "title": "图解", "mode": "svg", "svg": "<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'900\' height=\'400\' viewBox=\'0 0 900 400\'><rect width=\'900\' height=\'400\' fill=\'#f8fafc\'/></svg>" },',
      '        { "type": "lab", "id": "lab", "title": "0→1 最小本地实验", "content": "## 标题\\n\\n说明段落。\\n\\n' + CB + 'python\\n代码内容\\n' + CB + '\\n\\n预期输出：" },',
      '        { "type": "cases", "id": "cases", "title": "真实案例索引", "items": [',
      '          { "scene": "登录查询接口", "issue": "用户输入拼接 SQL 导致万能密码", "keywords": "SQL, authentication bypass, union", "note": "根因：字符串拼接而非参数化查询" }',
      '        ] },',
      '        { "type": "related_terms", "id": "related_terms", "title": "相关术语", "items": [',
      '          { "label": "参数化查询", "term_id": null }',
      '        ] }',
      '      ]',
      '    }',
      '  }',
      '}'
    ].join("\n");

    const svgExample = [
      "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='400' viewBox='0 0 900 400'>",
      "  <defs>",
      "    <marker id='arrow' markerWidth='10' markerHeight='10' refX='8' refY='3' orient='auto'>",
      "      <path d='M0,0 L0,6 L9,3 z' fill='#334155'/>",
      "    </marker>",
      "  </defs>",
      "  <rect width='900' height='400' fill='#f8fafc'/>",
      "  <rect x='50' y='100' width='150' height='60' rx='12' fill='#dbeafe' stroke='#2563eb'/>",
      "  <text x='125' y='135' text-anchor='middle' fill='#1e3a8a'>用户</text>",
      "  <path d='M200 130 H280' stroke='#334155' stroke-width='2' marker-end='url(#arrow)'/>",
      "</svg>"
    ].join("\n");

    const labExample = [
      "## 实验标题",
      "",
      "说明文字段落。",
      "",
      CB + "python",
      "# 错误写法",
      "orders = {1001: {'owner_id': 1}}",
      "def get_order(order_id):",
      "    return orders.get(order_id)",
      "",
      "# 正确写法",
      "def get_order_secure(user_id, order_id):",
      "    order = orders.get(order_id)",
      "    if order and order['owner_id'] == user_id:",
      "        return order",
      "    return None",
      CB,
      "",
      "预期输出：",
      "- 错误写法会返回任意订单",
      "- 正确写法只返回属于自己的订单"
    ].join("\n");

    return [
      "你是一个网络安全知识库（SecWiki）的编辑专家，需要生成可直接导入的高质量术语内容。",
      "",
      "## 目标网站数据结构",
      "",
      "网站使用 term_id 作为术语的唯一标识，格式为：`{domain_id}/{object_id}/{slug}`",
      "- **domain_id**: 知识域 ID，如 `webapi`、`network`、`aiagent`",
      "- **object_id**: 对象分类 ID，如 `注入类`、`扫描探测`",
      "- **slug**: 术语的 URL 友好格式，如 `sql-injection`、`prompt-injection`",
      "",
      "## 导入 JSON 格式",
      "",
      "必须严格按照以下格式生成：",
      "",
      CB + "json",
      jsonExample,
      CB,
      "",
      "## Block 类型说明",
      "",
      "| type | id | content/items | 说明 |",
      "|------|-----|---------------|------|",
      "| definition | definition | content: 字符串 | 核心定义 |",
      "| diagram | diagram | svg: SVG 字符串, mode: \"svg\" | 图解（SVG） |",
      "| lab | lab | content: Markdown 格式，代码块必须用三反引号 " + CB + "python | 实验代码 |",
      "| cases | cases | items: 对象数组 | 真实案例（3-5个） |",
      "| related_terms | related_terms | items: [{label, term_id}] | 相关术语 |",
      "| references | references | items: [{label, url, desc}] | 参考来源 |",
      "| confusions | confusions | items: [{title, content}] | 易混淆术语 |",
      "",
      "## SVG 图解规范",
      "",
      "SVG 存储在 block 的 `svg` 字段中，不是 `content` 字段！",
      "",
      "**必须属性**：",
      "- `xmlns='http://www.w3.org/2000/svg'`",
      "- `width='900'`",
      "- `height`（自适应）",
      "- `viewBox`",
      "",
      "**常用元素**：",
      "- `<rect>` 矩形框",
      "- `<text>` 文本",
      "- `<path>` 路径/箭头",
      "- `<defs><marker>` 箭头定义",
      "",
      "**颜色规范**：",
      "- 蓝色 `#2563eb` / `#dbeafe` = 正常/用户",
      "- 红色 `#dc2626` / `#fee2e2` = 漏洞/攻击",
      "- 绿色 `#16a34a` / `#dcfce7` = 修复/正常",
      "- 灰色 `#6b7280` / `#e5e7eb` = 系统/边界",
      "",
      "**示例**：",
      CB + "svg",
      svgExample,
      CB,
      "",
      "## 分类体系",
      "",
      taxonomySection,
      "",
      "## lab 块 Markdown 格式",
      "",
      CB + "markdown",
      labExample,
      CB,
      "",
      "**注意**：代码块必须使用 **三反引号** " + CB + " 开头，以 " + CB + " 单独一行结束。不能用单反引号！",
      "",
      "## 生成任务",
      "",
      taskList,
      "",
      "对每个术语要求：",
      "1. 检索 CVE-2024、OWASP Top 10 2021、ATT&CK 最新资料",
      "2. 3-5 个真实案例（标注来源 URL）",
      "3. 可运行的实验代码（python/bash）",
      "4. SVG 攻击流程图（可选）",
      "",
      "直接输出 JSON，不要任何解释。",
    ].join("\n");
  }
};