// Compile authored bilingual lesson material into the existing course data format.
// This is deterministic and preserves the original food unit, Lab, check, and item IDs.
import fs from 'node:fs';
const topics = JSON.parse(fs.readFileSync('astra-lessons/authoring/foundation.json', 'utf8'));
const bands = ['little', 'junior', 'teen'];
const titles = [
  ['Words in context', '情境詞彙', 'words', '🏷️'],
  ['Useful patterns', '實用句型', 'phrases', '🧩'],
  ['Clear sounds', '清楚發音', 'pronunciation', '🗣️'],
  ['Listen for details', '聆聽細節', 'listening', '👂'],
  ['Read & build sentences', '閱讀與組句', 'speaking', '📖'],
  ['Use it in conversation', '實用對話', 'conversation', '💬'],
  ['Review & apply', '複習與運用', 'review', '⭐'],
];
const cnFile = 'astra-lessons/i18n/zh-Hant.json';
const cn = JSON.parse(fs.readFileSync(cnFile, 'utf8'));
const strip = (s) => s.replaceAll('/', '');
const clean = (s) => s.replace(/[\s\p{P}]/gu, '').toLowerCase();
const row = (r) => {
  const [en, hans, hant, py, picture] = r.split('|');
  if (!en || !hans || !hant || !py) throw Error('Incomplete bilingual row: ' + r);
  if ([...strip(hans)].filter(c => /\p{Script=Han}/u.test(c)).length !== py.split(/\s+/).length) throw Error('Pinyin count: ' + en);
  if ([...strip(hant)].filter(c => /\p{Script=Han}/u.test(c)).length !== py.split(/\s+/).length) throw Error('Traditional count: ' + en);
  return { en, hans, hant, py, picture };
};
for (const lang of ['en', 'zh']) {
  const file = 'content/courses/' + lang + '.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const original = data.units[0];
  if (!original.id.endsWith('food')) throw Error('Expected the existing food unit first');
  const originalUnits = new Map(data.units.map(u => [u.id, u]));
  // Keep old content intact. Reusing an existing ID never rewrites the learner's item.
  const add = (r) => {
    const id = lang === 'en' ? 'it-' + r.en.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
      : 'zh-' + r.py.trim().split(/\s+/).join('-') + (/[。！？]$/.test(r.hans) ? '-s' : '');
    const text = lang === 'en' ? r.en : strip(r.hans);
    if (data.items[id]) {
      if (clean(data.items[id].text) !== clean(text)) throw Error('Item collision: ' + id + ': ' + text);
      return id;
    }
    data.items[id] = lang === 'en' ? {
      text, ...(r.picture ? { picture: r.picture } : {}),
      translations: { yue: strip(r.hant), zh: strip(r.hans) }
    } : {
      text, lang: 'zh-CN', zh: { hant: strip(r.hant), py: r.py }, meaning: r.en,
      ...(r.picture ? { picture: r.picture } : {}),
      focus: [...new Set(r.py.split(/\s+/).map(p => 'zh:t' + p.slice(-1)).filter(p => p !== 'zh:t5'))].slice(0, 2)
    };
    return id;
  };
  let previous = [];
  const units = topics.map((topic, topicIndex) => {
    const id = (lang === 'zh' ? 'zh-' : '') + topic.id;
    const words = topic.words.map(row), wordIds = words.map(add);
    const tutors = topic.tutors.map(row).map(add);
    const exerciseLists = {};
    const say = (item, prompt = 'text') => ({ type: 'speak', item, prompt });
    const listen = (answer, others) => ({ type: 'choose-heard', answer, others: [...new Set(others)].filter(x => x !== answer) });
    const arrange = (r, item) => lang === 'en' ? { type: 'arrange', item, chunks: r.en.split(/\s+/) } : {
      type: 'arrange', item,
      chunks: r.hans.split('/').map(s => s.replace(/\p{P}/gu, '')).filter(Boolean),
      chunksHant: r.hant.split('/').map(s => s.replace(/\p{P}/gu, '')).filter(Boolean)
    };
    for (const band of bands) {
      const sentences = topic[band].map(row), ids = sentences.map(add);
      const passage = add({
        en: sentences[0].en + ' ' + sentences[1].en,
        hans: strip(sentences[0].hans) + strip(sentences[1].hans),
        hant: strip(sentences[0].hant) + strip(sentences[1].hant),
        py: sentences[0].py + ' ' + sentences[1].py
      });
      const reading = (n) => ({
        type: 'read-choice', passage,
        question: topic.questions[n][0], questionHant: topic.questions[n][1],
        answer: wordIds[n], others: wordIds.filter((_, i) => i !== n).slice(0, band === 'little' ? 1 : 2),
        explanation: 'The evidence is in sentence ' + (n + 1) + ': ' + sentences[n].en,
        explanationHant: '答案在第' + (n === 0 ? '一' : '二') + '句：' + (lang === 'en' ? sentences[n].en : strip(sentences[n].hant))
      });
      exerciseLists[band] = [
        [...wordIds.map(x => say(x)), listen(wordIds[0], [wordIds[1], wordIds[2]])],
        [...ids.map(x => say(x)), arrange(sentences[0], ids[0])],
        [listen(wordIds[0], [wordIds[1]]), say(wordIds[0]), listen(wordIds[2], [wordIds[3]]), say(wordIds[2]), say(ids[0])],
        [listen(wordIds[1], [wordIds[0], wordIds[2]]), listen(wordIds[3], [wordIds[4], wordIds[0]]), listen(ids[0], [ids[1], ids[2]]), listen(ids[2], [ids[0], ids[3]]), say(ids[3])],
        [reading(0), reading(1), arrange(sentences[1], ids[1]), arrange(sentences[2], ids[2]), say(ids[2])],
        tutors.map((tutor, i) => ({ type: 'dialogue', tutor, replies: [ids[i]], picture: topic.icon })),
        [say(ids[0]), say(ids[1]), say(wordIds[4]), say(previous[0] ?? wordIds[5]), reading(1), arrange(sentences[3], ids[3])]
      ];
    }
    previous = wordIds;
    const grammar = topic.grammar[lang], sound = topic.sound[lang];
    const unit = {
      id, title: topic.title, subtitle: topic.goal[0], icon: topic.icon,
      color: originalUnits.get(id)?.color ?? ['var(--sky)', 'var(--leaf)', 'var(--sun)', 'var(--coral)'][topicIndex % 4],
      grownUp: { title: topic.title, subtitle: topic.goal[0] },
      lessons: titles.map(([title, titleHant, kind, icon], i) => {
        const lessonId = id + '-' + (i + 1);
        cn['lesson.' + lessonId + '.title'] = titleHant;
        return {
          id: lessonId, title, kind, icon,
          guide: {
            goal: topic.goal[0] + ' ' + [
              'Learn the key words by listening and saying them.',
              'Use a sentence pattern and put its parts in order.',
              'Hear the differences and practise speaking clearly.',
              'Listen without reading the answer first.',
              'Find details in a short passage and build meaningful sentences.',
              'Respond aloud to three conversation prompts.',
              'Recall this topic and earlier words; check reading and sentence order.'
            ][i],
            goalHant: topic.goal[1] + [
              '聆聽並說出關鍵詞。',
              '練習句型，按順序組成句子。',
              '聽出差別，練習清楚發音。',
              '先聆聽，再選答案。',
              '從短文找出細節，組成有意思的句子。',
              '大聲回應三個對話提示。',
              '溫習本單元和之前的詞語，再檢查理解及句子順序。'
            ][i],
            tip: (i === 2 ? sound : grammar)[0], tipHant: (i === 2 ? sound : grammar)[1],
            practice: topic.practice[0], practiceHant: topic.practice[1]
          },
          exercises: Object.fromEntries(bands.map(b => [b, exerciseLists[b][i]]))
        };
      })
    };
    cn['unit.' + id + '.title'] = topic.hant;
    cn['unit.' + id + '.title.adult'] = topic.hant;
    cn['unit.' + id + '.subtitle'] = topic.goal[1];
    cn['unit.' + id + '.subtitle.adult'] = topic.goal[1];
    return unit;
  });
  data.units = [original, ...units];
  fs.writeFileSync('astra-lessons/courses/' + lang + '.json', JSON.stringify(data, null, 2) + '\n');
  console.log(lang + ': ' + data.units.length + ' units, ' + data.units.flatMap(u => u.lessons).length + ' lessons, ' + Object.keys(data.items).length + ' items');
}
fs.writeFileSync(cnFile, JSON.stringify(cn, null, 2) + '\n');
