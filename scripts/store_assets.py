#!/usr/bin/env python3
"""Render existing brand artwork, capture real Android screens, validate a Play package.
Requires Python 3.9+ and Pillow. No generated application UI or network access.
"""
import argparse, datetime, hashlib, io, json, os, pathlib, re, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'store-assets/google-play'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def config():return json.loads((OUT/'listing.json').read_text())
def font(size,bold=False):
 key='STORE_FONT_BOLD' if bold else 'STORE_FONT'
 paths=[os.environ.get(key,''),'/System/Library/Fonts/Supplemental/Arial'+(' Bold' if bold else '')+'.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf']
 for p in paths:
  if p and pathlib.Path(p).is_file():return ImageFont.truetype(p,size)
 raise RuntimeError('Set STORE_FONT and STORE_FONT_BOLD to licensed TrueType fonts')
def render():
 c=config();im=Image.open(ROOT/c['icon']).convert('RGBA');im=im.resize((512,512),Image.Resampling.LANCZOS);im.save(OUT/'icon-512.png',optimize=True)
 bg=c['background'];im=Image.new('RGB',(1024,500),bg);d=ImageDraw.Draw(im)
 if c.get('art'):
  art=ImageOps.fit(Image.open(ROOT/c['art']).convert('RGB'),(510,500),centering=(.5,.5));im.paste(art,(514,0))
  # A restrained solid panel keeps small-size text readable; no fictional UI.
  d=ImageDraw.Draw(im);d.rectangle((0,0,515,500),fill=bg)
 else:
  for x,y,r in [(900,90,250),(930,410,190)]:d.ellipse((x-r,y-r,x+r,y+r),outline=c['accent'],width=2)
  logo=Image.open(ROOT/c['icon']).convert('RGBA');logo.thumbnail((330,330));im.paste(logo,(650,85),logo)

 if c['name']=='Ryczałt':
  d=ImageDraw.Draw(im);d.rectangle((614,0,1024,500),fill='white');logo=Image.open(ROOT/c['icon']).convert('RGBA');logo.thumbnail((330,330));im.paste(logo,(650,85),logo)
 d=ImageDraw.Draw(im);d.rounded_rectangle((48,58,112,64),3,fill=c['accent'])
 for i,line in enumerate(c['graphic_title']):d.text((48,100+i*65),line,font=font(58,True),fill=c['foreground'])
 for i,line in enumerate(c['graphic_subtitle']):d.text((50,270+i*35),line,font=font(24),fill=c['foreground'])
 d.text((50,420),c['graphic_footer'],font=font(17,True),fill=c['accent'])
 im.save(OUT/'feature-graphic-1024x500.png',optimize=True)
 listing=f"# {c['name']} — Google Play listing\n\nLanguage: {c['language']}\n\n## Title\n\n{c['title']}\n\n## Short description\n\n{c['short_description']}\n\n## Full description\n\n{c['full_description']}\n"
 (OUT/'store-listing.md').write_text(listing)
def capture(args):
 c=config();adb=[args.adb,'-s',args.serial]
 def shell(*a):return subprocess.check_output(adb+['shell',*a],text=True).strip()
 assert shell('getprop','ro.kernel.qemu')=='1','Refusing a physical device'
 assert any(c['package'] in line and 'ResumedActivity' in line for line in shell('dumpsys','activity','activities').splitlines()), 'Bring the app to the foreground first'
 apk=pathlib.Path(args.apk);badging=subprocess.check_output([args.aapt,'dump','badging',str(apk)],text=True)
 match=re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",badging)
 assert match and match[1]==c['package'],'APK identity mismatch'
 installed=shell('pm','path',c['package']).splitlines()[0].removeprefix('package:')
 assert shell('sha256sum',installed).split()[0]==digest(apk),'Installed APK bytes differ from source APK'
 assert re.fullmatch('[0-9a-f]{40}',args.source_sha),'Use the APK source commit, not the asset commit'
 number=args.number or len(list((OUT/'phone').glob('phone-*.png')))+1;assert 1<=number<=8,'Phone index must be 1–8';relative=f'phone/phone-{number:02d}.png'
 raw=subprocess.check_output(adb+['exec-out','screencap','-p']);p=OUT/relative;p.parent.mkdir(exist_ok=True);raw_path=OUT/'raw'/p.name;raw_path.parent.mkdir(exist_ok=True);raw_path.write_bytes(raw);image=Image.open(io.BytesIO(raw)).convert('RGB');image=image.crop(c['screenshot_crop']) if c.get('screenshot_crop') else image;image.save(p,optimize=True)
 manifest_path=OUT/'screenshots.json';m=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'screenshots':[]}
 record={'file':relative,'screen':args.name,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'capture_method':'adb exec-out screencap -p','sha256':digest(p),'raw_sha256':hashlib.sha256(raw).hexdigest(),'crop':c.get('screenshot_crop'),'apk':{'file':apk.name,'sha256':digest(apk),'package':match[1],'version_code':match[2],'version_name':match[3],'source_commit':args.source_sha,'build_url':args.build_url},'emulator':{'avd':shell('getprop','ro.boot.qemu.avd_name'),'serial':args.serial,'api':shell('getprop','ro.build.version.sdk'),'android':shell('getprop','ro.build.version.release'),'abi':shell('getprop','ro.product.cpu.abi'),'display':shell('wm','size'),'density':shell('wm','density'),'app_language':c['language'],'system_locale':shell('getprop','persist.sys.locale')},'foreground_verified':True,'visual_review':'pending'}
 m['screenshots']=[s for s in m['screenshots'] if s['file']!=relative];m['screenshots'].append(record);m['screenshots'].sort(key=lambda s:s['file']);manifest_path.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n');print(relative)
