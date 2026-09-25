// Supplemental translations for the unified paths, derived from existing bilingual authoring.
import fs from 'node:fs';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const source = read('astra-lessons/authoring/curriculum-translations.json');
const catalogs = Object.fromEntries(source.locales.map(locale => [locale, { content: {}, lessons: {}, meanings: {} }]));
for (const [key, row] of Object.entries(source.labels)) source.locales.forEach((locale, i) => {
  if (!row[i]) throw Error('Missing ' + locale + ': ' + key);
  catalogs[locale].content[key] = row[i];
});
for (const row of source.meanings) source.locales.forEach((locale, i) => {
  if (!row[i]) throw Error('Missing ' + locale + ': ' + row[0]);
  catalogs[locale].meanings[row[0]] = row[i];
});
// The paired Putonghua source already supplies faithful Chinese meanings for English course items.
for (const file of ['astra-lessons/courses/zh.json', 'astra-lessons/courses/zh-communication.json']) {
  for (const item of Object.values(read(file).items)) if (item.meaning) {
    catalogs['zh-Hant'].meanings[item.meaning] ??= item.zh?.hant ?? item.text;
    catalogs['zh-Hans'].meanings[item.meaning] ??= item.text;
  }
}
const foundation = read('astra-lessons/authoring/foundation.json');
for (const topic of foundation) for (const key of ['words', 'little', 'junior', 'teen', 'tutors']) {
  for (const line of topic[key]) {
    const [en, hans, hant] = line.split('|');
    catalogs['zh-Hant'].meanings[en] ??= hant.replaceAll('/', '');
    catalogs['zh-Hans'].meanings[en] ??= hans.replaceAll('/', '');
  }
}
fs.writeFileSync('astra-lessons/i18n/curriculum.json', JSON.stringify(catalogs, null, 2) + '\n');
console.log('Built seven curriculum catalogs.');
