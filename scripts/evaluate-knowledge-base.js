const fs = require("fs");
const path = require("path");

const baseUrl = (process.env.KNOWLEDGE_BASE_URL || "http://localhost:4174").replace(/\/$/, "");
const datasetPath = path.join(__dirname, "..", "knowledge-base-tests", "machine-learning-evaluation.json");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

async function main() {
  const rows = [];
  for (const test of dataset.cases) {
    const response = await fetch(`${baseUrl}/api/knowledge-base/search?q=${encodeURIComponent(test.query)}&limit=5`);
    const data = await response.json().catch(() => ({}));
    const results = Array.isArray(data.results) ? data.results : [];
    const passed = test.must_retrieve ? results.length > 0 : results.length === 0;
    rows.push({ query: test.query, expected: test.expected_topic, retrieved: results.length, top_page: results[0]?.page || null, passed });
  }
  const passed = rows.filter((row) => row.passed).length;
  console.table(rows);
  console.log(`知识库检索测试：${passed}/${rows.length} 通过`);
  if (passed !== rows.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
