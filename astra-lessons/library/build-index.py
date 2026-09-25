
"""Verify the local source library and rebuild its indexes. Requires pypdf."""
from pathlib import Path
import sys, json, re, hashlib, zipfile, html
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
BASE=Path(__file__).resolve().parent
def read(name):return json.loads((BASE/name).read_text(encoding='utf-8'))
def write(name,data):(BASE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
sources=read('sources.json'); downloads=read('downloads.json'); extracted=read('extracted.json')
errors=[]; files=[]
for r in downloads+extracted:
 f=(BASE/r['file']).resolve()
 if not f.is_relative_to(BASE):raise ValueError('Unsafe path')
 if not f.exists():errors.append('Missing '+r['file']);continue
 if digest(f)!=r['sha256']:errors.append('Hash mismatch '+r['file'])
 item={**r}
 if f.suffix=='.pdf':
  reader=PdfReader(f)
  if reader.is_encrypted:errors.append('Encrypted '+r['file'])
  item['pages']=len(reader.pages)
  for page in reader.pages:
   if float(page.mediabox.width)<=0:errors.append('Invalid page '+r['file'])
 elif f.suffix in ('.zip','.docx'):
  with zipfile.ZipFile(f) as z:
   if z.testzip():errors.append('CRC failure '+r['file'])
   if f.suffix=='.docx' and 'word/document.xml' not in z.namelist():errors.append('Invalid DOCX '+r['file'])
 files.append(item)
if errors:raise ValueError('\n'.join(errors))
def sid(file):
 if file.startswith('japanese/'):return 'irodori'
 if file.startswith('french/'):return 'ut-fr'
 if file.startswith('korean/eps-'):return 'hrdk'
 if file.startswith('korean/'):return 'psu-ko'
 if '/intermediate/' in file:return 'ghc-es'
 if 'introduccion' in file:return 'conestoga-es'
 return 'psu-es'
sourceById={s['id']:s for s in sources['sources']}
for f in files:
 f['sourceId']=sid(f['file']);s=sourceById[f['sourceId']]
 f['language']=s['language'];f['rights']=s['license']
 f['title']=f.get('title') or ('EPS-TOPIK complete textbook '+('1' if 'book-1' in f['file'] else '2'))
def bookmarks(file):
 r=PdfReader(BASE/file)
 def walk(items):
  for item in items:
   if isinstance(item,list):yield from walk(item)
   else:yield {'title':item.title,'page':r.get_destination_page_number(item)+1}
 return list(walk(r.outline))
lessons=[]
def lesson(id,lang,source,title,file,page,book,**extra):
 if page<1 or page>next(f['pages'] for f in files if f['file']==file):raise ValueError('Invalid page link: '+id)
 lessons.append(dict(id=id,language=lang,sourceId=source,title=title,file=file,page=page,book=book,kind='lesson',**extra))
jaBooks=[
('starter-a1','Starter','A1','starter',['Everyday greetings','Asking for clarification','Introducing yourself','Home and background','Food preferences','Ordering a meal','Describing rooms','Locating people','Daily schedules','Borrowing equipment','Leisure interests','Making invitations','Using transport','Describing places','Finding products','Asking prices','Past leisure activities','Future wishes']),
('elementary-1-a2','Elementary 1','A2','elementary01',['Work introductions','Sharing interests','Seasonal weather','Recent weather','Describing a town','Following directions','Delays and explanations','Personal experiences','Reading assistance','Joining language classes','Food arrangements','Discussing lunch','Work estimates','Requesting time off','Describing symptoms','Healthy routines','Personal gifts','Gift suggestions']),
('elementary-2-a2','Elementary 2','A2','elementary02',['Settling in Japan','Describing personalities','Dietary needs','Eating instructions','Travel reservations','Travel reflections','Event contingencies','Finding event facilities','Annual customs','Appropriate clothing','Customer services','Comparing appliances','Visiting exhibitions','Requesting personal services','Reporting oversights','Emergency responses','Language progress','Long-term ambitions']),
('pre-intermediate-a2-b1','Pre-Intermediate','A2/B1','pre-intermediate',['Explaining activities','Entertainment opinions','Moving arrangements','Household breakdowns','Choosing restaurants','Cooking routines','Building friendships','Starting conversations','Reasons for learning','Study approaches','Recognising scams','Seeking urgent help','Congratulating others','Relationship concerns','Planning sightseeing','Sharing travel memories','Explaining work roles','Applying for work'])]
for slug,title,level,remote,topics in jaBooks:
 file='japanese/irodori-'+slug+'.pdf'
 marks={int(m.group(1)):b['page'] for b in bookmarks(file) if (m:=re.search(r'第\s*(\d+)\s*課',b['title']))}
 if set(marks)!=set(range(1,19)):raise ValueError('Missing Japanese lessons: '+file)
 for n,topic in enumerate(topics,1):
  lesson('ja-'+slug+'-'+str(n),'ja','irodori',topic,file,marks[n],'Irodori '+title,number=n,level=level,
         audioUrl='https://www.irodori.jpf.go.jp/en/'+remote+'/audio/lesson'+str(n).zfill(2)+'.html')
for volume in (1,2):
 file=f'korean/eps-topik-book-{volume}.pdf';r=PdfReader(BASE/file)
 for local in range(30):
  num=local+1 if volume==1 else local+31;page=50+local*10 if volume==1 else 16+local*10
  compact=re.sub(r'\s+','',r.pages[page-1].extract_text() or '')
  if 'CHAPTER'+str(num).zfill(2) not in compact:raise ValueError(f'Korean lesson locator not verified: {num}')
  lesson('ko-hrdk-'+str(num),'ko','hrdk',('Daily-life Korean' if volume==1 else 'Workplace Korean')+' · Unit '+str(num),file,page,'EPS-TOPIK Book '+str(volume),number=num,level='Adult EPS-TOPIK curriculum')
frTopics=['Course orientation','Meeting people','Personal information','Travel and leisure','Describing people','Food and dining','Places around town','Celebrations and past events','Home life','Media and communication','Clothing and wellbeing','School and study','Working life','Relationships and money']
frPages=[13,17,33,59,85,109,139,165,191,211,231,255,281,305]
for n,(topic,page) in enumerate(zip(frTopics,frPages)):
 lesson('fr-ut-'+str(n),'fr','ut-fr',topic,'french/francais-interactif.pdf',page,'Français interactif',number=n,level='First-year French')
psuTopics=['Classroom communication','The learning community','Lives beyond class','Student routines','Personal identities','Cultural connections','Community membership','Group values','Reflecting on culture','Exchanging cultures','Places and journeys','Cultural comparisons','Habits and practices','Daily routines','Valued customs','Changing habits','Personal timelines','Significant experiences','Long-term goals','Past and present','Setting goals','Community participation','Wishes and hopes','Imagining change']
moduleMarks=[b for b in bookmarks('spanish/beginning-spanish.pdf') if b['title'].startswith('Module ')]
if len(moduleMarks)!=24:raise ValueError('Expected 24 Spanish modules')
for n,(topic,b) in enumerate(zip(psuTopics,moduleMarks),1):
 lesson('es-psu-'+str(n),'es','psu-es',topic,'spanish/beginning-spanish.pdf',b['page'],'Beginning Spanish',number=n,chapter=(n-1)//4+1,level='Beginning university Spanish')
conTopics=['Language and sounds','Meeting people','Greetings and formality','Classroom language and descriptions','Colours and counting','Dates and questions','Hobbies and verbs','Food and restaurants','Travel and places','Home and possessions','Body and wellbeing','Family and ownership']
conMarks=[b for b in bookmarks('spanish/introduccion-al-espanol.pdf') if re.fullmatch(r'Chapter \d+',b['title'])]
if len(conMarks)!=12:raise ValueError('Expected 12 Conestoga chapters')
for n,(topic,b) in enumerate(zip(conTopics,conMarks),1):
 lesson('es-conestoga-'+str(n),'es','conestoga-es',topic,'spanish/introduccion-al-espanol.pdf',b['page'],'Introducción al Español',number=n,level='Basic Spanish')
activities=[{**f,'kind':'activity','id':'ghc-'+str(i+1)} for i,f in enumerate(files) if '/intermediate/' in f['file']]
books=[{**f,'kind':'book','id':f['file']} for f in files if f['file'].endswith('.pdf') and '/intermediate/' not in f['file']]
catalog={'schemaVersion':1,'checked':'2026-09-25','appIntegration':'reference-library-only','approvalMeaning':sources['approvalMeaning'],'books':books,'lessons':lessons,'activities':activities,'sources':sources['sources'],'externalLinks':sources['externalLinks']}
write('catalog.json',catalog)
write('verification.json',{'checked':'2026-09-25','downloadedFiles':len(downloads),'extractedTextbooks':len(extracted),'pdfFiles':sum('pages' in f for f in files),'pdfPages':sum(f.get('pages',0) for f in files),'docxFiles':sum(f['file'].endswith('.docx') for f in files),'archiveFiles':sum(f['file'].endswith('.zip') for f in files),'indexedLessonsOrModules':len(lessons),'intermediateSpanishActivityFiles':len(activities),'bytesIncludingArchives':sum(f['bytes'] for f in files),'checks':{'sha256':'passed','pdfParsingAndPageDimensions':'passed','zipAndDocxCRC':'passed','pageLinkBounds':'passed','japaneseAll72LessonBookmarks':'passed','koreanAll60ChapterHeaders':'passed'},'scope':'Source reference library. Counts do not represent newly authored or accredited app lessons. Media remains on provider websites.'})
langs={'ja':('japanese','Japanese'),'ko':('korean','Korean'),'fr':('french','French'),'es':('spanish','Spanish')}
for lang,(folder,name) in langs.items():
 lines=['# '+name+' source lessons','',sources['approvalMeaning']+'.','',
        'These are local reference books and source activities. The files have not been converted into Wunder Tutor runtime lessons.','',
        '## Books','', '| Resource | PDF pages | Source and reuse |','| --- | ---: | --- |']
 for f in books:
  if f['language']==lang:
   s=sourceById[f['sourceId']]
   lines.append('| ['+f['title']+'](../'+f['file']+') | '+str(f['pages'])+' | ['+s['publisher']+']('+s['sourceUrl']+') · '+s['license']+' |')
 lines+=['','## Study order','']
 if lang=='ja':lines+=['Work through Starter, Elementary 1, Elementary 2, then Pre-Intermediate. Each volume has 18 substantial lessons. The labels A1, A2 and A2/B1 come from the publisher. Use the linked publisher audio with each lesson.']
 if lang=='ko':lines+=['Start with Hangeul and greetings in Book 1 (PDF pages 16–49), then units 1–30. Units 31–60 in Book 2 cover adult workplace situations. Use the folktale reader for supplementary comprehension practice at a suitable level. The official Sejong general-language curriculum is also linked below; its downloads require an account.']
 if lang=='fr':lines+=['Begin with chapter 0, then chapters 1–13. Pair each chapter with the publisher audio and phonetics pages. Use the review file after chapter 7 and the verb reference as needed. This is a university curriculum, not a DELF qualification.']
 if lang=='es':lines+=['Choose one beginner spine: the 24-module Portland State course for sustained communicative work, or the 12-chapter Conestoga book for a shorter introduction. After the basics, select Georgia Highlands intermediate vocabulary, listening, speaking, writing and rubric files.']
 lines+=['','## Lesson index','', 'Topic labels below are short descriptions written for this index; the source books remain unchanged. PDF links use the actual one-based PDF page, which may differ from printed page labels.','',
         '| Course | Lesson/module | Topic | Local page |','| --- | ---: | --- | ---: |']
 for l in lessons:
  if l['language']==lang:lines.append('| '+l['book']+' | '+str(l['number'])+' | '+l['title']+' | [PDF '+str(l['page'])+'](../'+l['file']+'#page='+str(l['page'])+') |')
 if lang=='es':
  lines+=['','## Intermediate activity downloads','', 'The following activities include material with mixed rights. Review each item before adapting it for a commercial product.','']
  lines+=['- ['+a['title']+'](../'+a['file']+')' for a in activities]
 lines+=['','## Audio, standards and additional courses','']
 for s in sources['sources']:
  if s['language']==lang:lines.append('- ['+s['name']+' — publisher and media]('+s['audioUrl']+')')
 for link in sources['externalLinks']:
  if link['language']==lang:lines.append('- ['+link['title']+']('+link['url']+') — '+link['status']+'. '+link['note'])
 lines+=['','See [source and reuse records](../SOURCES.md) and [adoption notes](../ADOPTION.md).','']
 (BASE/folder/'README.md').write_text('\n'.join(lines),encoding='utf-8')
srcLines=['# Source and reuse records','','Checked 25 September 2026. Downloads are unmodified. Rights remain with the named authors and publishers; none endorses Wunder Tutor.','',
          'The licence of a textbook does not automatically cover every embedded song, image, story, video or external resource. This library is kept outside public app assets.','']
for s in sources['sources']:
 srcLines+=['## '+s['name'],'','- Publisher: '+s['publisher']+'.','- [Official source]('+s['sourceUrl']+') · [Rights reference]('+s['rightsUrl']+').',
            '- Terms: '+s['license']+'.','- Commercial app adaptation: '+s['commercialAdaptation']+'.',
            '- Evidence: '+s['evidence'],'- Coverage: '+s['localScope'],'- Audience: '+s['audience'],'']
(BASE/'SOURCES.md').write_text('\n'.join(srcLines),encoding='utf-8')
template=(BASE/'index-template.html').read_text(encoding='utf-8')
(BASE/'index.html').write_text(template.replace('__CATALOG__',json.dumps(catalog,ensure_ascii=False).replace('<','\\u003c')),encoding='utf-8')
print(json.dumps(read('verification.json'),ensure_ascii=False))
