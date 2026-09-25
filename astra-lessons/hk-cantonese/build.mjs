import fs from 'node:fs';
import { toSimplified as hans } from '../../scripts/i18n-hans-lib.mjs';
import { extension } from './extension.mjs';
import { applications } from './applications.mjs';
import { guidance, order } from './guidance.mjs';
import { phonetics, phoneticItems } from './phonetics.mjs';
const {topics: original}=JSON.parse(fs.readFileSync(new URL('./source.json',import.meta.url),'utf8'));
const topics=[...original.map(t=>({...t,...guidance[t.id]})),...extension,...applications].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
const langs=['en','zh-Hant','ja','ko','fr','es'];
const packs=Object.fromEntries([...langs,'zh-Hans'].map(l=>[l,{content:{},lessons:{},meanings:{}}]));
function add(part,key,values){if(values.length!==langs.length||values.some(v=>typeof v!=='string'||!v.trim()))throw new Error('Incomplete translations: '+key);langs.forEach((l,i)=>packs[l][part][key]=values[i]);packs['zh-Hans'][part][key]=hans(values[1],{preserveQuotes:part==='lessons'});}
const courseNames=['Cantonese','廣東話','広東語','광둥어','Cantonais','Cantonés'];
const labels=[['Words','詞語','単語','단어','Mots','Palabras'],['Useful phrases','實用短句','便利なフレーズ','유용한 표현','Expressions utiles','Frases útiles'],['Conversation','對話','会話','대화','Conversation','Conversación'],['Review and apply','複習與應用','復習と応用','복습과 활용','Révision et mise en pratique','Repaso y práctica']];
const guide=[
['Use these phrases in a Hong Kong Cantonese role-play.','用這些短句練習香港廣東話角色扮演。','これらの表現で香港広東語のロールプレイをしましょう。','이 표현으로 홍콩 광둥어 역할극을 연습하세요.','Utilisez ces phrases dans un jeu de rôle en cantonais de Hong Kong.','Usa estas frases en un juego de rol en cantonés de Hong Kong.'],
['Listen to each syllable and follow its Jyutping tone number.','留意每個音節，跟着粵拼聲調數字練習。','各音節を聞き、粤拼の声調番号に合わせましょう。','각 음절을 듣고 월병의 성조 숫자를 따라 하세요.','Écoutez chaque syllabe et suivez son chiffre de ton en jyutping.','Escucha cada sílaba y sigue su número de tono en jyutping.'],
['Take turns asking and answering. Try again without looking at the meaning.','輪流提問和回答，再試一次，不看意思提示。','交代で質問と返答をし、次は意味を見ずに試しましょう。','번갈아 묻고 답한 뒤 뜻을 보지 않고 다시 해 보세요.','Posez les questions et répondez à tour de rôle, puis essayez sans regarder le sens.','Turnaos para preguntar y responder. Después, intentadlo sin mirar el significado.']];
guide.forEach(v=>add('lessons',v[0],v));
const question=['Which reply answers this question?','哪句回覆回答了這個問題？','この質問への答えはどれですか？','이 질문에 맞는 답은 무엇인가요?','Quelle réponse répond à cette question ?','¿Qué respuesta contesta esta pregunta?'];
const explanation=['Listen for what the speaker asks, then choose a matching reply.','留意對方問甚麼，再選合適的回覆。','何を聞かれているか確認し、合う返答を選びましょう。','상대가 무엇을 묻는지 듣고 알맞은 답을 고르세요.','Repérez ce que demande la personne, puis choisissez une réponse adaptée.','Fíjate en lo que pregunta la persona y elige una respuesta adecuada.'];
add('lessons',question[0],question);add('lessons',explanation[0],explanation);
const data={id:'hong-kong-cantonese',language:'yue',title:courseNames[0],grownUpTitle:courseNames[0],exercisePrefix:'yuex',items:{},units:[],check:{little:[],junior:[],teen:[]},lab:{sounds:['yue:tones','yue:stops','yue:ng'],ladders:{}}};
add('content','course.'+data.id+'.title',courseNames);add('content','course.'+data.id+'.title.adult',courseNames);
const goals=[
 ['Name the key words and recognise them by listening.','說出關鍵詞，並聽音辨認。','基本語を言い、聞いて区別しましょう。','핵심 단어를 말하고 듣고 구별하세요.','Nommez les mots clés et reconnaissez-les à l’écoute.','Di las palabras clave y reconócelas al escucharlas.'],
 ['Build useful sentences with this Cantonese pattern.','用這個廣東話句式組成實用句子。','この広東語の型で役立つ文を作りましょう。','이 광둥어 문형으로 유용한 문장을 만드세요.','Construisez des phrases utiles avec cette structure cantonaise.','Forma frases útiles con esta estructura cantonesa.'],
 ['Ask and answer in a short Cantonese conversation.','用廣東話進行簡短問答。','広東語の短い会話で質問と返答をしましょう。','짧은 광둥어 대화에서 묻고 답하세요.','Posez des questions et répondez dans une courte conversation en cantonais.','Pregunta y responde en una breve conversación en cantonés.'],
 ['Combine listening, reading and speaking to solve the situation.','結合聆聽、閱讀與說話，完成情境任務。','聞く・読む・話す力を組み合わせて場面の課題に取り組みましょう。','듣기, 읽기, 말하기를 함께 사용해 상황 과제를 해결하세요.','Combinez écoute, lecture et parole pour résoudre la situation.','Combina escucha, lectura y habla para resolver la situación.']];
 goals.forEach(v=>add('lessons',v[0],v));
 const scenarios=[];
