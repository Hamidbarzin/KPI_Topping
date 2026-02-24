import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const KPI_FILE = path.join(DATA_DIR, 'kpi.json');

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(KPI_FILE);
  } catch {
    await fs.writeFile(KPI_FILE, '{}', 'utf8');
  }
}

async function readKpiStore() {
  await ensureDataFile();
  const raw = await fs.readFile(KPI_FILE, 'utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

async function writeKpiStore(data) {
  await ensureDataFile();
  await fs.writeFile(KPI_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET KPI state for a given month and user
app.get('/api/kpi/:month/:userId', async (req, res) => {
  const { month, userId } = req.params;
  try {
    const store = await readKpiStore();
    const monthData = store[month] || {};
    const userData = monthData[userId] || null;
    res.json({ ok: true, data: userData });
  } catch (err) {
    console.error('GET /api/kpi error', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

// UPSERT KPI state for a given month and user
app.post('/api/kpi/:month/:userId', async (req, res) => {
  const { month, userId } = req.params;
  const payload = req.body || {};

  try {
    const store = await readKpiStore();
    if (!store[month]) store[month] = {};

    const prev = store[month][userId] || {};
    // Shallow merge – frontend sends the full object in practice
    const next = { ...prev, ...payload };
    store[month][userId] = next;

    await writeKpiStore(store);
    res.json({ ok: true, data: next });
  } catch (err) {
    console.error('POST /api/kpi error', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

app.get('/', (_req, res) => {
  res.json({ status: 'KPI backend running' });
});

app.listen(PORT, () => {
  console.log(`KPI backend listening on port ${PORT}`);
});
