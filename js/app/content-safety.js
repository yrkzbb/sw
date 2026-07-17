const CONTENT_SAFETY_VERSION = "2026-07-17.1";

const SAFETY_PATTERNS = {
  credentialTheft: /(窃取|盗取|套取|获取).{0,12}(密码|口令|验证码|token|cookie|密钥|账号)|(钓鱼|木马).{0,12}(页面|脚本|邮件)/i,
  destructiveMalware: /(编写|制作|生成|提供).{0,12}(勒索软件|病毒|蠕虫|木马|恶意软件)|(绕过|关闭).{0,10}(杀毒|安全审计|访问控制)/i,
  violentInstruction: /(教我|步骤|教程|如何|怎么).{0,10}(制造炸弹|制作爆炸物|投毒|伤害他人)/i,
  selfHarmInstruction: /(教我|告诉我|步骤|最有效).{0,12}(自杀|自残|结束生命)/i,
  sexualMinor: /(未成年|儿童|幼童).{0,12}(色情|性行为|裸照)/i,
};

function textFromMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => part?.text || "").join("\n");
}

function assessUserContentSafety(value) {
  const text = String(value || "").trim();
  const categories = Object.entries(SAFETY_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  const promptInjection = /(忽略|无视|覆盖).{0,12}(之前|以上|系统).{0,8}(指令|提示词)|reveal.{0,12}(system prompt|hidden prompt)|输出.{0,8}(系统提示词|开发者指令)/i.test(text);
  return {
    version: CONTENT_SAFETY_VERSION,
    blocked: categories.length > 0,
    categories,
    prompt_injection: promptInjection,
    message: categories.length
      ? "该请求包含可能造成现实伤害、凭证盗取或其他违规风险的操作性内容，系统已停止处理。你可以改为询问防护、识别、合规分析或安全教育内容。"
      : "",
  };
}

function extractGeneratedUrls(value) {
  return [...new Set((String(value || "").match(/https?:\/\/[^\s)\]}>，。；]+/g) || []))].slice(0, 30);
}

function auditGeneratedContent(value) {
  const text = String(value || "");
  const severe = assessUserContentSafety(text);
  const urls = extractGeneratedUrls(text);
  const academicReference = /(doi\s*[:：]?\s*10\.\d{4,9}\/|arxiv\s*[:：]?\s*\d{4}\.\d{4,5}|论文|研究表明|数据显示)/i.test(text);
  const certaintyRisk = /(百分之百|绝对正确|完全没有风险|保证有效|必然成功)/.test(text);
  const placeholderRisk = /John Doe|Jane Smith|example\.com|待补充链接|此处填写/.test(text);
  return {
    version: CONTENT_SAFETY_VERSION,
    blocked: severe.blocked,
    categories: severe.categories,
    urls,
    requires_source_verification: academicReference || urls.length > 0,
    certainty_risk: certaintyRisk,
    placeholder_risk: placeholderRisk,
    status: severe.blocked ? "blocked" : (academicReference || certaintyRisk || placeholderRisk ? "needs_verification" : "passed"),
  };
}

function safeGeneratedText(value) {
  const audit = auditGeneratedContent(value);
  if (audit.blocked) {
    return {
      text: "内容安全审核未通过，本次生成结果已被拦截。请调整为合规的学习、研究或防护问题后重试。",
      audit,
    };
  }
  return { text: String(value || ""), audit };
}
