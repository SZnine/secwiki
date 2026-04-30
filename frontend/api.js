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

  async uploadImage(file, termSlug) {
    const formData = new FormData();
    formData.append("file", file);
    if (termSlug) formData.append("term_slug", termSlug);
    const r = await fetch(`${API_BASE}/uploads/images`, { method: "POST", body: formData });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed: ${r.status}`);
    }
    return r.json();
  },

  async downloadImage(url, termSlug) {
    const formData = new FormData();
    formData.append("url", url);
    if (termSlug) formData.append("term_slug", termSlug);
    const r = await fetch(`${API_BASE}/uploads/images/from-url`, { method: "POST", body: formData });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail || `Download failed: ${r.status}`);
    }
    return r.json();
  },

  buildImportPrompt(selectedTerms, taxonomy) {
    const MAX_HIGH_QUALITY_BATCH_SIZE = 3;

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
        taskList += `${existingTerms.length + i + 1}. **${t.name}**\n`;
      });
    }

    const termJobs = selectedTerms.map((t, i) => {
      const order = i + 1;
      if (t.isNew) {
        return [
          `### TERM_JOB_${order}`,
          `- term_name: ${t.name}`,
          "- category_mode: LLM_SELECT_BEST_FIT",
          "- fixed_domain_id: null",
          "- fixed_object_id: null",
          "- independence_requirement: 必须把该术语当作一篇独立词条处理，不得复用其他术语的定义、案例、实验代码和 SVG 结构。",
        ].join("\n");
      }
      return [
        `### TERM_JOB_${order}`,
        `- term_name: ${t.name}`,
        "- category_mode: FIXED",
        `- fixed_domain_id: ${t.domainId}`,
        `- fixed_object_id: ${t.objectId}`,
        "- independence_requirement: 必须把该术语当作一篇独立词条处理，不得复用其他术语的定义、案例、实验代码和 SVG 结构。",
      ].join("\n");
    }).join("\n\n");

    const batchQualityNote = selectedTerms.length > MAX_HIGH_QUALITY_BATCH_SIZE
      ? [
          `本次共有 ${selectedTerms.length} 个术语，超过建议的高质量批量上限 ${MAX_HIGH_QUALITY_BATCH_SIZE} 个。`,
          "仍然必须逐术语独立生成；不得为了节省篇幅而把所有术语生成成低质量摘要。",
          "如果输出长度受限，优先保证前 3 个术语完整高质量，再继续生成后续术语。",
        ].join("\n")
      : `本次共有 ${selectedTerms.length} 个术语，处于高质量批量生成范围内。`;

    const CB = "```";

    const jsonExample = [
      "{",
      "  \"version\": 2,",
      "  \"exported_at\": \"YYYY-MM-DDTHH:mm:ssZ\",",
      "  \"terms\": {",
      "    \"webapi/注入类/sql-injection\": {",
      "      \"term_id\": \"webapi/注入类/sql-injection\",",
      "      \"domain_id\": \"webapi\",",
      "      \"object_id\": \"注入类\",",
      "      \"slug\": \"sql-injection\",",
      "      \"title\": \"SQL Injection\",",
      "      \"subtitle\": \"用户输入进入 SQL 查询，改变原有语义\",",
      "      \"aliases\": [\"SQL 注入\", \"SQLi\"],",
      "      \"summary\": \"通过在 SQL 查询中注入恶意语句，改变原查询意图，从而读取、修改或破坏数据库数据。\",",
      "      \"status\": \"published\",",
      "      \"metadata\": {},",
      "      \"blocks\": [",
      "        { \"type\": \"definition\", \"id\": \"definition\", \"title\": \"定义\", \"content\": \"核心定义段\\n\\n攻击/失控机制段\\n\\n防御控制点段\" },",
      "        { \"type\": \"diagram\", \"id\": \"diagram\", \"title\": \"图解\", \"content\": \"\" },",
      "        { \"type\": \"lab\", \"id\": \"lab\", \"title\": \"0→1 最小本地实验\", \"content\": \"## 标题\\n\\n说明段落。\\n\\n" + CB + "python\\n代码内容\\n" + CB + "\\n\\n预期输出：\" },",
      "        { \"type\": \"cases\", \"id\": \"cases\", \"title\": \"真实案例索引\", \"items\": [",
      "          { \"scene\": \"登录查询接口\", \"issue\": \"用户输入拼接 SQL 导致认证绕过\", \"keywords\": \"SQL, authentication bypass, union, boolean-based\", \"url\": null, \"note\": \"根因：字符串拼接而非参数化查询；真实来源需人工补充。\" }",
      "        ] },",
      "        { \"type\": \"confusions\", \"id\": \"confusions\", \"title\": \"易混淆点\", \"items\": [",
      "          { \"title\": \"SQL Injection vs 命令注入\", \"content\": \"相似点：都利用输入改变解释器语义。区别：SQL Injection 的解释器是数据库 SQL 引擎；命令注入的解释器是系统 Shell。\" }",
      "        ] },",
      "        { \"type\": \"related_terms\", \"id\": \"related_terms\", \"title\": \"相关术语\", \"items\": [",
      "          { \"label\": \"参数化查询\", \"term_id\": null },",
      "          { \"label\": \"输入验证\", \"term_id\": null }",
      "        ] },",
      "        { \"type\": \"references\", \"id\": \"references\", \"title\": \"参考来源\", \"items\": [",
      "          { \"label\": \"OWASP SQL Injection\", \"url\": \"https://owasp.org/www-community/attacks/SQL_Injection\", \"desc\": \"OWASP 对 SQL 注入攻击的基础说明。\" }",
      "        ] }",
      "      ]",
      "    }",
      "  }",
      "}"
    ].join("\n");

    const labExample = [
      "## 实验标题",
      "",
      "说明文字段落：先说明错误写法为什么会失控，再说明修复写法新增了哪个控制点。",
      "",
      CB + "python",
      "# 错误写法：缺少对象级授权检查",
      "orders = {1001: {'owner_id': 1, 'item': 'book'}, 1002: {'owner_id': 2, 'item': 'camera'}}",
      "",
      "def get_order_vulnerable(order_id):",
      "    return orders.get(order_id)",
      "",
      "# 正确写法：读取对象后校验 owner_id 是否属于当前用户",
      "def get_order_secure(user_id, order_id):",
      "    order = orders.get(order_id)",
      "    if not order:",
      "        return None",
      "    if order['owner_id'] != user_id:",
      "        return None",
      "    return order",
      "",
      "print(get_order_vulnerable(1002))",
      "print(get_order_secure(1, 1002))",
      CB,
      "",
      "预期输出：",
      "- 错误写法会返回其他用户订单。",
      "- 正确写法会返回 None，因为当前用户不拥有该对象。"
    ].join("\n");

    return [
      "你是一个网络安全知识库（SecWiki）的资深编辑专家，需要生成可直接导入的高质量术语内容。",
      "",
      "你的目标不是批量填空，而是为每个术语生成一篇独立、准确、可学习、可图解、可实验、可导入的安全知识词条。",
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
      "| diagram | diagram | content: 图片URL或留空 | 图解（手动上传图片） |",
      "| lab | lab | content: Markdown 格式，代码块必须用三反引号 | 最小实验 |",
      "| cases | cases | items: 对象数组 | 真实案例索引（3-5 个） |",
      "| confusions | confusions | items: 对象数组 | 易混淆术语 |",
      "| related_terms | related_terms | items: [{label, term_id}] | 相关术语 |",
      "| references | references | items: [{label, url, desc}] | 参考来源 |",
      "",
      "## 多术语独立生成协议",
      "",
      "当一次输入多个术语时，必须把每个术语视为一篇独立文章，而不是同一模板的批量填空。",
      "",
      "对每个术语，必须独立完成以下判断：",
      "1. 该术语的核心安全对象是什么：用户、请求、身份、权限、会话、数据、模型、工具、网络、主机、供应链或业务对象。",
      "2. 该术语的主要失控点是什么：输入失控、认证缺失、授权缺失、边界穿透、状态混淆、数据泄露、执行副作用、策略绕过、信任链断裂或资源滥用。",
      "3. 该术语和同批其他术语的关键差异是什么。",
      "4. 该术语的最小本地实验应该体现哪个真实控制点。",
      "",
      "禁止行为：",
      "- 禁止多个术语使用几乎相同的定义句式。",
      "- 禁止多个术语复用同一个实验代码，只替换变量名。",
      "- 禁止为了凑数量编造 CVE、案例 URL 或不存在的攻击场景。",
      "- 禁止把相邻概念混在一起解释，例如把 IDOR 写成认证问题，把 SSRF 写成普通请求转发问题，把 XSS 写成所有前端注入的统称。",
      "",
      "每个术语都必须体现自己的独立机制、独立风险、独立防御控制点和独立实验。",
      "",
      "## 批量生成质量约束",
      "",
      batchQualityNote,
      "",
      "## lab 块 Markdown 格式",
      "",
      CB + "markdown",
      labExample,
      CB,
      "",
      "注意：lab 的代码块必须使用三反引号开头，并以三反引号单独一行结束。不能用单反引号。",
      "",
      "## 分类体系",
      "",
      taxonomySection,
      "",
      "## 生成任务",
      "",
      taskList,
      "",
      "## 逐术语独立任务卡",
      "",
      termJobs,
      "",
      "## 对每个术语的最低质量要求",
      "",
      "1. definition 块必须包含 3 段：",
      "   - 第一段：一句话抓住本质，说明它到底是什么。",
      "   - 第二段：解释攻击/失控机制，说明数据流、权限流、请求流、状态流、信任流或执行流在哪里断裂。",
      "   - 第三段：说明核心防御控制点，不要只写泛泛的\"加强校验\"。",
      "",
      "2. diagram 块：留空或填写手动上传图片后的 URL，图解需在编辑页面手动上传。",
      "",
      "3. lab 块必须是该术语的 0→1 最小本地实验：",
      "   - 必须能让初学者在本地理解漏洞触发点。",
      "   - 必须同时包含错误写法与修复写法。",
      "   - 代码要短，但必须体现真实控制点。",
      "",
      "4. cases 块必须给出 3-5 个案例索引：",
      "   - 优先使用真实 CVE、OWASP、PortSwigger、MITRE、厂商公告、云安全公告或知名漏洞事件。",
      "   - 如果无法确认真实 URL，不要编造 URL；可以写 `url: null`，并在 note 中说明「需人工补充来源」。",
      "",
      "5. confusions 块必须给出 2-4 个易混淆概念：",
      "   - 每个都要说明：相似点、区别点、错误理解会导致什么误判。",
      "",
      "6. related_terms 块必须体现术语网络关系：",
      "   - 至少包含上游原因、相邻攻击面、下游影响、防御手段四类中的 2 类。",
      "",
      "7. references 块必须优先使用权威来源：",
      "   - OWASP、MITRE ATT&CK、CWE、NIST、PortSwigger Web Security Academy、RFC、云厂商安全文档、CVE/NVD。",
      "   - 不确定的来源不要编造。",
      "",
      "## 输出前自检清单（只在内部检查，不要输出这段）",
      "",
      "- JSON 是否可以被 JSON.parse 解析。",
      "- 每个 term_id 是否等于 terms 对象中的 key。",
      "- 每个已有术语是否严格使用指定 domain_id/object_id。",
      "- 每个新术语是否选择了最合适的 domain_id/object_id。",
      "- 每个术语是否都有 definition、diagram、lab、cases、confusions、related_terms、references。",
      "- 多个术语之间是否避免了定义、实验同质化。",
      "- 是否没有编造 URL。",
      "",
      "直接输出 JSON，不要任何解释、寒暄或 Markdown 包裹。",
    ].join("\n");
  }
};