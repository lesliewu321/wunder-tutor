// npm run i18n:hans — writes the 简体中文 App language (src/i18n/zh-Hans/) from the 繁體中文 one (Leslie, 2026-09-25: "app
// language should include traditional and simplified chinese"). The Traditional text is Hong Kong written Chinese, so
// besides the character conversion (OpenCC, hk → cn) a few Hong Kong words become the mainland ones (設定 → 设置,
// 電郵 → 邮箱 …). Run it again whenever the Traditional wording changes; never edit zh-Hans by hand.
// Needs i18n-source.json for the lesson guides (`npm run i18n:export` first).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as OpenCC from 'opencc-js';

const toCn = OpenCC.Converter({ from: 'hk', to: 'cn' });
/** Hong Kong usage → mainland usage, applied after the character conversion. Longest first. */
const WORDS = [
  ['电邮地址', '邮箱地址'], ['电邮', '邮箱'], ['登出', '退出登录'], ['登入', '登录'], ['应用程式', '应用'], ['程式', '程序'],
  ['设定', '设置'], ['档案', '文件'], ['私隐', '隐私'], ['储存', '保存'], ['帐户', '账户'], ['帐号', '账号'], ['伺服器', '服务器'],
  ['介面', '界面'], ['回馈', '反馈'], ['连结', '链接'], ['甚么', '什么'], ['身分', '身份'], ['载入', '加载'], ['预设', '默认'],
  ['相片', '照片'], ['萤幕', '屏幕'], ['咪高峰', '麦克风'], ['短讯', '短信'], ['讯息', '消息'],
];
const hans = (s) => WORDS.reduce((t, [hk, cn]) => t.split(hk).join(cn), toCn(s));
const convert = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? hans(v) : v]));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const write = (f, obj) => writeFileSync(f, `${JSON.stringify(obj, null, 2)}\n`);

mkdirSync('src/i18n/zh-Hans', { recursive: true });
// The interface, file by file.
for (const f of readdirSync('src/i18n/zh-Hant').filter((f) => f.endsWith('.json') && !f.startsWith('content') && f !== 'meanings.json')) write(`src/i18n/zh-Hans/${f}`, convert(read(`src/i18n/zh-Hant/${f}`)));
// Wording that lives with data: the three Traditional sources in one file.
write('src/i18n/zh-Hans/content.json', convert({ ...read('src/i18n/zh-Hant/content.json'), ...read('src/i18n/zh-Hant/content-course.json'), ...read('astra-lessons/i18n/zh-Hant.json') }));
// Lesson guides and reading questions: keyed by their English, the Traditional comes from the course data.
if (!existsSync('i18n-source.json')) { console.error('i18n-source.json is missing: run `npm run i18n:export` first.'); process.exit(1); }
write('src/i18n/zh-Hans/lessons.json', convert(read('i18n-source.json').lessons));
// What practice items mean.
if (existsSync('src/i18n/zh-Hant/meanings.json')) write('src/i18n/zh-Hans/meanings.json', convert(read('src/i18n/zh-Hant/meanings.json')));
console.log('zh-Hans written from zh-Hant.');