def validate():
 c=config();errors=[];rows=[]
 for field,limit in [('title',30),('short_description',80),('full_description',4000)]:
  if not 0<len(c[field])<=limit:errors.append(f'{field} exceeds {limit}')
 listing=(OUT/'store-listing.md').read_text()
 if not all(c[k] in listing for k in ['title','short_description','full_description']):errors.append('Listing Markdown differs from listing.json')
 manifest=json.loads((OUT/'screenshots.json').read_text());screens=manifest['screenshots'];phones=sorted((OUT/'phone').glob('phone-*.png'))
 if not 2<=len(phones)<=8:errors.append('Need 2–8 phone screenshots')
 if {x['file'] for x in screens}!={str(p.relative_to(OUT)) for p in phones}:errors.append('Manifest/file mismatch')
 hashes=set()
 for p in [OUT/'icon-512.png',OUT/'feature-graphic-1024x500.png']+phones:
  with Image.open(p) as image:
   image.load();w,h=image.size;size=p.stat().st_size
   if image.format!='PNG':errors.append(f'{p.name}: PNG required')
   if p.name=='icon-512.png':
    if (w,h)!=(512,512) or size>1024*1024 or image.mode!='RGBA':errors.append('Invalid icon')
   elif p.name.startswith('feature-'):
    if (w,h)!=(1024,500) or size>15*1024*1024 or image.mode!='RGB':errors.append('Invalid feature graphic')
   else:
    if image.mode!='RGB':errors.append(f'{p.name}: screenshot must be RGB')
    if min(w,h)<320 or max(w,h)>3840 or max(w,h)>2*min(w,h) or size>8*1024*1024:errors.append(f'{p.name}: size/aspect invalid')
    if max(ImageStat.Stat(image.convert('RGB')).stddev)<8:errors.append(f'{p.name}: blank/near-blank')
    sha=digest(p)
    if sha in hashes:errors.append(f'{p.name}: duplicate screenshot')
    hashes.add(sha)
    record=next((s for s in screens if s['file']==str(p.relative_to(OUT))),{})
    if record.get('sha256')!=sha:errors.append(f'{p.name}: provenance hash mismatch')
    if record.get('visual_review')!='pass':errors.append(f'{p.name}: visual review pending')
   rows.append({'file':str(p.relative_to(OUT)),'dimensions':f'{w} × {h}','bytes':size,'format':image.format,'sha256':digest(p)})
 report={'result':'FAIL' if errors else 'PASS','images':rows,'description_characters':{k:len(c[k]) for k in ['title','short_description','full_description']},'errors':errors,'manual_checks':'Human visual review covers private data, debug overlays, branding and feature correspondence; image statistics do not prove these.'}
 (OUT/'validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,indent=2,ensure_ascii=False));raise SystemExit(bool(errors))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
 sub.add_parser('render');sub.add_parser('validate');cap=sub.add_parser('capture');cap.add_argument('--adb',default='adb');cap.add_argument('--aapt',default='aapt');cap.add_argument('--serial',required=True);cap.add_argument('--apk',required=True);cap.add_argument('--source-sha',required=True);cap.add_argument('--build-url',required=True);cap.add_argument('--name',required=True);cap.add_argument('--number',type=int,help='Explicitly replace a screenshot and its provenance record')
 a=p.parse_args();{'render':render,'validate':validate,'capture':lambda:capture(a)}[a.command]()
