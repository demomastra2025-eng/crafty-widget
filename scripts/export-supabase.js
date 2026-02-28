const fs = require("fs");
const path = require("path");
const process = require("process");

// Minimal .env loader to avoid extra deps
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (key && !process.env[key]) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Не хватает переменных окружения SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const REST_URL = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const OUTPUT_PATH = path.join(process.cwd(), "@data", "supabase_dump.json");

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ошибка ${res.status} при запросе ${url}: ${body}`);
  }

  return res.json();
}

async function getTablesWithColumns() {
  const res = await fetch(`${REST_URL}/`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: "application/openapi+json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Не удалось получить OpenAPI схему (${res.status}): ${body}`
    );
  }

  const spec = await res.json();
  const paths = Object.keys(spec.paths || {});

  const tables = paths
    .filter((p) => p !== "/" && !p.startsWith("/rpc/"))
    .map((p) => p.replace(/^\//, ""));

  return tables.map((table) => {
    const schema = spec.definitions?.[table] || {};
    const properties = schema.properties || {};
    const required = schema.required || [];

    const columns = Object.entries(properties).map(([name, meta]) => ({
      name,
      type: meta.format || meta.type || "unknown",
      description: meta.description || "",
      nullable: !required.includes(name),
    }));

    return { schema: "public", name: table, type: "table", columns };
  });
}

async function getSampleRows(schema, table, limit = 50) {
  const tablePath =
    schema && schema !== "public"
      ? encodeURIComponent(`${schema}.${table}`)
      : encodeURIComponent(table);
  return fetchJson(`${REST_URL}/${tablePath}?limit=${limit}`);
}

async function main() {
  console.log("Сбор информации о таблицах Supabase…");
  const tables = await getTablesWithColumns();

  const result = {
    generatedAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    tables: [],
  };

  for (const tbl of tables) {
    const { schema, name, type, columns } = tbl;
    console.log(`Обработка ${schema}.${name}`);

    const sampleRows = await getSampleRows(schema, name);

    result.tables.push({
      schema,
      name,
      type,
      columns,
      sampleCount: sampleRows.length,
      sampleRows,
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");

  console.log(`Готово. Файл сохранён: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Ошибка при экспорте:", err);
  process.exit(1);
});
