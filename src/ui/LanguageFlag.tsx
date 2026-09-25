import type { Accent } from '../domain/types';
const countries: Record<string,string> = { en:'gb', 'en-US':'us', 'en-GB':'gb', zh:'cn', 'zh-Hans':'cn', 'zh-Hant':'hk', yue:'hk', ja:'jp', ko:'kr', fr:'fr', es:'es', de:'de', pt:'pt' };
const emoji: Record<string,string> = {gb:'🇬🇧',us:'🇺🇸',cn:'🇨🇳',hk:'🇭🇰',jp:'🇯🇵',kr:'🇰🇷',fr:'🇫🇷',es:'🇪🇸',de:'🇩🇪',pt:'🇵🇹'};
export const flagCountry = (language: string, accent?: Accent) => countries[language === 'en' && accent ? accent : language];
export const flagEmoji = (language: string, accent?: Accent) => emoji[flagCountry(language, accent)] ?? '🌍';
export function LanguageFlag({ language, accent }: { language: string; accent?: Accent }) {
 const country = flagCountry(language, accent);
 return country ? <img className="language-flag" src={'/flags/'+country+'.svg'} alt="" aria-hidden="true" width="26" height="18" /> : <span aria-hidden="true">🌍</span>;
}
