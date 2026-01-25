#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const DEFAULT_ROOT = 'D:\\icloud\\iCloudDrive\\osa\\سيناريوهات';

const parseExtList = (value) => {
  const raw = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (raw.length === 0) return [];

  return raw.map((x) => (x.startsWith('.') ? x.toLowerCase() : `.${x.toLowerCase()}`));
};

const estimateTokensFromChars = (text, charsPerToken) => {
  const denom = Math.max(1, Number(charsPerToken) || 4);
  return Math.ceil(String(text || '').length / denom);
};

const getModelMaxContextTokens = (modelName) => {
  const m = String(modelName || '').toLowerCase();

  // حسب بطاقة Mistral Small 3.1: حتى 128k توكن.
  if (m.includes('mistral') && m.includes('24')) return 128 * 1024;
  if (m.includes('mistral-small-3.1')) return 128 * 1024;

  return null;
};

const parseArgs = (argv) => {
  const args = {
    root: DEFAULT_ROOT,
    out: 'tools-output\\screenplay-patterns-report.md',
    aiOut: 'tools-output\\screenplay-ai-recommendations.md',
    maxFiles: 250,
    maxLinesPerFile: 600,
    maxExamplesPerPattern: 25,
    aiExamplesPerPattern: 8,
    aiBatchPatterns: 3,
    aiContextTokens: 8192,
    aiReserveTokens: 2048,
    aiCharsPerToken: 4,
    aiMistakesMaxChars: 6000,
    includeFileList: false,
    fileExts: ['.txt', '.docx', '.doc'],
    ai: false,
    model: 'mistral24b',
    task: 'patterns',
    mistakesFile: '',
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === '--root' && next) {
      args.root = next;
      i++;
      continue;
    }

    if (a === '--out' && next) {
      args.out = next;
      i++;
      continue;
    }

    if (a === '--aiOut' && next) {
      args.aiOut = next;
      i++;
      continue;
    }

    if (a === '--maxFiles' && next) {
      args.maxFiles = Number(next) || args.maxFiles;
      i++;
      continue;
    }

    if (a === '--maxLinesPerFile' && next) {
      args.maxLinesPerFile = Number(next) || args.maxLinesPerFile;
      i++;
      continue;
    }

    if (a === '--maxExamplesPerPattern' && next) {
      args.maxExamplesPerPattern = Number(next) || args.maxExamplesPerPattern;
      i++;
      continue;
    }

    if (a === '--aiExamplesPerPattern' && next) {
      args.aiExamplesPerPattern =
        Number(next) || args.aiExamplesPerPattern;
      i++;
      continue;
    }

    if (a === '--aiBatchPatterns' && next) {
      args.aiBatchPatterns = Number(next) || args.aiBatchPatterns;
      i++;
      continue;
    }

    if (a === '--aiContextTokens' && next) {
      args.aiContextTokens = Number(next) || args.aiContextTokens;
      i++;
      continue;
    }

    if (a === '--aiReserveTokens' && next) {
      args.aiReserveTokens = Number(next) || args.aiReserveTokens;
      i++;
      continue;
    }

    if (a === '--aiCharsPerToken' && next) {
      args.aiCharsPerToken = Number(next) || args.aiCharsPerToken;
      i++;
      continue;
    }

    if (a === '--aiMistakesMaxChars' && next) {
      args.aiMistakesMaxChars = Number(next) || args.aiMistakesMaxChars;
      i++;
      continue;
    }

    if (a === '--includeFileList') {
      args.includeFileList = true;
      continue;
    }

    if (a === '--ai') {
      args.ai = true;
      continue;
    }

    if (a === '--model' && next) {
      args.model = next;
      i++;
      continue;
    }

    if (a === '--task' && next) {
      args.task = next;
      i++;
      continue;
    }

    if (a === '--mistakes' && next) {
      args.mistakesFile = next;
      i++;
      continue;
    }

    if (a === '--ext' && next) {
      const exts = parseExtList(next);
      if (exts.length > 0) args.fileExts = exts;
      i++;
      continue;
    }

    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
  }

  // توافق للخلف: لو المستخدم كتب --ai (القديم) نحوله لتشغيل AI + patterns
  if (args.ai && (!args.task || args.task === 'patterns')) {
    args.task = 'both';
  }

  return args;
};

