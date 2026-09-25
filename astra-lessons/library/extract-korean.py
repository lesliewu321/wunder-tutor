
import sys,zipfile,json,hashlib
from pathlib import Path
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
base=Path('astra-lessons/library').resolve()
items=[]
for n in (1,2):
 archive=base/f'korean/eps-topik-complete-book-{n}.zip'
 with zipfile.ZipFile(archive) as z:
  bad=z.testzip()
  if bad: raise ValueError('Archive CRC failure: '+bad)
  candidates=[i for i in z.infolist() if i.filename.endswith('.pdf') and i.file_size>10000000]
  if len(candidates)!=1:raise ValueError('Unexpected archive structure')
  info=candidates[0]
  dest=base/f'korean/eps-topik-book-{n}.pdf'
  data=z.read(info)
  if not data.startswith(b'%PDF-'):raise ValueError('Not a PDF')
  dest.write_bytes(data)
  r=PdfReader(dest)
  items.append({'file':dest.relative_to(base).as_posix(),'archive':archive.relative_to(base).as_posix(),'archiveMember':info.filename,'pages':len(r.pages),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
  (Path('astra-lessons/qa/source-discovery')/f'eps-topik-book-{n}-front.txt').write_text('\n\n'.join(f'PDF PAGE {i+1}\n'+(r.pages[i].extract_text() or '') for i in range(12)),encoding='utf8')
  print(dest.name,len(r.pages))
(base/'extracted.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