for(const topic of topics){
 if(!order.includes(topic.id)||!topic.tip||topic.turns.length<2)throw new Error('Incomplete topic: '+topic.id);
 add('lessons',topic.tip[0],topic.tip);
 for(const row of topic.rows){if(row.length!==8||row[1].split(' ').length!==[...row[0].matchAll(/\p{Script=Han}/gu)].length)throw new Error('Jyutping or translation alignment: '+topic.id+' / '+row[0]);}
 const ids=topic.rows.map((row,i)=>{
  const [text,jyutping,...meanings]=row,id='yue-'+topic.id+'-'+(i+1);
  data.items[id]={text,lang:'zh-HK',yue:{jyutping},meaning:meanings[0],kind:text.length<4?'word':'phrase',picture:topic.icon};
  add('meanings',meanings[0],meanings);return id;
 });
 const speak=i=>({type:'speak',item:ids[i]});
 const heard=(i,j)=>({type:'choose-heard',answer:ids[i],others:[ids[j]]});
 const talk=(n)=>{const [i,replies]=topic.turns[n];return{type:'dialogue',tutor:ids[i],replies:replies.map(j=>ids[j]),picture:topic.icon};};
 const arrange=i=>({type:'arrange',item:ids[i],chunks:topic.chunks[i]});
 const [prompt,replies]=topic.turns[0];
 const read={type:'read-choice',passage:ids[prompt],question:question[0],questionHant:question[1],answer:ids[replies[0]],others:[ids[0]],explanation:explanation[0],explanationHant:explanation[1]};
 const unit={id:'yue-'+topic.id,title:topic.names[0],subtitle:courseNames[0],icon:topic.icon,color:'var(--leaf)',lessons:[]};
 add('content','unit.'+unit.id+'.title',topic.names);add('content','unit.'+unit.id+'.subtitle',courseNames);
 for(let i=0;i<4;i++){
  const id=unit.id+'-'+(i+1),titles=topic.names.map((n,j)=>n+' · '+labels[i][j]);
  add('content','lesson.'+id+'.title',titles);
  const little=i===0?[speak(0),speak(1),speak(2),heard(0,1),speak(3)]:i===1?[speak(2),speak(3),speak(4),heard(2,3)]:i===2?[speak(prompt),talk(0),talk(1)]:[heard(0,1),heard(2,3),speak(4),talk(0)];
  const junior=i===0?[speak(0),speak(1),speak(2),speak(3),heard(1,2)]:i===1?[speak(4),speak(5),speak(6),speak(7),...ids.slice(8).flatMap((_,j)=>topic.id==='work'&&j===0?[]:[speak(j+8)]),arrange(4)]:i===2?[speak(prompt),talk(0),talk(1),speak(6)]:[heard(2,3),read,arrange(5),speak(4),speak(5),talk(0)];
  const teen=i===0?[...junior,speak(4)]:i===1?[...junior.filter(e=>e.type!=='arrange'),arrange(5)]:i===2?[talk(0),talk(1),arrange(4),speak(6)]:[read,arrange(5),heard(5,6),speak(4),speak(5),talk(0)];
  if(i===2)for(const plan of [little,junior,teen])plan.push({type:'speak',item:'yue-goodbye'});
  const adult=[...teen]; if(topic.id==='work'&&i>0)adult.push(speak(8));
  unit.lessons.push({id,title:titles[0],icon:topic.icon,kind:['words','phrases','conversation','review'][i],guide:{goal:goals[i][0],goalHant:goals[i][1],tip:topic.tip[0],tipHant:topic.tip[1],practice:guide[i===0?1:2][0],practiceHant:guide[i===0?1:2][1]},exercises:{little,junior,teen,adult}});
 }
 data.units.push(unit);
 const by=v=>({little:v,junior:v,teen:v});
 const scenario={id:'yue-'+topic.id,course:'yue',title:topic.names[0],icon:topic.icon,color:'var(--leaf)',blurb:by(topic.tip[0]),setting:'A friendly role-play in Hong Kong using spoken Hong Kong Cantonese.',tutorRole:'a helpful practice partner',goals:[topic.names[0]],turns:topic.turns.map(([i,rs])=>({tutor:by(ids[i]),replies:by(rs.map(j=>ids[j]))})),closing:by('yue-goodbye')};
 scenarios.push(scenario);
 add('content','scenario.'+scenario.id+'.title',topic.names);
 for(const band of ['little','junior','teen'])add('content','scenario.'+scenario.id+'.blurb.'+band,topic.tip);
}
const extra=[
['tone1','詩','si1',['poem','詩','詩','시','poème','poema']],
['tone2','史','si2',['history','歷史','歴史','역사','histoire','historia']],
['tone3','試','si3',['try','嘗試','試す','시도하다','essayer','intentar']],
['tone4','時','si4',['time','時間','時間','시간','temps','tiempo']],
['tone5','市','si5',['market','市場','市場','시장','marché','mercado']],
['tone6','事','si6',['matter','事情','事柄','일','affaire','asunto']],
['eight','八','baat3',['eight','八','八','여덟','huit','ocho']],
['hundred','百','baak3',['hundred','百','百','백','cent','cien']],
['cow','牛','ngau4',['cow','牛','牛','소','vache','vaca']],
['i','我','ngo5',['I','我','私','나','je','yo']],
['goodbye','下次再傾！','haa6 ci3 zoi3 king1',['Let us chat again next time!','下次再聊！','また今度話しましょう！','다음에 또 이야기해요!','On discutera une prochaine fois !','¡Hablamos la próxima vez!']]
];
for(const[id,text,jyutping,meanings]of [...extra,...phoneticItems]){data.items['yue-'+id]={text,lang:'zh-HK',yue:{jyutping},meaning:meanings[0],kind:/[。！？]$/.test(text)?'sentence':'word'};add('meanings',meanings[0],meanings);}
data.check={little:['yue-greetings-1','yue-food-1','yue-tone1'],junior:['yue-greetings-5','yue-food-5','yue-tone2'],teen:['yue-greetings-6','yue-out-5','yue-work-6']};
data.lab.ladders={
 'yue:tones':{syllables:extra.slice(0,6).map(r=>'yue-'+r[0]),words:['yue-people-1','yue-people-4'],phrases:['yue-greetings-5'],sentence:['yue-greetings-6']},
 'yue:stops':{syllables:['yue-eight','yue-hundred','yue-numbers-4'],words:['yue-out-1','yue-work-2'],phrases:['yue-food-5'],sentence:['yue-food-6']},
 'yue:ng':{syllables:['yue-i','yue-cow'],words:['yue-cow','yue-i'],phrases:['yue-greetings-5'],sentence:['yue-work-7']}
};
for(const sound of phonetics){data.lab.sounds.push(sound.id);data.lab.ladders[sound.id]=sound.ladders;}
fs.mkdirSync('astra-lessons/courses',{recursive:true});fs.writeFileSync('astra-lessons/courses/yue.json',JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('astra-lessons/hk-cantonese/scenarios.json',JSON.stringify(scenarios,null,2)+'\n');

const soundRows=JSON.parse(fs.readFileSync(new URL('./sounds.json',import.meta.url),'utf8'));
const sounds=[...soundRows,...phonetics].map(s=>{
 const info={id:s.id,label:s.label,example:s.example,category:s.category,name:s.names[0],tip:{junior:s.tips[0]},steps:[s.tips[0]],problem:s.tips[0],detail:s.tips[0],difficulty:.5,pose:s.pose??{open:.3,round:0,spread:.2,tongue:'rest',air:s.id==='yue:ng'?'nose':'none',voiced:true}};
 add('content','sound.'+s.id+'.name',s.names);
 for(const field of ['tip.junior','step.1','problem','detail'])add('content','sound.'+s.id+'.'+field,s.tips);
 return info;
});
fs.writeFileSync('astra-lessons/hk-cantonese/sounds-built.json',JSON.stringify(sounds,null,2)+'\n');

fs.writeFileSync('astra-lessons/i18n/cantonese.json',JSON.stringify(packs,null,2)+'\n');
console.log('Built '+data.units.length+' units, '+data.units.flatMap(u=>u.lessons).length+' lessons, '+Object.keys(data.items).length+' items, '+scenarios.length+' conversations, seven app-language catalogs.');
