// Labelled cases for the accuracy gauntlet. Each error case is a REAL word said in place of the target, so the
// synthetic "learner" says it naturally and the truth is known exactly.

/** [target word, word said instead, target sound, sound said instead]. Sounds use the app's phoneme ids. */
export const EN_PAIRS: [string, string, string, string][] = [
  ['three', 'free', 'θ', 'f'], ['thin', 'fin', 'θ', 'f'], ['thirst', 'first', 'θ', 'f'],
  ['think', 'sink', 'θ', 's'], ['thank', 'sank', 'θ', 's'], ['mouth', 'mouse', 'θ', 's'],
  ['three', 'tree', 'θ', 't'], ['thin', 'tin', 'θ', 't'],
  ['they', 'day', 'ð', 'd'], ['then', 'den', 'ð', 'd'], ['those', 'doze', 'ð', 'd'],
  ['very', 'berry', 'v', 'b'], ['vest', 'west', 'v', 'w'], ['vine', 'wine', 'v', 'w'], ['vet', 'wet', 'v', 'w'],
  ['rice', 'lice', 'r', 'l'], ['right', 'light', 'r', 'l'], ['fries', 'flies', 'r', 'l'], ['grass', 'glass', 'r', 'l'],
  ['red', 'wed', 'r', 'w'], ['ring', 'wing', 'r', 'w'],
  ['night', 'light', 'n', 'l'], ['no', 'low', 'n', 'l'], ['snow', 'slow', 'n', 'l'],
  ['ship', 'sheep', 'ɪ', 'i'], ['sit', 'seat', 'ɪ', 'i'], ['live', 'leave', 'ɪ', 'i'],
  ['bad', 'bed', 'æ', 'ɛ'], ['man', 'men', 'æ', 'ɛ'], ['sat', 'set', 'æ', 'ɛ'],
  ['she', 'see', 'ʃ', 's'], ['sheet', 'seat', 'ʃ', 's'],
  ['peas', 'peace', 'z', 's'], ['eyes', 'ice', 'z', 's'], ['prize', 'price', 'z', 's'],
  ['late', 'lay', 't', '∅'], ['made', 'may', 'd', '∅'], ['bike', 'buy', 'k', '∅'],
  ['full', 'fool', 'ʊ', 'u'], ['pull', 'pool', 'ʊ', 'u'],
  ['sing', 'sin', 'ŋ', 'n'], ['jeep', 'cheap', 'dʒ', 'tʃ'],
];

/** [correct sentence, sentence with one word swapped, index of the swapped word, target sound, sound said instead]. */
export const EN_SENTENCES: [string, string, number, string, string][] = [
  ['I think it is right.', 'I sink it is right.', 1, 'θ', 's'],
  ['I think it is right.', 'I think it is light.', 4, 'r', 'l'],
  ['Three red apples, please.', 'Free red apples, please.', 0, 'θ', 'f'],
  ['We live on a big ship.', 'We leave on a big ship.', 1, 'ɪ', 'i'],
  ['The rice is very hot.', 'The lice is very hot.', 1, 'r', 'l'],
  ['I like the red vest.', 'I like the red west.', 4, 'v', 'w'],
  ['The man is on the boat.', 'The men is on the boat.', 1, 'æ', 'ɛ'],
  ['They want some water.', 'Day want some water.', 0, 'ð', 'd'],
];

/**
 * Mandarin pairs: [target (Simplified), its pinyin, said instead, its pinyin, what differs].
 * Tone pairs share the syllable; segment pairs share the tone.
 */
