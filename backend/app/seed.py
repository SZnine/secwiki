"""Seed the SecWiki database with default taxonomy."""
import json
import re
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from app.db import init_db, get_db


def slug(name):
    s = name.lower().strip()
    s = re.sub(r"[^\w]+", "-", s, flags=re.UNICODE)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


# Default taxonomy - 16 security knowledge domains
DEFAULT_TAXONOMY = [
    {
        "id": "meta",
        "name": "元概念层",
        "objects": [
            {"name": "资产对象", "terms": []},
            {"name": "边界对象", "terms": []},
            {"name": "风险对象", "terms": []},
            {"name": "攻击者与行为对象", "terms": []},
            {"name": "安全工程对象", "terms": []},
        ]
    },
    {
        "id": "attack_lifecycle",
        "name": "攻击生命周期层",
        "objects": [
            {"name": "侦察 Reconnaissance", "terms": []},
            {"name": "资源准备 Resource Development", "terms": []},
            {"name": "初始访问 Initial Access", "terms": []},
            {"name": "执行 Execution", "terms": []},
            {"name": "持久化 Persistence", "terms": []},
            {"name": "提权 Privilege Escalation", "terms": []},
            {"name": "防御规避 Defense Evasion", "terms": []},
            {"name": "凭证访问 Credential Access", "terms": []},
            {"name": "发现 Discovery", "terms": []},
            {"name": "横向移动 Lateral Movement", "terms": []},
            {"name": "收集 Collection", "terms": []},
            {"name": "命令控制 C2", "terms": []},
            {"name": "数据外传 Exfiltration", "terms": []},
            {"name": "影响 Impact", "terms": []},
        ]
    },
    {
        "id": "webapi",
        "name": "Web / API 安全层",
        "objects": [
            {"name": "注入类", "terms": []},
            {"name": "跨站类", "terms": []},
            {"name": "请求/协议类", "terms": []},
            {"name": "文件类", "terms": []},
            {"name": "认证类", "terms": []},
            {"name": "授权类", "terms": []},
            {"name": "反序列化类", "terms": []},
            {"name": "业务逻辑类", "terms": []},
            {"name": "GraphQL / API 类", "terms": []},
            {"name": "配置类", "terms": []},
        ]
    },
    {
        "id": "network",
        "name": "网络与协议攻击层",
        "objects": [
            {"name": "扫描探测", "terms": []},
            {"name": "二层攻击", "terms": []},
            {"name": "三/四层攻击", "terms": []},
            {"name": "DNS 攻击", "terms": []},
            {"name": "中间人攻击", "terms": []},
            {"name": "无线攻击", "terms": []},
            {"name": "隧道/代理", "terms": []},
            {"name": "DDoS", "terms": []},
        ]
    },
    {
        "id": "host",
        "name": "主机 / 操作系统 / 终端攻击层",
        "objects": [
            {"name": "Windows 提权", "terms": []},
            {"name": "Linux 提权", "terms": []},
            {"name": "持久化", "terms": []},
            {"name": "凭证窃取", "terms": []},
            {"name": "防御绕过", "terms": []},
            {"name": "执行方式", "terms": []},
        ]
    },
    {
        "id": "identity",
        "name": "Active Directory / 身份安全层",
        "objects": [
            {"name": "枚举", "terms": []},
            {"name": "凭证攻击", "terms": []},
            {"name": "票据攻击", "terms": []},
            {"name": "域控攻击", "terms": []},
            {"name": "委派攻击", "terms": []},
            {"name": "ADCS 攻击", "terms": []},
            {"name": "身份治理", "terms": []},
        ]
    },
    {
        "id": "cloud",
        "name": "云安全 / 容器 / Kubernetes 层",
        "objects": [
            {"name": "云身份", "terms": []},
            {"name": "云资源暴露", "terms": []},
            {"name": "容器安全", "terms": []},
            {"name": "Kubernetes", "terms": []},
            {"name": "云原生防御", "terms": []},
            {"name": "Serverless", "terms": []},
        ]
    },
    {
        "id": "supplychain",
        "name": "供应链 / DevSecOps 层",
        "objects": [
            {"name": "依赖供应链", "terms": []},
            {"name": "CI/CD", "terms": []},
            {"name": "制品安全", "terms": []},
            {"name": "代码安全", "terms": []},
        ]
    },
    {
        "id": "malware",
        "name": "恶意软件 / 逆向 / 威胁分析层",
        "objects": [
            {"name": "恶意软件类型", "terms": []},
            {"name": "恶意行为", "terms": []},
            {"name": "规避", "terms": []},
            {"name": "分析", "terms": []},
            {"name": "样本对象", "terms": []},
        ]
    },
    {
        "id": "crypto",
        "name": "密码学 / 数据安全层",
        "objects": [
            {"name": "加密基础", "terms": []},
            {"name": "常见问题", "terms": []},
            {"name": "数据保护", "terms": []},
            {"name": "隐私攻击", "terms": []},
        ]
    },
    {
        "id": "social",
        "name": "社会工程 / 物理安全层",
        "objects": [
            {"name": "钓鱼", "terms": []},
            {"name": "商业欺诈", "terms": []},
            {"name": "诱导", "terms": []},
            {"name": "物理", "terms": []},
        ]
    },
    {
        "id": "aiagent",
        "name": "AI / LLM / Agent 安全层",
        "objects": [
            {"name": "Prompt 攻击", "terms": []},
            {"name": "Agent 攻击", "terms": []},
            {"name": "RAG 攻击", "terms": []},
            {"name": "模型攻击", "terms": []},
            {"name": "输出风险", "terms": []},
            {"name": "评估防御", "terms": []},
        ]
    },
    {
        "id": "defense",
        "name": "防御体系层",
        "objects": [
            {"name": "治理 Govern", "terms": []},
            {"name": "识别 Identify", "terms": []},
            {"name": "保护 Protect", "terms": []},
            {"name": "检测 Detect", "terms": []},
            {"name": "响应 Respond", "terms": []},
            {"name": "恢复 Recover", "terms": []},
        ]
    },
    {
        "id": "validation",
        "name": "安全测试 / 验证 / 对抗演练层",
        "objects": [
            {"name": "漏洞测试", "terms": []},
            {"name": "代码测试", "terms": []},
            {"name": "对抗演练", "terms": []},
            {"name": "评估框架", "terms": []},
            {"name": "漏洞管理", "terms": []},
        ]
    },
    {
        "id": "soc",
        "name": "安全运营 / SOC / 威胁情报层",
        "objects": [
            {"name": "SOC", "terms": []},
            {"name": "威胁情报", "terms": []},
            {"name": "检测工程", "terms": []},
            {"name": "威胁狩猎", "terms": []},
            {"name": "事件响应", "terms": []},
            {"name": "取证", "terms": []},
        ]
    },
    {
        "id": "standards",
        "name": "标准 / 框架 / 知识库层",
        "objects": [
            {"name": "攻击知识库", "terms": []},
            {"name": "弱点/漏洞", "terms": []},
            {"name": "Web/API", "terms": []},
            {"name": "AI 安全", "terms": []},
            {"name": "防御治理", "terms": []},
            {"name": "云安全", "terms": []},
            {"name": "隐私合规", "terms": []},
        ]
    },
]