const stripLeadingBullets = (line) => {
  // Removes common screenplay bullet/marker prefixes
  return line.replace(/^\s*(?:[•\-*–—]+)\s*/u, '');
};

const normalizeSpaces = (s) => s.replace(/\s+/g, ' ').trim();

const safeReadText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    // Try UTF-16LE (common in Windows exports)
    try {
      return fs.readFileSync(filePath, 'utf16le');
    } catch {
      return null;
    }
  }
};

let warnedMammothMissing = false;
let warnedWordExtractorMissing = false;

const safeReadDocumentText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt') return safeReadText(filePath);

  if (ext === '.docx') {
    let mammoth;
    try {
      mammoth = require('mammoth');
    } catch {
      if (!warnedMammothMissing) {
        warnedMammothMissing = true;
        console.error(
          'لاستخراج نص .docx ثبّت الحزمة: pnpm add -D mammoth (أو npm i -D mammoth)',
        );
      }
      return null;
    }

    try {
      const res = await mammoth.extractRawText({ path: filePath });
      return res && typeof res.value === 'string' ? res.value : null;
    } catch {
      return null;
    }
  }

  if (ext === '.doc') {
    let WordExtractor;
    try {
      WordExtractor = require('word-extractor');
    } catch {
      if (!warnedWordExtractorMissing) {
        warnedWordExtractorMissing = true;
        console.error(
          'لاستخراج نص .doc ثبّت الحزمة: pnpm add -D word-extractor (أو npm i -D word-extractor)',
        );
      }
      return null;
    }

    try {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(filePath);
      const body = typeof doc.getBody === 'function' ? doc.getBody() : '';
      return typeof body === 'string' ? body : null;
    } catch {
      return null;
    }
  }

  return null;
};

const truncateText = (s, maxChars) => {
  if (!s) return '';
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + '...';
};

const chunkArray = (arr, chunkSize) => {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const size = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const postJson = (url, bodyObj) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(bodyObj);
    const u = new URL(url);

    const transport = u.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        method: 'POST',
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(raw);
            return;
          }
          reject(
            new Error(
              `HTTP ${res.statusCode || 'unknown'}: ${truncateText(raw, 800)}`,
            ),
          );
        });
      },
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });

// 🔄 دالة جديدة للاتصال بـ Ollama المحلي
const callOllama = async ({ model, prompt, contextTokens }) => {
  // لاحظ: بنكلم السيرفر المحلي بتاعنا
  const url = 'http://127.0.0.1:11434/api/generate';

  const payload = {
    // اسم الموديل اللي سميناه في خطوة ollama create
    // لو مبعتوش في الأوامر، هنستخدم الديفولت ده
    model,
    prompt: prompt,
    stream: false, // مش عايزين رد متقطع، عايزينه مرة واحدة
    options: {
      temperature: 0.2, // نفس درجة الإبداع اللي كانت في الكود القديم
      num_ctx: Math.max(1024, Number(contextTokens) || 8192),
    },
  };

  try {
    // هنستخدم نفس دالة postJson بتاعتك، هي شغالة تمام
    const raw = await postJson(url, payload);
    const json = JSON.parse(raw);

    // Ollama بيرجع الرد في حقل اسمه 'response'
    if (!json.response) {
      throw new Error(`Empty response from Ollama: ${truncateText(raw, 200)}`);
    }

    return json.response;
  } catch (e) {
    throw new Error(`Ollama Error: ${e.message}`);
  }
};

const isProbablyNarrativeText = (lines) => {
  // Heuristic: lots of long paragraph-like lines and low screenplay markers
  let longCount = 0;
  let markersCount = 0;

  for (const raw of lines) {
    const line = normalizeSpaces(raw);
    if (!line) continue;

    if (line.length >= 120) longCount++;

    if (
      /^مشهد\s*\d+/u.test(line) ||
      /^قطع\s*$/u.test(line) ||
      /\b(?:داخلي|داخلى|خارجي|خارجى)\b/u.test(line) ||
      /\b(?:ليل|نهار)\b/u.test(line) ||
      /\b(?:INT\.|EXT\.|INT\/EXT)\b/i.test(line)
    ) {
      markersCount++;
    }
  }

  const effectiveLines = lines.filter((l) => normalizeSpaces(l)).length || 1;
  const longRatio = longCount / effectiveLines;
  const markerRatio = markersCount / effectiveLines;

  return longRatio >= 0.6 && markerRatio <= 0.12;
};

