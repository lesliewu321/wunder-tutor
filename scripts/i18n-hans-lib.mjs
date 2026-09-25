import * as OpenCC from 'opencc-js';
const convert=OpenCC.Converter({from:'hk',to:'cn'});
// Translate interface prose, while retaining quoted Cantonese examples in their taught script.
const WORDS=[['个人档案','个人资料'],['电邮地址','邮箱地址'],['电邮','邮箱'],['登出','退出登录'],['登入','登录'],['应用程式','应用'],['程式','程序'],['设定','设置'],['档案','文件'],['私隐','隐私'],['储存','保存'],['帐户','账户'],['帐号','账号'],['伺服器','服务器'],['介面','界面'],['回馈','反馈'],['连结','链接'],['甚么','什么'],['身分','身份'],['载入','加载'],['预设','默认'],['相片','照片'],['萤幕','屏幕'],['咪高峰','麦克风'],['短讯','短信'],['讯息','消息'],['支援','支持']];
export function toSimplified(text,{preserveQuotes=false}={}){
 const prose=s=>WORDS.reduce((t,[a,b])=>t.split(a).join(b),convert(s));
 return preserveQuotes?text.split(/(「[^」]*」)/u).map(s=>s.startsWith('「')?s:prose(s)).join(''):prose(text);
}