def seed():
    """Initialize database with default taxonomy."""
    init_db()
    conn = get_db()

    # Check if already seeded
    count = conn.execute("SELECT COUNT(*) FROM domains").fetchone()[0]
    if count > 0:
        print(f"Database already has {count} domains. Skipping seed.")
        conn.close()
        return

    now = datetime.now(timezone.utc).isoformat()

    for idx, domain in enumerate(DEFAULT_TAXONOMY):
        domain_id = domain["id"]
        conn.execute(
            """INSERT OR REPLACE INTO domains (id, name, description, sort_order, created_at, updated_at)
               VALUES (?, ?, '', ?, ?, ?)""",
            (domain_id, domain["name"], idx, now, now),
        )

        for oidx, obj in enumerate(domain["objects"]):
            object_id = slug(obj["name"])
            if not object_id:
                object_id = f"obj{oidx}"

            conn.execute(
                """INSERT OR REPLACE INTO object_categories (id, domain_id, name, definition, sort_order, created_at, updated_at)
                   VALUES (?, ?, ?, '', ?, ?, ?)""",
                (object_id, domain_id, obj["name"], oidx, now, now),
            )

    conn.commit()

    # Stats
    dcount = conn.execute("SELECT COUNT(*) FROM domains").fetchone()[0]
    ocount = conn.execute("SELECT COUNT(*) FROM object_categories").fetchone()[0]
    tcount = conn.execute("SELECT COUNT(*) FROM terms").fetchone()[0]
    print(f"Done! {dcount} domains, {ocount} objects, {tcount} terms.")

    conn.close()


if __name__ == "__main__":
    seed()