const walkFiles = (rootDir, exts, maxFiles) => {
  const results = [];
  const stack = [rootDir];

  const extsList = (Array.isArray(exts) ? exts : parseExtList(exts)).map((e) =>
    e.toLowerCase(),
  );

  while (stack.length && results.length < maxFiles) {
    const dir = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common noisy/system dirs
        if (/^(?:\.git|node_modules|\.next|System Volume Information)$/i.test(entry.name)) {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile()) {
        const nameLower = entry.name.toLowerCase();
        if (extsList.some((e) => nameLower.endsWith(e))) {
          results.push(full);
        }
      }
    }
  }

  return results;
};

const ensureDirForFile = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

const addExample = (bucket, text, meta, max) => {
  if (bucket.examples.length >= max) return;
  bucket.examples.push({ text, ...meta });
};

const chunkPatternsByPromptBudget = ({
  patternsSummary,
  basePrompt,
  charsPerToken,
  promptBudgetTokens,
  maxPatternsPerBatch,
}) => {
  const batches = [];
  let current = [];

  const buildPromptText = (batch, bi, total) =>
    [
      ...basePrompt,
      `دفعة ${bi} من ${total}:`,
      '```json',
      JSON.stringify({ patterns: batch }, null, 2),
      '```',
      '',
      'اكتب:',
      '1) أهم المشاكل داخل هذه الدفعة.',
      '2) قواعد مقترحة (regex/شروط).',
      '3) 3-6 حالات اختبار (input -> expected type).',
    ].join('\n');

  const canPush = (batch) => {
    // placeholder bi/total طولهم شبه ثابت
    const promptText = buildPromptText(batch, 1, 1);
    const tokens = estimateTokensFromChars(promptText, charsPerToken);
    return tokens <= promptBudgetTokens;
  };

  for (const p of patternsSummary) {
    const nextBatch = [...current, p];

    if (maxPatternsPerBatch && current.length >= maxPatternsPerBatch) {
      batches.push(current);
      current = [p];
      continue;
    }

    if (current.length > 0 && !canPush(nextBatch)) {
      batches.push(current);
      current = [p];
      continue;
    }

    current = nextBatch;
  }

  if (current.length) batches.push(current);
  return batches;
};

