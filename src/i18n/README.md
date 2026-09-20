# App language — how the wording is organised

The family chooses the **App language** (Settings, and the first screen): English or 繁體中文 (Hong Kong). It changes the
app's own wording — instructions, feedback, buttons, the grown-up screens. It never changes what is being learned: the
words to say, the teacher's voice, pinyin, example words inside tips ("think", "媽") stay as they are.

## Files

- `en/<area>.json` — the English source, flat `"area.thing": "text"`. Typed: `t('settings.title')` with a wrong key
  does not compile.
- `zh-Hant/<area>.json` — the translation, same keys. A missing key shows the English line.
- `zh-Hant/content.json` — translations of wording that lives with its data (a sound's name and tips, a lesson's
  title). The English stays in the data; the key is built from the data's id: `tc('sound.θ.name', info.name)`.
- `index.ts` — `t`, `tn` (counts), `tc` (content). `useT.tsx` — `useT()` for components, `rich()` for **bold**.

Areas: `common` (navigation, buttons shared by several screens), `onboarding` (setup, and the course check), `settings` (Parent Zone / Settings &
privacy, the grown-ups' gate, consent, sharing recordings, connections), `speak` (the speaking screen, word help sheet,
microphone, error panel), `feedback` (corrections and headlines from `src/tutor/feedback.ts`), `home` (Home, My book, the
camera, reading messages), `lesson` (lesson player, choice exercises), `lab`, `practice`
(conversations), `progress` (progress screen, badges).

## Rules for moving a screen

1. Every component that shows wording calls `const { t, tn, tc } = useT();` (from `../../i18n/useT`) — that is what
   re-renders it when the language changes. Helpers outside React import `t`/`tn`/`tc` from `../../i18n`.
2. **No wording in module-level constants.** A constant evaluated once keeps the language it was loaded in. Keep KEYS in
   constants and call `t()` when rendering: `const LABEL: Record<Band, Key> = { teen: 'settings.band.teen' }` → `t(LABEL[b])`.
3. Values go in with `{braces}`: `"home.next": "Next: {title}"` → `t('home.next', { title })`. Never build a sentence by
   gluing translated pieces together — word order differs in Chinese. One sentence, one key.
4. Counts: `"x.one"` / `"x.other"` with `{n}` → `tn('x', n)`. Chinese only needs `.other`.
5. Kid / grown-up variants are two keys chosen in code: `t(kid ? 'home.book.start.kid' : 'home.book.start.adult')`.
6. Bold inside a sentence: write `**like this**` in the text and render with `rich(t(...))`. No other markup in texts.
7. Keys say where and what, not the English words: `settings.recordings.delete`, not `settings.deleteRecordingsButton`.
   Reuse a `common.*` key only when it is truly the same thing (Close, Back, Continue, Try again).
8. Emoji that are decoration stay in the code, not in the texts. `aria-label`s are wording too.
9. Don't touch logic, styling or tests' meaning. After moving a file: `npx tsc --noEmit -p .` and `npx vitest run`.

## 繁體中文 — style

Written Chinese as used in Hong Kong (書面語, not colloquial Cantonese), Traditional characters, Hong Kong vocabulary.
Warm and simple for children (你, short sentences, no 您); clear and plain for the grown-up screens. Full-width
punctuation ，。！？：；（）「」. **No long dash (——)**: in the app's headline font it shows as two strokes and reads as 一一
— use a comma, or a colon before a quotation or an example; a long-held sound is 「嗶～～」. Keep product names in Latin letters: Wunder Tutor, Pip. Keep `{placeholders}` exactly as they are. Don't translate the
example words being practised.

| English | 繁體中文 (HK) |
| --- | --- |
| Parent Zone | 家長專區 |
| Settings & privacy | 設定與私隱 |
| Grown-up / Grown-ups only | 成人 / 只限家長 |
| Learner / Add learner | 學習者 / 新增學習者 |
| Course / Unit / Lesson | 課程 / 單元 / 課 |
| My book | 我的書 |
| Pronunciation / pronunciation scoring | 發音 / 發音評分 |
| Sound (a phoneme) / Tone | 音 / 聲調 (第一聲…第四聲, 輕聲) |
| Pronunciation Lab / Lab | 發音練習室 / 練習室 |
| English / Putonghua / Cantonese | 英文 / 普通話 / 廣東話 |
| American / British accent | 美式 / 英式口音 |
| Traditional / Simplified characters | 繁體字 / 簡體字 |
| Home language / App language | 母語 / 介面語言 |
| Listen / Slow / Tap to speak | 聽一聽 / 慢速 / 按一下開始說 |
| Try again / Continue / Next / Done / Skip for now | 再試一次 / 繼續 / 下一個 / 完成 / 暫時跳過 |
| Teacher (the model voice) / Me (my recording) | 老師 / 我 |
| Score / Streak / Today's goal | 分數 / 連續日數 / 今日目標 |
| Recording(s) / Delete | 錄音 / 刪除 |
| Privacy / Consent / I agree | 私隱 / 同意 / 我同意 |
| Beta access / Access code | 測試版存取 / 存取碼 |
| Practice mode — scores are simulated | 練習模式——分數為模擬 |
| Camera / Photos / Take a photo / Torch / Lens | 相機 / 相片 / 拍照 / 電筒 / 鏡頭 |
| Conversation / Talk with Pip | 對話 / 和 Pip 聊天 |
| Email / Sign in / Settings | 電郵 / 登入 / 設定 |
| Connections / Working / Key refused / Not set up | 連線狀態 / 正常 / 金鑰被拒 / 未設定 |
| Microphone / speaker | 麥克風 / 喇叭 |
