/* Block renderers — each function takes a block object and returns HTML string */

const BlockRenderers = {

  definition(block, editing) {
    if (editing) {
      return `<section class="field"><h3>定义</h3><textarea id="block-definition">${esc(block.content)}</textarea></section>`;
    }
    if (!block.content) return `<section class="field"><p class="empty">暂无定义。</p></section>`;
    return `<section class="field"><div class="definition-box"><div class="definition-label">定义</div><div class="definition-content">${nl2br(block.content)}</div></div></section>`;
  },

  diagram(block, editing) {
    if (editing) {
      const currentImage = block.image_url || block.content || "";
      return `<section class="field">
        <h3>图解</h3>
        <input type="file" id="block-diagram-file" accept="image/*" style="display:none">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <button class="btn btn-sm" onclick="document.getElementById('block-diagram-file').click()">选择图片</button>
          <button class="btn btn-sm btn-danger-outline" data-action="diagram-remove">删除图片</button>
        </div>
        <input type="text" id="block-diagram-url" value="${esc(currentImage)}" placeholder="或直接粘贴图片 URL" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px">
        <div id="block-diagram-preview" class="diagram-render" style="min-height:100px;display:${currentImage ? 'flex' : 'none'};align-items:center;justify-content:center">
          ${currentImage ? `<img src="${esc(currentImage)}" style="max-width:100%;max-height:400px" onerror="this.parentElement.innerHTML='<span style=\\'color:var(--muted)\\'>图片加载失败</span>'">` : '<span style="color:var(--muted)">暂无图片</span>'}
        </div>
      </section>`;
    }
    const imageUrl = block.image_url || block.content || "";
    if (!imageUrl) return `<section class="field"><p class="empty">暂无图解。</p></section>`;
    const caption = block.caption || block.title || "";
    return `<section class="field"><div class="diagram-render"><img src="${esc(imageUrl)}" style="max-width:100%;height:auto" onerror="this.outerHTML='<p class=\\'empty\\'>图片加载失败</p>'"></div>${caption ? `<div class="diagram-caption">${esc(caption)}</div>` : ""}</section>`;
  },

  lab(block, editing) {
    const content = block.content || "";
    if (editing) {
      return `<section class="field"><h3>0→1 最小本地实验</h3><textarea id="block-lab">${esc(content)}</textarea></section>`;
    }
    if (!content) return `<section class="field"><p class="empty">暂无实验。</p></section>`;
    return `<section class="field"><div class="lab-callout"><div class="lab-callout-title">0→1 最小本地实验</div>${renderLabContent(content)}</div></section>`;
  },

  cases(block, editing) {
    const items = block.items || [];
    if (editing) {
      return `<section class="field"><h3>真实案例索引</h3><textarea id="block-cases">${esc(JSON.stringify(items, null, 2))}</textarea><p class="muted">JSON 数组格式。</p></section>`;
    }
    if (!items.length) return `<section class="field"><p class="empty">暂无案例。</p></section>`;
    return `<section class="field">${items.map((c, i) => renderCase(c, i)).join("")}</section>`;
  },

  confusions(block, editing) {
    const items = block.items || [];
    if (editing) {
      return `<section class="field"><h3>易混淆</h3><textarea id="block-confusions">${esc(JSON.stringify(items, null, 2))}</textarea></section>`;
    }
    if (!items.length) return "";
    return `<section class="field"><div class="section-heading"><span class="section-heading-text">易混淆</span></div>${items.map(it => `<div class="case-item" style="padding:10px 14px"><strong>${esc(it.title)}</strong><p style="margin:4px 0 0;color:var(--muted)">${nl2br(it.content)}</p></div>`).join("")}</section>`;
  },

  related_terms(block, editing) {
    const items = block.items || [];
    if (editing) {
      return `<section class="field"><h3>相关术语</h3><textarea id="block-related">${esc(items.map(i => i.label).join("\n"))}</textarea><p class="muted">每行一个术语。</p></section>`;
    }
    if (!items.length) return "";
    return `<section class="field"><div class="section-heading"><span class="section-heading-text">相关术语</span></div><ul class="related-list">${items.map(it => {
      const reg = state.termRegistry[it.term_id];
      if (reg && reg.status !== "archived") {
        return `<li class="related-item"><button data-action="open-term" data-term-id="${esc(it.term_id)}">${esc(it.label)}</button></li>`;
      }
      return `<li class="related-item disabled">${esc(it.label)}</li>`;
    }).join("")}</ul></section>`;
  },

  references(block, editing) {
    const items = block.items || [];
    if (editing) {
      return `<section class="field"><h3>参考来源</h3><textarea id="block-references">${esc(JSON.stringify(items, null, 2))}</textarea></section>`;
    }
    if (!items.length) return "";
    return `<section class="field"><div class="section-heading"><span class="section-heading-text">参考来源</span></div><div class="ref-list">${items.map(it =>
      `<div class="ref-item">${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" class="ref-label">${esc(it.label)}</a>` : `<span class="ref-label">${esc(it.label)}</span>`}${it.desc ? `<span class="ref-desc"> — ${esc(it.desc)}</span>` : ""}</div>`
    ).join("")}</div></section>`;
  },
};


/* ── Helpers ── */

function renderBlock(block, editing) {
  const fn = BlockRenderers[block.type];
  const idAttr = block.id ? ` id="${esc(block.id)}"` : "";
  if (fn) {
    const html = fn(block, editing);
    return html.replace('<section class="field">', `<section class="field"${idAttr}>`);
  }
  if (editing) {
    return `<section class="field"${idAttr}><h3>${esc(block.title || block.type)}</h3><textarea id="block-${block.id}">${esc(block.content || "")}</textarea></section>`;
  }
  return block.content ? `<section class="field"${idAttr}><h3>${esc(block.title || block.type)}</h3><p>${nl2br(block.content)}</p></section>` : "";
}

function renderLabContent(text) {
  const lines = text.split("\n");
  let html = '<div class="lab-content">';
  let inCode = false, inList = false, listTag = "", inNotice = false;
  let codeLang = "", codeLines = [];

  function closeList() {
    if (inList) { html += listTag === "ol" ? "</ol>" : "</ul>"; inList = false; listTag = ""; }
  }
  function closeNotice() {
    html += "</div>"; inNotice = false;
  }

  // 检查是否是单反引号代码块开场（支持 `python 或 `python\n 格式）
  function isSingleCodeStart(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("`") || trimmed.startsWith("```")) return false;
    // 匹配 `python 或 `python\n 的情况
    const inner = trimmed.slice(1);
    return /^[a-zA-Z0-9_-]*$/.test(inner) || /^([a-zA-Z0-9_-]*)\n?$/.test(inner);
  }

  // 检查是否是单反引号代码块结束
  function isSingleCodeEnd(line) {
    const trimmed = line.trim();
    return trimmed === "`" || trimmed === "`\n" || trimmed === "\n`" || trimmed === "\n`\n";
  }

  for (const line of lines) {
    // 处理三反引号代码块
    if (line.startsWith("```")) {
      if (inCode) {
        html += renderCodeCard(codeLang, codeLines.join("\n"));
        inCode = false; codeLines = []; codeLang = "";
      } else {
        closeList();
        if (inNotice) closeNotice();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    // 处理单反引号代码块
    if (isSingleCodeStart(line)) {
      if (inCode) { html += renderCodeCard(codeLang, codeLines.join("\n")); codeLines = []; }
      closeList();
      if (inNotice) closeNotice();
      inCode = true;
      // 提取语言标识符（去掉前导反引号和可能的尾部换行）
      const trimmed = line.trim();
      codeLang = trimmed.slice(1).replace(/\n$/, "").trim() || "text";
      continue;
    }

    if (inCode) {
      // 检查是否是代码块结束（单独的 ` 行，或行尾有 `）
      if (isSingleCodeEnd(line) || line.trim().endsWith("`")) {
        // 去掉结尾的反引号
        let code = codeLines.join("\n");
        if (line.trim().endsWith("`")) {
          code = code.slice(0, -1);
        }
        html += renderCodeCard(codeLang, code);
        inCode = false; codeLines = []; codeLang = "";
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (line.startsWith("> ")) {
      closeList();
      if (!inNotice) { html += '<div class="lab-notice">'; inNotice = true; }
      html += `<p>${esc(line.slice(2))}</p>`;
      continue;
    }
    if (inNotice) closeNotice();

    if (line.startsWith("## ")) {
      closeList();
      html += `<div class="lab-heading">${esc(line.slice(3))}</div>`;
    } else if (line.startsWith("- ")) {
      if (!inList) { html += '<ul class="lab-ul">'; inList = true; listTag = "ul"; }
      html += `<li>${esc(line.slice(2))}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList) { html += '<ol class="lab-ol">'; inList = true; listTag = "ol"; }
      html += `<li>${esc(line.replace(/^\d+\.\s/, ""))}</li>`;
    } else if (line.trim()) {
      closeList();
      html += `<p>${esc(line)}</p>`;
    }
  }
  if (inCode) html += renderCodeCard(codeLang, codeLines.join("\n"));
  closeList();
  if (inNotice) closeNotice();
  html += "</div>";
  return html;
}

/* ── Syntax highlighting ── */

// Strategy: single-pass tokenizer. Walk the code character by character.
// Build a list of {type, text} tokens (comments, strings, text).
// Then render: text tokens are esc()-escaped, others passed through.
// This avoids any double-escaping.

function _tok(code, lang) {
  const l = (lang || "").toLowerCase();
  if (["python", "py"].includes(l)) return _tokPy(code);
  if (["bash", "sh", "shell", "zsh"].includes(l)) return _tokBash(code);
  if (["sql"].includes(l)) return _tokSql(code);
  if (["javascript", "js"].includes(l)) return _tokJs(code);
  if (["http"].includes(l)) return _tokHttp(code);
  return [{ type: "text", text: code }];
}

function _tokPy(code) {
  const kw = /\b(def|class|return|if|elif|else|import|from|as|with|try|except|finally|raise|for|in|while|break|continue|pass|yield|lambda|and|or|not|is|None|True|False|self|async|await|print)\b/g;
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // comment
    if (code[i] === '#') {
      let j = i + 1;
      while (j < code.length && code[j] !== '\n') j++;
      tokens.push({ type: "cmt", text: code.slice(i, j) });
      i = j;
      continue;
    }
    // triple-double-quote string
    if (code.slice(i, i + 3) === '"""') {
      let j = i + 3;
      while (j < code.length) {
        if (code.slice(j, j + 3) === '"""') { j += 3; break; }
        j++;
      }
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // triple-single-quote string
    if (code.slice(i, i + 3) === "'''") {
      let j = i + 3;
      while (j < code.length) {
        if (code.slice(j, j + 3) === "'''") { j += 3; break; }
        j++;
      }
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // double-quote string
    if (code[i] === '"' && code[i - 1] !== '\\') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') { if (code[j] === '\\') j++; j++; }
      if (code[j] === '"') j++;
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // single-quote string
    if (code[i] === "'" && code[i - 1] !== '\\') {
      let j = i + 1;
      while (j < code.length && code[j] !== "'") { if (code[j] === '\\') j++; j++; }
      if (code[j] === "'") j++;
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // identifier start
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (kw.test(word)) {
        tokens.push({ type: "kw", text: word });
        kw.lastIndex = 0;
      } else {
        tokens.push({ type: "text", text: word });
      }
      i = j; continue;
    }
    // number
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: "num", text: code.slice(i, j) });
      i = j; continue;
    }
    tokens.push({ type: "text", text: code[i] });
    i++;
  }
  return tokens;
}

function _tokBash(code) {
  const kw = /\b(if|then|else|fi|for|do|done|while|case|esac|function|return|exit|echo|export|source|chmod|chown|mkdir|rm|cp|mv|grep|sed|awk|curl|wget|python|python3|pip|sleep|npm|node|git|ssh|scp|kill|ps|ls|cd|pwd|cat|head|tail|sort|uniq|jq)\b/g;
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // comment
    if (code[i] === '#' && (i === 0 || code[i - 1] === '\n' || code[i - 1] === ';' || code[i - 1] === ' ' || code[i - 1] === '\t')) {
      let j = i + 1;
      while (j < code.length && code[j] !== '\n') j++;
      tokens.push({ type: "cmt", text: code.slice(i, j) });
      i = j; continue;
    }
    // double-quote string
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') { if (code[j] === '\\') j++; j++; }
      if (code[j] === '"') j++;
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // single-quote string
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== "'") j++;
      if (code[j] === "'") j++;
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // variable
    if (code[i] === '$') {
      tokens.push({ type: "var", text: '$' });
      i++; continue;
    }
    if (code[i] === '$' && /[\w{]/.test(code[i + 1] || '')) {
      let j = i + 1;
      if (code[j] === '{') {
        while (j < code.length && code[j] !== '}') j++;
        j++;
      } else {
        while (j < code.length && /\w/.test(code[j])) j++;
      }
      tokens.push({ type: "var", text: code.slice(i, j) });
      i = j; continue;
    }
    // word
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w-]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (kw.test(word)) {
        tokens.push({ type: "kw", text: word });
        kw.lastIndex = 0;
      } else {
        tokens.push({ type: "text", text: word });
      }
      i = j; continue;
    }
    // number
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: "num", text: code.slice(i, j) });
      i = j; continue;
    }
    tokens.push({ type: "text", text: code[i] });
    i++;
  }
  return tokens;
}

function _tokSql(code) {
  const kw = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|IF|NOT|EXISTS|ALTER|DROP|INDEX|JOIN|ON|AND|OR|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|IN|LIKE|IS|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT)\b/gi;
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // comment
    if (code.slice(i, i + 2) === '--') {
      let j = i + 2;
      while (j < code.length && code[j] !== '\n') j++;
      tokens.push({ type: "cmt", text: code.slice(i, j) });
      i = j; continue;
    }
    // string
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === "'") {
          if (code[j + 1] === "'") { j += 2; continue; }
          j++; break;
        }
        j++;
      }
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // word
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (kw.test(word)) {
        tokens.push({ type: "kw", text: word });
        kw.lastIndex = 0;
      } else {
        tokens.push({ type: "text", text: word });
      }
      i = j; continue;
    }
    // number
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: "num", text: code.slice(i, j) });
      i = j; continue;
    }
    tokens.push({ type: "text", text: code[i] });
    i++;
  }
  return tokens;
}

function _tokJs(code) {
  const kw = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|default|from|async|await|try|catch|finally|throw|typeof|instanceof|null|undefined|true|false|require|module|console)\b/g;
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // single-line comment
    if (code.slice(i, i + 2) === '//') {
      let j = i + 2;
      while (j < code.length && code[j] !== '\n') j++;
      tokens.push({ type: "cmt", text: code.slice(i, j) });
      i = j; continue;
    }
    // template literal
    if (code[i] === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== '`') { if (code[j] === '\\') j++; j++; }
      if (code[j] === '`') j++;
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // string
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== q) { if (code[j] === '\\') j++; j++; }
      if (code[j] === q) j++;
      tokens.push({ type: "str", text: code.slice(i, j) });
      i = j; continue;
    }
    // word
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (kw.test(word)) {
        tokens.push({ type: "kw", text: word });
        kw.lastIndex = 0;
      } else {
        tokens.push({ type: "text", text: word });
      }
      i = j; continue;
    }
    // number
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.x]/.test(code[j])) j++;
      tokens.push({ type: "num", text: code.slice(i, j) });
      i = j; continue;
    }
    tokens.push({ type: "text", text: code[i] });
    i++;
  }
  return tokens;
}