const main = async () => {
  const args = parseArgs(process.argv);

  const task = String(args.task || 'patterns').toLowerCase();
  const doPatterns = task === 'patterns' || task === 'both' || task === 'all';
  const doAI = task === 'ai' || task === 'both' || task === 'all';

  if (args.help) {
    console.log(`\nUsage:\n  node tools\\analyze-screenplays.cjs --root "${DEFAULT_ROOT}"\n\nOptions:\n  --task <patterns|ai|both>\n  --root <path>\n  --out <path>\n  --aiOut <path>\n  --ext <.txt,.docx,.doc>\n  --maxFiles <n>\n  --maxLinesPerFile <n>\n  --maxExamplesPerPattern <n>\n  --aiExamplesPerPattern <n>\n  --aiBatchPatterns <n>\n  --aiContextTokens <n>\n  --aiReserveTokens <n>\n  --aiCharsPerToken <n>\n  --aiMistakesMaxChars <n>\n  --includeFileList\n  --ai (alias لـ --task both)\n  --model <ollama-model-name>\n  --mistakes <path-to-text>\n`);
    process.exit(0);
  }

  const root = args.root;
  const files = walkFiles(root, args.fileExts, args.maxFiles);

  const patterns = {
    sceneHeader: {
      title: 'عناوين مشاهد (مشهد/داخل-خارج/ليل-نهار) بصيغ غير قياسية',
      count: 0,
      examples: [],
      fix: 'تقوية Regex لعناوين المشاهد: دعم ^مشهد\s*\d+ ودمج ليل/نهار مع داخلي/خارجي، ودعم (مشهد 2 \\ 3).',
    },
    cutLine: {
      title: 'سطر انتقال (قطع) كسطر منفصل',
      count: 0,
      examples: [],
      fix: 'اعتبار (قطع/كات/CUT TO) = transition دائمًا.',
    },
    characterColon: {
      title: 'حوار بصيغة اسم: (مع مسافات/رموز قبل الاسم)',
      count: 0,
      examples: [],
      fix: 'تطبيع bullets والمسافات حول النقطتين قبل فحص CHARACTER_RE.',
    },
    characterWithParenInline: {
      title: 'اسم: (تعليمات أداء) في نفس السطر',
      count: 0,
      examples: [],
      fix: 'Split إلى character ثم parenthetical ثم dialogue (إن وجد).',
    },
    parentheticalStandalone: {
      title: 'تعليمات أداء كسطر مستقل بين قوسين',
      count: 0,
      examples: [],
      fix: 'إذا السطر يبدأ وينتهي بـ() وسبقته شخصية/حوار → parenthetical.',
    },
    dashAction: {
      title: 'وصف/حركة يبدأ بشرطة - (كثير في بعض الملفات)',
      count: 0,
      examples: [],
      fix: 'تعزيز action عندما يبدأ السطر بـ- ويحتوي أفعال/كاميرا (نرى/يكتب/يدخل/يخرج...).',
    },
    bulletDialogue: {
      title: 'حوار يبدأ برمز •',
      count: 0,
      examples: [],
      fix: 'إزالة • من بداية السطر قبل التحليل + قبول • اسم :',
    },
    shortDialogueCandidate: {
      title: 'أسطر قصيرة جدًا (الو/مين/فين/ايه؟...) قد تُصنَّف خطأ',
      count: 0,
      examples: [],
      fix: 'رفع احتمال الحوار للأسطر القصيرة التي تحمل ?/؟ أو كلمات محادثة قصيرة.',
    },
    narrativeQuotes: {
      title: 'اقتباسات داخل نص سردي ("...")',
      count: 0,
      examples: [],
      fix: 'عند تفعيل وضع السرد: تجاهل الاقتباسات وعدم تحويلها لحوار/شخصية.',
    },
    characterNoColonCandidate: {
      title: 'مرشحات: (شخصية + حوار) بدون نقطتين',
      count: 0,
      examples: [],
      fix: 'تفعيل parseInlineCharacterDialogueWithoutColon فقط عند وجود إشارات حوار قوية وتجنب أنماط الأكشن.',
    },
  };

  const globalStats = {
    filesScanned: 0,
    filesReadable: 0,
    linesProcessed: 0,
    narrativeFiles: 0,
    totalBytes: 0,
  };

  const fileList = [];

  const conversationalShortWords = new Set([
    'الو',
    'ألو',
    'الو؟',
    'ألو؟',
    'مين',
    'مين؟',
    'فين',
    'فين؟',
    'ليه',
    'ليه؟',
    'ايه',
    'إيه',
    'ايه؟',
    'إيه؟',
    'ها',
    'ها؟',
    'طيب',
  ]);

  const arabicWord = '[\\u0600-\\u06FF]+';

  const characterColonRe = new RegExp(`^(${arabicWord}(?:\\s+${arabicWord}){0,3})\\s*:\\s*(.*)$`, 'u');
  const sceneHeaderRe = /^مشهد\s*\d+(?:\s*[\\/\\\\]\s*\d+)*\b/u;
  const cutRe = /^قطع\s*$/u;
  const dashRe = /^\s*[-–—]+\s*/u;
  const bulletRe = /^\s*•\s*/u;
  const parentheticalStandaloneRe = /^\(.*\)$/u;
  const hasTimePlaceRe = /\b(?:ليل|نهار)\b.*\b(?:داخلي|داخلى|خارجي|خارجى)\b|\b(?:داخلي|داخلى|خارجي|خارجى)\b.*\b(?:ليل|نهار)\b/u;

  const hasStrongDialogueSignal = (s) => {
    if (/[؟?]/.test(s)) return true;
    if (/\bيا\s+[\u0600-\u06FF]+/u.test(s)) return true;
    if (/["«»]/.test(s)) return true;
    return false;
  };

  const isActionish = (s) => {
    // Very conservative: look for frequent action verbs/markers
    return /\b(?:نرى|يرى|تبدأ|يبدأ|يدخل|يخرج|يستيقظ|يجلس|يقف|يمسك|يتجه|تتحرك|يكتب\s+على\s+الشاشة|يظهر|تظهر)\b/u.test(s);
  };

  for (const fp of files) {
    globalStats.filesScanned++;

    let st;
    try {
      st = fs.statSync(fp);
      globalStats.totalBytes += st.size;
    } catch {
      // ignore
    }

    const content = await safeReadDocumentText(fp);
    if (!content) continue;

    globalStats.filesReadable++;
    if (args.includeFileList) fileList.push(fp);

    const lines = content.split(/\r?\n/);
    const limitedLines = lines.slice(0, args.maxLinesPerFile);

    const isNarrative = isProbablyNarrativeText(limitedLines);
    if (isNarrative) globalStats.narrativeFiles++;

    for (let i = 0; i < limitedLines.length; i++) {
      const raw = limitedLines[i];
      const cleaned = normalizeSpaces(raw);
      if (!cleaned) continue;

      globalStats.linesProcessed++;

      const withBulletsStripped = stripLeadingBullets(cleaned);
      const normalized = normalizeSpaces(withBulletsStripped);

      const meta = {
        file: fp,
        lineNumber: i + 1,
      };

      // Pattern: scene header
      if (sceneHeaderRe.test(normalized) || hasTimePlaceRe.test(normalized) || /\b(?:INT\.|EXT\.|INT\/EXT)\b/i.test(normalized)) {
        patterns.sceneHeader.count++;
        addExample(patterns.sceneHeader, cleaned, meta, args.maxExamplesPerPattern);
      }

      // Pattern: cut
      if (cutRe.test(normalized)) {
        patterns.cutLine.count++;
        addExample(patterns.cutLine, cleaned, meta, args.maxExamplesPerPattern);
      }

      // Pattern: dash action
      if (dashRe.test(cleaned)) {
        patterns.dashAction.count++;
        addExample(patterns.dashAction, cleaned, meta, args.maxExamplesPerPattern);
      }

      // Pattern: bullet dialogue
      if (bulletRe.test(cleaned)) {
        patterns.bulletDialogue.count++;
        addExample(patterns.bulletDialogue, cleaned, meta, args.maxExamplesPerPattern);
      }

      // Pattern: parenthetical standalone
      if (parentheticalStandaloneRe.test(normalized)) {
        patterns.parentheticalStandalone.count++;
        addExample(patterns.parentheticalStandalone, cleaned, meta, args.maxExamplesPerPattern);
      }

      // Pattern: character:
      const m = normalized.match(characterColonRe);
      if (m) {
        patterns.characterColon.count++;
        addExample(patterns.characterColon, cleaned, meta, args.maxExamplesPerPattern);

        const afterColon = (m[2] || '').trim();
        if (/^\(.*\)/u.test(afterColon)) {
          patterns.characterWithParenInline.count++;
          addExample(patterns.characterWithParenInline, cleaned, meta, args.maxExamplesPerPattern);
        }
      }

      // Pattern: very short dialogue candidates
      if (normalized.length <= 14) {
        if (/[؟?]/.test(normalized) || conversationalShortWords.has(normalized)) {
          patterns.shortDialogueCandidate.count++;
          addExample(patterns.shortDialogueCandidate, cleaned, meta, args.maxExamplesPerPattern);
        }
      }

      // Pattern: narrative quotes
      if (isNarrative && /".+?"/.test(cleaned)) {
        patterns.narrativeQuotes.count++;
        addExample(patterns.narrativeQuotes, cleaned, meta, args.maxExamplesPerPattern);
      }

      // Pattern: character+dialogue without colon (candidate)
      // 1-3 Arabic words + space + rest
      const noColonMatch = normalized.match(new RegExp(`^(${arabicWord}(?:\\s+${arabicWord}){0,2})\\s+(.+)$`, 'u'));
      if (noColonMatch && !/[:：]/.test(normalized)) {
        const name = (noColonMatch[1] || '').trim();
        const rest = (noColonMatch[2] || '').trim();

        // Conservative: rest must have strong dialogue signals; avoid action-ish starts
        if (name.length >= 2 && rest.length >= 2 && hasStrongDialogueSignal(rest) && !isActionish(normalized)) {
          patterns.characterNoColonCandidate.count++;
          addExample(patterns.characterNoColonCandidate, cleaned, meta, args.maxExamplesPerPattern);
        }
      }
    }
  }

  const byCount = Object.entries(patterns)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const report = [];

  report.push('# تقرير أنماط مشاكل التصنيف (تحليل ملفات السيناريو)');
  report.push('');
  report.push(`- **الوقت**: ${now.toISOString()}`);
  report.push(`- **الجذر**: \`${root}\``);
  report.push(`- **الامتدادات**: \`${(args.fileExts || []).join(', ')}\``);
  report.push(`- **عدد الملفات (ممسوحة/مقروءة)**: ${globalStats.filesScanned} / ${globalStats.filesReadable}`);
  report.push(`- **عدد الأسطر المعالجة**: ${globalStats.linesProcessed}`);
  report.push(`- **ملفات مرجّح أنها "نص سردي"**: ${globalStats.narrativeFiles}`);
  report.push('');

  report.push('## الملخص (حسب التكرار)');
  report.push('');
  report.push('| النمط | العدد |');
  report.push('|---|---:|');
  for (const item of byCount) {
    report.push(`| ${item.title} | ${item.count} |`);
  }
  report.push('');

  if (args.includeFileList) {
    report.push('## قائمة الملفات (مقروءة)');
    report.push('');
    for (const fp of fileList) {
      report.push(`- \`${fp}\``);
    }
    report.push('');
  }

  report.push('## التفاصيل + أمثلة + حلول مقترحة');
  report.push('');

  for (const item of byCount) {
    report.push(`### ${item.title}`);
    report.push('');
    report.push(`- **العدد**: ${item.count}`);
    report.push(`- **الحل المقترح**: ${item.fix}`);

    if (item.examples.length) {
      report.push('');
      report.push('- **أمثلة**:');
      for (const ex of item.examples) {
        report.push(
          `  - \`${ex.file}:${ex.lineNumber}\` — \`${normalizeSpaces(ex.text)}\``,
        );
      }
    }

    report.push('');
  }

  // Clean up: remove accidental duplicate example sections if any (very defensive)
  const finalReport = report
    .filter((line) => typeof line === 'string')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  if (doPatterns) {
    try {
      ensureDirForFile(args.out);
      fs.writeFileSync(args.out, finalReport, 'utf8');
      console.log(`✅ تم إنشاء التقرير: ${args.out}`);
    } catch (e) {
      console.log('⚠️ تعذّر حفظ التقرير في ملف. سأطبع الملخص هنا:');
      console.log(finalReport);
    }
  }

  if (doAI) {
    const mistakesText = args.mistakesFile
      ? safeReadText(args.mistakesFile) || ''
      : '';

    const patternsSummary = byCount.map((p) => ({
      title: p.title,
      count: p.count,
      fixHint: p.fix,
      examples: p.examples
        .slice(0, args.aiExamplesPerPattern)
        .map((ex) => ({
          file: ex.file,
          lineNumber: ex.lineNumber,
          text: ex.text,
        })),
    }));

    const basePrompt = [
      'أنت خبير تنسيق/تصنيف سيناريو (Screenplay Parsing).',
      'المطلوب: اقتراح قواعد/هيوريستكس عملية لتقليل أخطاء تصنيف السطور إلى (action/character/dialogue/parenthetical/scene-header/transition).',
      '',
      'قيود مهمة:',
      '- لا تقترح حلول عامة؛ قدّم قواعد قابلة للتنفيذ في TypeScript (regex + شروط واضحة).',
      '- كن محافظًا: قلّل الإيجابيات الكاذبة خصوصًا تحويل الأكشن إلى حوار.',
      '- أعطِ أمثلة مضادة (counter-examples) لو القاعدة قد تكسر حالات شائعة.',
      '- الناتج النهائي يكون Markdown منظّم.',
      '',
      `الجذر: ${args.root}`,
      `إحصائيات: filesReadable=${globalStats.filesReadable}, linesProcessed=${globalStats.linesProcessed}, narrativeFiles=${globalStats.narrativeFiles}`,
      '',
    ];

    const modelMaxContextTokens = getModelMaxContextTokens(args.model);
    const effectiveContextTokens = Math.min(
      Number(args.aiContextTokens) || 8192,
      modelMaxContextTokens || Number(args.aiContextTokens) || 8192,
    );

    const promptBudgetTokens = Math.max(
      512,
      effectiveContextTokens - (Number(args.aiReserveTokens) || 2048),
    );

    const mistakesBudgetChars = Math.max(
      0,
      Math.floor((promptBudgetTokens * (Number(args.aiCharsPerToken) || 4)) / 3),
    );

    const mistakesMaxChars = Math.min(
      Number(args.aiMistakesMaxChars) || 6000,
      mistakesBudgetChars,
    );

    if (mistakesText) {
      basePrompt.push('ملف أخطاء/تصنيفات غلط (مختصر):');
      basePrompt.push('```');
      basePrompt.push(truncateText(mistakesText, mistakesMaxChars));
      basePrompt.push('```');
      basePrompt.push('');
    }

    const batches = chunkPatternsByPromptBudget({
      patternsSummary,
      basePrompt,
      charsPerToken: args.aiCharsPerToken,
      promptBudgetTokens,
      maxPatternsPerBatch: args.aiBatchPatterns,
    });
    const batchOutputs = [];

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];

      const prompt = [
        ...basePrompt,
        `دفعة ${bi + 1} من ${batches.length}:`,
        '```json',
        JSON.stringify({ patterns: batch }, null, 2),
        '```',
        '',
        'اكتب:',
        '1) أهم المشاكل داخل هذه الدفعة.',
        '2) قواعد مقترحة (regex/شروط).',
        '3) 3-6 حالات اختبار (input -> expected type).',
      ].join('\n');

      try {
        const out = await callOllama({
          model: args.model,
          prompt,
          contextTokens: effectiveContextTokens,
        });
        batchOutputs.push({ batchIndex: bi + 1, text: out });
      } catch (e) {
        console.log(`⚠️ فشل الذكاء الاصطناعي في دفعة ${bi + 1}: ${String(e?.message || e)}`);
        batchOutputs.push({ batchIndex: bi + 1, text: `فشل: ${String(e?.message || e)}` });
      }
    }

    const aiReport = [
      '# توصيات الذكاء الاصطناعي لتحسين تصنيف السيناريو',
      '',
      `- **الوقت**: ${new Date().toISOString()}`,
      `- **الجذر**: \`${args.root}\``,
      `- **النموذج**: \`${args.model}\``,
      `- **السياق (فعلي/أقصى للموديل)**: ${effectiveContextTokens} / ${modelMaxContextTokens || 'غير معروف'}`,
      `- **ميزانية البرومبت التقريبية**: ${promptBudgetTokens} توكن (reserve=${args.aiReserveTokens})`,
      `- **عدد الدُفعات**: ${batches.length} (maxBatchPatterns=${args.aiBatchPatterns})`,
      '',
      ...batchOutputs.flatMap((b) => [
        `## مخرجات الدفعة ${b.batchIndex}`,
        '',
        b.text.trim(),
        '',
      ]),
      '',
      '---',
      'ملاحظة: تم إرسال ملخص وأمثلة محدودة فقط للنموذج (وليس كل الملفات).',
    ].join('\n');

    try {
      ensureDirForFile(args.aiOut);
      fs.writeFileSync(args.aiOut, aiReport, 'utf8');
      console.log(`✅ تم إنشاء تقرير الذكاء الاصطناعي: ${args.aiOut}`);
    } catch (e) {
      console.log('⚠️ تعذّر حفظ تقرير الذكاء الاصطناعي في ملف.');
    }
  }
};

main().catch((e) => {
  console.log(`❌ خطأ غير متوقع: ${String(e?.message || e)}`);
  process.exitCode = 1;
});