export const ZH_PAIRS: [string, string, string, string, 'tone' | 'initial' | 'final'][] = [
  // tones
  ['妈', 'ma1', '马', 'ma3', 'tone'], ['马', 'ma3', '骂', 'ma4', 'tone'], ['麻', 'ma2', '马', 'ma3', 'tone'], ['妈', 'ma1', '麻', 'ma2', 'tone'],
  ['买', 'mai3', '卖', 'mai4', 'tone'], ['汤', 'tang1', '糖', 'tang2', 'tone'], ['糖', 'tang2', '躺', 'tang3', 'tone'], ['躺', 'tang3', '烫', 'tang4', 'tone'],
  ['诗', 'shi1', '十', 'shi2', 'tone'], ['十', 'shi2', '使', 'shi3', 'tone'], ['使', 'shi3', '是', 'shi4', 'tone'],
  ['鱼', 'yu2', '雨', 'yu3', 'tone'], ['雨', 'yu3', '玉', 'yu4', 'tone'], ['温', 'wen1', '文', 'wen2', 'tone'], ['稳', 'wen3', '问', 'wen4', 'tone'],
  ['翻', 'fan1', '烦', 'fan2', 'tone'], ['反', 'fan3', '饭', 'fan4', 'tone'], ['衣', 'yi1', '姨', 'yi2', 'tone'], ['椅', 'yi3', '意', 'yi4', 'tone'],
  // curled vs flat
  ['诗', 'shi1', '思', 'si1', 'initial'], ['是', 'shi4', '四', 'si4', 'initial'], ['书', 'shu1', '苏', 'su1', 'initial'], ['山', 'shan1', '三', 'san1', 'initial'],
  ['知', 'zhi1', '资', 'zi1', 'initial'], ['找', 'zhao3', '早', 'zao3', 'initial'], ['吃', 'chi1', '疵', 'ci1', 'initial'], ['春', 'chun1', '村', 'cun1', 'initial'],
  ['出', 'chu1', '粗', 'cu1', 'initial'],
  // n / l
  ['你', 'ni3', '李', 'li3', 'initial'], ['牛', 'niu2', '流', 'liu2', 'initial'], ['男', 'nan2', '蓝', 'lan2', 'initial'], ['年', 'nian2', '连', 'lian2', 'initial'],
  ['女', 'nv3', '旅', 'lv3', 'initial'],
  // h → f
  ['虎', 'hu3', '府', 'fu3', 'initial'],
  // -ng / -n
  ['汤', 'tang1', '贪', 'tan1', 'final'], ['糖', 'tang2', '谈', 'tan2', 'final'], ['伤', 'shang1', '山', 'shan1', 'final'], ['冰', 'bing1', '宾', 'bin1', 'final'],
  ['平', 'ping2', '贫', 'pin2', 'final'], ['想', 'xiang3', '显', 'xian3', 'final'],
  // ü
  ['鱼', 'yu2', '姨', 'yi2', 'final'], ['去', 'qu4', '气', 'qi4', 'final'], ['绿', 'lv4', '路', 'lu4', 'final'], ['学', 'xue2', '鞋', 'xie2', 'final'],
];

/** Mandarin phrases with one syllable swapped: [target, target pinyin, said, said pinyin, index, what differs]. */
export const ZH_PHRASES: [string, string, string, string, number, 'tone' | 'initial' | 'final'][] = [
  ['我想买', 'wo3 xiang3 mai3', '我想卖', 'wo3 xiang3 mai4', 2, 'tone'],
  ['我要汤', 'wo3 yao4 tang1', '我要糖', 'wo3 yao4 tang2', 2, 'tone'],
  ['这是四', 'zhe4 shi4 si4', '这是十', 'zhe4 shi4 shi2', 2, 'tone'],
  ['我要吃鱼', 'wo3 yao4 chi1 yu2', '我要吃雨', 'wo3 yao4 chi1 yu3', 3, 'tone'],
  ['我喜欢看书', 'wo3 xi3 huan5 kan4 shu1', '我喜欢看苏', 'wo3 xi3 huan5 kan4 su1', 4, 'initial'],
  ['你是谁', 'ni3 shi4 shei2', '你四谁', 'ni3 si4 shei2', 1, 'initial'],
  ['我喝牛奶', 'wo3 he1 niu2 nai3', '我喝流奶', 'wo3 he1 liu2 nai3', 2, 'initial'],
  ['我想喝汤', 'wo3 xiang3 he1 tang1', '我想喝贪', 'wo3 xiang3 he1 tan1', 3, 'final'],
];

export const VOICES = ['Kore', 'Puck', 'Leda'];
/** Mandarin uses more voices: the tone model is trained on some speakers and must work for new ones. */
export const ZH_VOICES = [...VOICES, 'Aoede', 'Zephyr', 'Charon'];