function _tokHttp(code) {
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // HTTP method
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    let matched = false;
    for (const m of methods) {
      if (code.slice(i, i + m.length).toUpperCase() === m && !/[a-zA-Z]/.test(code[i + m.length] || '')) {
        tokens.push({ type: "kw", text: code.slice(i, i + m.length) });
        i += m.length; matched = true; break;
      }
    }
    if (matched) continue;
    // header key
    if (/[A-Z]/.test(code[i]) && /[A-Z][\w-]*=/.test(code.slice(i, Math.min(i + 20, code.length)))) {
      let j = i;
      while (j < code.length && code[j] !== ':' && code[j] !== '\n') j++;
      if (code[j] === ':') {
        tokens.push({ type: "hdr", text: code.slice(i, j + 1) });
        i = j + 1; continue;
      }
    }
    // number
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: "num", text: code.slice(i, j) });
      i = j; continue;
    }
    tokens.push({ type: "text", text: code[i] });
    i++;
  }
  return tokens;
}

function _renderTokens(tokens) {
  const clsMap = { kw: "kw", str: "str", cmt: "cmt", num: "num", var: "flag", hdr: "hdr" };
  return tokens.map(t => {
    if (t.type === "text") return esc(t.text);
    return `<span class="hl-${clsMap[t.type] || t.type}">${esc(t.text)}</span>`;
  }).join("");
}

