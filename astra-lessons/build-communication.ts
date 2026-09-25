// Original lesson sources live beside this compiler; generated JSON uses the app's existing schema.
// Run: npx vite-node astra-lessons/build-communication.ts
import fs from 'node:fs';
import * as OpenCC from 'opencc-js';
import { parseJa } from '../src/content/ja/kana';
import { romanize, blockCount } from '../src/content/ko/hangul';
import { buildCourse, type CourseFile, type ItemData, type ExerciseData } from '../src/content/load';

const root = 'astra-lessons/authoring/communication';
const languages = ['en', 'zh', 'ja', 'ko', 'fr', 'es'] as const;
const bands = ['little', 'junior', 'teen'] as const;
const code = { little: 'l', junior: 'j', teen: 't' };
const toHant = OpenCC.Converter({ from: 'cn', to: 'hk' });
const toHans = OpenCC.Converter({ from: 'hk', to: 'cn' });
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p: string, data: unknown) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
const sources = Object.fromEntries(languages.map(l => [l, read(root + '/' + l + '.json')]));
const instructions = read(root + '/instructions.json') as Record<string, Record<string, string>>;
for (const value of Object.values(instructions)) value['zh-Hans'] = toHans(value['zh-Hant']);
const locales = ['en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'fr', 'es'];
const catalogs = Object.fromEntries(locales.map(l => [l, { content: {} as Record<string, string>, lessons: {} as Record<string, string>, meanings: {} as Record<string, string> }]));
for (const value of Object.values(instructions)) for (const l of locales) catalogs[l].lessons[value.en] = value[l];
const label = (key: string, l = 'en') => {
  if (!instructions[key]?.[l]) throw Error('Missing instruction ' + key + '/' + l);
  return instructions[key][l];
};
const topics = [
  { key: 'o', id: 'out', icon: '🗺️', words: ['🚉','🚌','🎫','⬅️','➡️','⬆️','🚉','⏰','📅','🎟️','🚆','🏫','⏰','⏰','🌳'] },
  { key: 'p', id: 'people', icon: '👋', words: ['🏷️','🤝','👨‍👩‍👧','🏫','🏙️','🎵','⚽','📚','📅','👋','🎨','💬','🏘️','🌾','🏀','🏊'] },
  { key: 'w', id: 'work', icon: '💼', words: ['🤝','🗓️','💬','☎️','✉️','📆','📅','⏰','🙋','❔','📅','📄','⏰','⏰'] }
];
const allKeys = Object.keys(sources.en);
for (const l of languages) {
  if (JSON.stringify(Object.keys(sources[l]).sort()) !== JSON.stringify([...allKeys].sort())) throw Error('Source keys differ: ' + l);
}
const compact = (s: string) => s.replace(/[\s\p{P}]/gu, '').toLowerCase();
const summary: unknown[] = [];
const markdown: string[] = ['# Communication lessons', '', 'Original beginner to lower-intermediate practice for six languages. These are authored app lessons, not publisher downloads or an accredited qualification.', '', '| Language | Units | Lessons | Age-band versions | Exercise instances |', '|---|---:|---:|---:|---:|'];
for (const lang of languages) {
  const data: CourseFile = { id: lang + '-communication', language: lang, title: 'Communication', exercisePrefix: 'comm' + lang, items: {}, units: [], check: {little: [], junior: [], teen: []}, lab: {ladders: {}} };
  const ids: Record<string, string> = {}, chunks: Record<string, string[]> = {}, chunksHant: Record<string, string[]> = {};
  const textByKey: Record<string, string> = {};
  for (const key of allKeys) {
    const row = sources[lang][key];
    let item: ItemData, id: string;
    const en = sources.en[key].text;
    if (lang === 'zh') {
      const text = row.text.replaceAll('/', '');
      const hant = toHant(text);
      const py = row.py.trim().split(/\s+/);
      const han = (s: string) => [...s].filter(c => /\p{Script=Han}/u.test(c)).length;
      if (han(text) !== py.length || han(hant) !== py.length || py.some(p => !/^[a-züv]+[1-5]$/.test(p))) throw Error('Pinyin mismatch: ' + key + ' ' + text);
      id = 'zh-' + py.join('-') + (/[。！？]$/.test(text) ? '-s' : '');
      item = { text, lang: 'zh-CN', zh: {hant, py: row.py}, meaning: en, kind: key.includes('-w') ? 'word' : 'sentence' };
      chunks[key] = row.text.split('/');
      chunksHant[key] = chunks[key].map(toHant);
    } else if (lang === 'ja') {
      const parsed = parseJa(row.marked);
      const ascii = parsed.ja.romaji.toLowerCase().replace(/ā/g, 'aa').replace(/ū/g, 'uu').replace(/ē/g, 'ee').replace(/ō/g, 'oo');
      id = 'ja-comm-' + ascii.replace(/[^a-z']+/g, '-').replace(/^-|-$/g, '') + (/[。！？]$/.test(parsed.text) ? '-s' : '');
      item = { ...parsed, lang: 'ja-JP', meaning: en, kind: key.includes('-w') ? 'word' : 'sentence' };
      chunks[key] = row.marked.replace(/([。！？])(?=\S)/g, '$1 ').split(/\s+/).map((s: string) => parseJa(s).text);
    } else if (lang === 'ko') {
      const romaja = romanize(row.pron);
      if (blockCount(row.text) !== blockCount(row.pron)) throw Error('Korean block mismatch: ' + key);
      id = 'ko-' + romaja.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
      item = {text: row.text, lang: 'ko-KR', ko: {pron: row.pron, romaja}, meaning: en, kind: key.includes('-w') ? 'word' : 'sentence'};
      chunks[key] = row.text.split(/\s+/);
    } else {
      const text = row.text;
      id = lang === 'en' ? 'it-' + text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
        : lang + '-' + text.toLowerCase().replace(lang === 'es' ? /[^a-zñáéíóúü]+/g : /[^a-zà-ÿœ']+/gu, '-').replace(/^-|-$/g, '');
      item = {text, ...(lang === 'en' ? {} : {lang: (lang === 'fr' ? 'fr-FR' : 'es-ES') as 'fr-FR' | 'es-ES', meaning: en}), kind: key.includes('-w') ? 'word' : 'sentence'};
      chunks[key] = text.split(/\s+/);
    }
    chunks[key] = chunks[key].reduce((parts: string[], part: string) => { if (/^[\p{P}]+$/u.test(part) && parts.length) parts[parts.length - 1] += part; else parts.push(part); return parts; }, []);
    if (key.includes('-w') && /\s/.test(item.text)) item.kind = 'phrase';
    const topic = topics.find(t => key.startsWith(t.key + '-'))!;
    if (/-w\d+$/.test(key)) item.picture = topic.words[Number(key.split('-w')[1])];
    textByKey[key] = item.text;
    if (data.items[id] && compact(data.items[id].text) !== compact(item.text)) throw Error('ID collision: ' + lang + ' ' + id);
    data.items[id] ??= item;
    ids[key] = id;
  }
  // Cross-language meanings are authored alongside the lines, not machine-translated at runtime.
  for (const key of allKeys) {
    const row = sources[lang][key];
    const text = textByKey[key];
    for (const [ui, use] of [[lang, text], ...(lang === 'zh' ? [['zh-Hant', toHant(text)], ['zh-Hans', text]] : [])]) {
      if (catalogs[ui]) catalogs[ui].meanings[sources.en[key].text] = use;
    }
  }
  const speak = (key: string): ExerciseData => ({type: 'speak', item: ids[key]});
  const heard = (key: string, choices: string[]): ExerciseData => {
    const others = [...new Set(choices.map(k => ids[k]))].filter(id => id !== ids[key] && compact(data.items[id].text) !== compact(data.items[ids[key]].text));
    if (!others.length) throw Error('No listening distractor ' + key);
    return {type: 'choose-heard', answer: ids[key], others};
  };
  const arrange = (key: string): ExerciseData => chunks[key].length >= 2 ? {type: 'arrange', item: ids[key], chunks: chunks[key], ...(lang === 'zh' ? {chunksHant: chunksHant[key]} : {})} : speak(key);
  for (const topic of topics) {
    const unitId = (lang === 'en' ? '' : lang + '-') + topic.id;
    const k = topic.key;
    const vocabulary = Array.from({length: topic.words.length}, (_, n) => k + '-w' + n);
    const titles = ['words', topic.id + '.task1', topic.id + '.task2', topic.id + '.task3', 'listen', 'read', 'conversation', 'apply', 'review'];
    const goals = ['words','task','task','task','listen','read','conversation','apply','review'];
    const kinds = ['words','phrases','phrases','phrases','listening','speaking','conversation','speaking','review'] as const;
    const icons = ['🏷️','💬','🎫','🗓️','👂','📖','🗣️','✍️','🏆'];
    const exByBand: Record<string, ExerciseData[][]> = {};
    for (const band of bands) {
      const b = code[band];
      const responses = Array.from({length: 6}, (_, n) => k + '-' + b + n);
      const questions = Array.from({length: 6}, (_, n) => k + '-q' + n);
      const passage = (numbers: number[], suffix: string): string => {
        const source = numbers.map(n => data.items[ids[responses[n]]]);
        const text = source.map(s => s.text).join(lang === 'zh' || lang === 'ja' ? '' : ' ');
        let id = lang + '-comm-' + k + '-' + b + '-' + suffix;
        const item: ItemData = {text, kind: 'sentence', ...(lang !== 'en' ? {lang: source[0].lang, meaning: numbers.map(n => sources.en[responses[n]].text).join(' ')} : {})};
        if (lang === 'zh') { item.zh = {hant: source.map(s => s.zh!.hant).join(''), py: source.map(s => s.zh!.py).join(' ')}; id = 'zh-' + item.zh.py.split(/\s+/).join('-') + (/[。！？]$/.test(text) ? '-s' : ''); }
        if (lang === 'ja') item.ja = {kana: source.map(s => s.ja!.kana).join(''), romaji: source.map(s => s.ja!.romaji).join(' '), ruby: source.flatMap(s => s.ja!.ruby)};
        if (lang === 'ko') { item.ko = {pron: source.map(s => s.ko!.pron).join(' '), romaja: source.map(s => s.ko!.romaja).join(' ')}; id = 'ko-' + item.ko.romaja.replace(/\s+/g, '-'); }
        if (lang === 'es') id = 'es-' + text.toLowerCase().replace(/[^a-zñáéíóúü]+/g, '-').replace(/^-|-$/g, '');
        if (data.items[id] && compact(data.items[id].text) !== compact(text)) throw Error('Passage collision ' + id);
        data.items[id] ??= item;
        if (item.meaning) for (const ui of locales) {
          catalogs[ui].meanings[item.meaning] = ui === 'en' ? item.meaning : numbers.map(n => catalogs[ui].meanings[sources.en[responses[n]].text] ?? sources.en[responses[n]].text).join(['zh-Hant','zh-Hans','ja'].includes(ui) ? '' : ' ');
        }
        return id;
      };
      const reading = (passageId: string, question: string, answer: number, other: number[]): ExerciseData => ({
        type: 'read-choice', passage: passageId, question: label(question), questionHant: label(question, 'zh-Hant'),
        answer: ids[vocabulary[answer]], others: other.map(n => ids[vocabulary[n]]), explanation: label('evidence'), explanationHant: label('evidence','zh-Hant')
      });
      const first = k === 'o' ? reading(passage([0,1], 'a'), 'q.destination', 0, [11,14])
        : k === 'p' ? reading(passage([0,1], 'a'), 'q.home', 4, [12,13])
        : reading(passage([1,3], 'a'), 'q.meeting', 7, [12,13]);
      const second = k === 'o' ? reading(passage([4,5], 'b'), 'q.departure', 7, [12,13])
        : k === 'p' ? reading(passage([2,3], 'b'), 'q.sport', 6, [14,15])
        : reading(passage([2,5], 'b'), 'q.finish', band === 'teen' ? 10 : 5, band === 'teen' ? [5,6] : [6,10]);
      const practical = reading(ids[k + '-r' + b], k === 'o' ? 'q.departure' : k === 'p' ? 'q.sport' : 'q.meeting', k === 'p' ? 6 : 7, k === 'p' ? [14,15] : [12,13]);
      const task = (n: number): ExerciseData[] => [
        ...(band === 'little' ? [] : [speak(questions[n])]),
        speak(responses[n]), speak(responses[n+1]), heard(responses[n], [responses[n+1],responses[(n+2)%6]]),
        arrange(responses[n]), {type: 'dialogue', tutor: ids[questions[n+1]], replies: [ids[responses[n+1]]], picture: topic.icon}
      ];
      exByBand[band] = [
        [...[...vocabulary.slice(0, band === 'little' ? 6 : band === 'junior' ? 9 : 12), ...vocabulary.slice(12)].map(speak), heard(vocabulary[0], vocabulary.slice(1,3)), heard(vocabulary[4], [vocabulary[3],vocabulary[5]])],
        task(0), task(2), task(4),
        [heard(vocabulary[3], [vocabulary[4],vocabulary[5]]), heard(responses[0],[responses[1],responses[2]]), speak(responses[0]), heard(responses[4],[responses[2],responses[5]]), speak(responses[4]), heard(questions[3],[questions[0],questions[4]])],
        [first,second,arrange(responses[1]),arrange(responses[3]),speak(responses[1])],
        questions.map((q,n) => ({type: 'dialogue', tutor: ids[q], replies: [ids[responses[n]]], picture: topic.icon})),
        [practical,arrange(responses[0]),arrange(responses[2]),arrange(responses[4]),speak(responses[5])],
        [speak(responses[0]),speak(responses[2]),heard(responses[4],[responses[3],responses[5]]),first,practical,arrange(responses[4])]
      ];
    }
    const unit = {
      id: unitId, title: label(topic.id + '.title'), subtitle: label(topic.id + '.sub'), icon: topic.icon,
      color: ['var(--sky)','var(--leaf)','var(--sun)'][topics.indexOf(topic)],
      grownUp: {title: label(topic.id === 'work' ? 'work.adult' : topic.id + '.title'), subtitle: label(topic.id === 'work' ? 'work.adultSub' : topic.id + '.sub')},
      lessons: titles.map((title,n) => ({
        id: unitId + '-' + (n+1), title: label(title), kind: kinds[n], icon: icons[n],
        guide: {
          goal: label('goal.' + goals[n]), goalHant: label('goal.' + goals[n], 'zh-Hant'),
          tip: label(topic.id + '.tip'), tipHant: label(topic.id + '.tip','zh-Hant'),
          practice: label(n === 7 ? topic.id + '.practice' : 'practice.' + goals[n]),
          practiceHant: label(n === 7 ? topic.id + '.practice' : 'practice.' + goals[n], 'zh-Hant')
        },
        exercises: Object.fromEntries(bands.map(b => [b, exByBand[b][n]])) as Record<typeof bands[number], ExerciseData[]>
      }))
    };
    data.units.push(unit);
    for (const ui of locales) {
      const c = catalogs[ui].content;
      c['unit.'+unitId+'.title'] = label(topic.id+'.title',ui);
      c['unit.'+unitId+'.subtitle'] = label(topic.id+'.sub',ui);
      c['unit.'+unitId+'.title.adult'] = label(topic.id === 'work' ? 'work.adult' : topic.id+'.title',ui);
      c['unit.'+unitId+'.subtitle.adult'] = label(topic.id === 'work' ? 'work.adultSub' : topic.id+'.sub',ui);
      titles.forEach((title,n) => {c['lesson.'+unitId+'-'+(n+1)+'.title'] = label(title,ui);});
    }
  }
  for (const band of bands) data.check[band] = ['o','p','w'].map(k => ids[k + '-' + code[band] + '0']);
  buildCourse(data, lang + '-communication');
  const file = 'astra-lessons/courses/' + lang + '-communication.json';
  write(file, data);
  const exercises = data.units.flatMap(u => u.lessons).reduce((sum,l) => sum + bands.reduce((n,b) => n + l.exercises[b].length,0),0);
  summary.push({language: lang, file, units: data.units.length, lessons: 27, ageBandVersions: 81, exercises, items: Object.keys(data.items).length});
  markdown.push('| ['+({en:'English',zh:'Putonghua',ja:'Japanese',ko:'Korean',fr:'French',es:'Spanish'}[lang])+'](lessons/communication/'+lang+'.md) | 3 | 27 | 81 | '+exercises+' |');
  console.log(lang + ': 27 lessons, ' + exercises + ' exercise instances');
}
// Build all meaning translations after every language has populated its source rows.
for (const lang of languages) {
  const file = 'astra-lessons/courses/' + lang + '-communication.json';
  const data = read(file);
  for (const item of Object.values(data.items) as ItemData[]) {
    if (item.meaning) {
      const original = allKeys.find(k => sources.en[k].text === item.meaning);
      if (!original) continue;
      item.translations = Object.fromEntries(['en','zh','ja','ko','fr','es'].map(l => [l, l === 'en' ? item.meaning : catalogs[l === 'zh' ? 'zh-Hans' : l].meanings[item.meaning]]));
    }
  }
  write(file, data);
}
write('astra-lessons/i18n/communication.json', catalogs);
write('astra-lessons/communication-manifest.json', {version:1, editorialStatus:'original-authored; independent teacher review pending', topics:topics.map(t=>t.id), courses:summary});
markdown.push('', 'See [the teaching guide](COMMUNICATION-TEACHER-GUIDE.md) for language notes, classroom tasks and review status.\n\nEach unit: useful words; three practical language lessons; listening and pronunciation practice; reading; six-turn guided conversation; reading/sentence-building with an offline writing task; review.', '', 'Little: short, supported replies. Junior: complete everyday sentences. Teen/adult: polite requests and longer practical exchanges. Work is school/teamwork for children.', '', 'Source: authoring/communication/*.json. Rebuild: npx vite-node astra-lessons/build-communication.ts. Answer keys are explicit in the generated course JSON. Handwriting and original writing require human feedback.', '');
fs.writeFileSync('astra-lessons/COMMUNICATION-MAP.md', markdown.join('\n'));

// Readable teacher/learner editions, generated from the same answer keys as the app.
fs.mkdirSync('astra-lessons/lessons/communication', {recursive:true});
const languageNames: Record<string,string> = {en:'English',zh:'Putonghua',ja:'Japanese',ko:'Korean',fr:'French',es:'Spanish'};
for (const lang of languages) {
  const data = read('astra-lessons/courses/' + lang + '-communication.json') as CourseFile;
  const show = (id: string) => {
    const it = data.items[id];
    const parts = [it.text];
    if (it.zh) parts.push('Traditional: ' + it.zh.hant, 'Pinyin: ' + it.zh.py);
    if (it.ja) parts.push('Reading: ' + it.ja.kana, 'Romaji: ' + it.ja.romaji);
    if (it.ko) parts.push('Pronunciation: ' + it.ko.pron, 'Romanisation: ' + it.ko.romaja);
    if (it.meaning) parts.push('Meaning: ' + it.meaning);
    return parts.join(' — ');
  };
  const lines = ['# '+languageNames[lang]+' — Getting Around, People & Small Talk, Work', '',
    '27 lessons; three supported age bands. Adults use the teen material. The work topic becomes school/teamwork for children.', '',
    'Original authored material. Independent language-teacher review is pending. App audio uses the existing voice service; no publisher recordings are included.', '',
    'Each lesson has a goal, guided practice, explicit model answers and an offline application task. Model answers are examples: the app does not grade free writing or every possible conversational reply.', ''];
  for (const unit of data.units) {
    lines.push('## '+unit.title, '', unit.subtitle, '');
    for (const lesson of unit.lessons) {
      const g=lesson.guide!;
      lines.push('### '+lesson.title+' ('+lesson.id+')', '', '**Goal:** '+g.goal, '', '**Teaching note:** '+g.tip, '', '**Offline task:** '+g.practice, '');
      for (const band of bands) {
        lines.push('#### '+(band==='teen' ? 'Teen / adult' : band==='little' ? 'Little (supported practice)' : 'Junior'), '');
        for (const [i,ex] of lesson.exercises[band].entries()) {
          let text: string;
          if (ex.type === 'speak') text='Say: '+show(ex.item);
          else if (ex.type === 'arrange') text='Build the sentence using these chunks (shuffle before practice): '+ex.chunks.join(' / ')+'. **Model:** '+show(ex.item);
          else if (ex.type === 'choose-heard') text='Listen: teacher/app reads "'+data.items[ex.answer].text+'". Choices: '+[ex.answer,...ex.others].map(id=>data.items[id].text).join(' · ')+'. **Answer:** '+show(ex.answer);
          else if (ex.type === 'read-choice') text='Read: '+show(ex.passage)+'\n\n   '+ex.question+' Choices: '+[ex.answer,...ex.others].map(id=>data.items[id].text).join(' · ')+'. **Answer:** '+show(ex.answer)+' '+ex.explanation;
          else if (ex.type === 'dialogue') text='Partner: '+(ex.tutor ? show(ex.tutor) : ex.line)+ '\n\n   **Model reply:** '+ex.replies.map(show).join(' / ');
          else text='Listen and compare: '+ex.pair.map(show).join(' / ')+'. **Answer:** '+show(ex.pair[ex.answer]);
          lines.push((i+1)+'. '+text,'');
        }
      }
    }
  }
  fs.writeFileSync('astra-lessons/lessons/communication/'+lang+'.md', lines.join('\n'));
}