function highlightCode(code, lang) {
  const l = (lang || "").toLowerCase();
  let tokens;
  if (["python", "py"].includes(l)) tokens = _tokPy(code);
  else if (["bash", "sh", "shell", "zsh"].includes(l)) tokens = _tokBash(code);
  else if (["sql"].includes(l)) tokens = _tokSql(code);
  else if (["javascript", "js"].includes(l)) tokens = _tokJs(code);
  else if (["http"].includes(l)) tokens = _tokHttp(code);
  else tokens = [{ type: "text", text: code }];
  return _renderTokens(tokens);
}

function renderCodeCard(lang, code) {
  const display = esc(lang || "code");
  const highlighted = highlightCode(code, lang || "");
  return `<div class="code-card"><div class="code-head"><span>${display}</span><button class="btn code-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-card').querySelector('code').textContent)">复制</button></div><pre><code class="lang-${display}">${highlighted}</code></pre></div>`;
}

function renderCase(c, idx) {
  const open = state.expandedCaseIds.has(idx);
  const rawKw = c.keywords || [];
  const kwArr = Array.isArray(rawKw) ? rawKw : (typeof rawKw === "string" ? rawKw.split(/[,，]\s*/) : []);
  const kw = kwArr.filter(Boolean).map(k => `<span class="tag">${esc(k)}</span>`).join("");
  const scene = c.scene || "";
  const issue = c.issue || "";
  const note = c.note || "";
  const title = c.title || scene || "";

  // 按钮右边只显示 note
  const noteHtml = note ? `<span class="case-note">${esc(note)}</span>` : "";

  return `<div class="case-item">
    <button class="case-header" data-action="toggle-case" data-case-idx="${idx}">
      <span class="case-chevron${open ? " open" : ""}">&#9654;</span>
      <span class="case-title">${esc(title)}</span>
      ${noteHtml}
    </button>
    ${open ? `<div class="case-detail">
      ${scene ? `<div><dt>场景</dt><dd>${esc(scene)}</dd></div>` : ""}
      ${issue ? `<div><dt>问题</dt><dd>${esc(issue)}</dd></div>` : ""}
      ${note ? `<div><dt>备注</dt><dd>${esc(note)}</dd></div>` : ""}
      ${kw ? `<div class="case-keywords">${kw}</div>` : ""}
    </div>` : ""}
  </div>`;
}
