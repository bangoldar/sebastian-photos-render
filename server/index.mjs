import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import pg from 'pg';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scrypt=promisify(scryptCallback);
const app=express();
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL, max:Number(process.env.PGPOOL_MAX||5)});
const categories=['Soccer','Basketball','Creative','Hockey'];
const packageCategories=['single','group','addons'];
const defaults=JSON.parse((await readFile(path.join(root,'seed.json'),'utf8')).replace(/^\uFEFF/,''));
const hash=x=>createHash('sha256').update(x).digest('hex');
const bad=(res,message,status=400)=>res.status(status).json({error:message});
const text=(x,max)=>String(x??'').trim().slice(0,max);
const idValid=id=>/^[\w-]{1,100}$/.test(id);
const passwordHash=async password=>{const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:33554432});return `scrypt-v1$${salt}$${key.toString('hex')}`};
async function verifyPassword(password,stored){const [algorithm,salt,expected]=stored.split('$');if(algorithm!=='scrypt-v1'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return false;const key=await scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:33554432});return timingSafeEqual(key,Buffer.from(expected,'hex'))}
async function initialize(){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required.');
 await pool.query(`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY,value text NOT NULL);
 CREATE TABLE IF NOT EXISTS photos (id text PRIMARY KEY, object_key text NOT NULL, title text NOT NULL, alt text NOT NULL, category text NOT NULL, position integer NOT NULL, image bytea, mime text);
 CREATE TABLE IF NOT EXISTS packages (id text PRIMARY KEY, category text NOT NULL, name text NOT NULL, price text NOT NULL, description text NOT NULL, details text NOT NULL, position integer NOT NULL);
 CREATE TABLE IF NOT EXISTS inquiries (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL, package text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
 ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;
 ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS notification_attempt_at timestamptz;
 CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
 CREATE TABLE IF NOT EXISTS login_attempts (id text PRIMARY KEY, count integer NOT NULL, window_start timestamptz NOT NULL)`);
 const c=await pool.connect();
 try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(19139402)");
  const done=await c.query("SELECT value FROM settings WHERE key='initialized'");
  if(!done.rowCount){
   for(const p of defaults.photos)await c.query('INSERT INTO photos (id,object_key,title,alt,category,position) VALUES ($1,$2,$3,$4,$5,$6)',[p.id,p.objectKey,p.title,p.alt,p.category,p.position]);
   for(const p of defaults.packages)await c.query('INSERT INTO packages VALUES ($1,$2,$3,$4,$5,$6,$7)',[p.id,p.category,p.name,p.price,p.description,p.details,p.position]);
   await c.query("INSERT INTO settings VALUES ('page_copy',$1),('initialized','1')",[JSON.stringify(defaults.pageCopy)]);
  }
  const existing=await c.query("SELECT value FROM settings WHERE key='password'");
  if(!existing.rowCount){const pass=process.env.ADMIN_PASSWORD||'';if(pass.length<14||pass.length>128)throw Error('Set ADMIN_PASSWORD to 14–128 characters before starting the service.');await c.query("INSERT INTO settings VALUES ('password',$1)",[await passwordHash(pass)])}
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
await initialize();
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','blob:'],scriptSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
app.use(cookieParser());app.use(express.json({limit:'16kb'}));app.use(express.urlencoded({extended:false,limit:'16kb'}));
const sameOrigin=(req,res,next)=>{if(req.get('origin')!==`${req.protocol}://${req.get('host')}`)return bad(res,'Request origin not accepted.',403);next()};
const limiter=(max,minutes)=>rateLimit({windowMs:minutes*60000,limit:max,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many attempts. Please wait and try again.'}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:16}});
async function authorized(req,res,next){try{const token=req.cookies.seb_admin;if(!/^[a-f0-9]{64}$/.test(token||''))return bad(res,'Please sign in.',401);const found=await pool.query('SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)]);if(!found.rowCount)return bad(res,'Please sign in.',401);next()}catch(e){next(e)}}
async function content(){const [photos,packages,copy]=await Promise.all([pool.query('SELECT id,object_key AS "objectKey",title,alt,category,position FROM photos ORDER BY position,id'),pool.query('SELECT id,category,name,price,description,details,position FROM packages ORDER BY position,id'),pool.query("SELECT value FROM settings WHERE key='page_copy'")]);return {photos:photos.rows,packages:packages.rows,pageCopy:JSON.parse(copy.rows[0].value)}}
const emailConfigured=()=>Boolean(process.env.BREVO_API_KEY&&process.env.BREVO_SENDER_EMAIL&&process.env.NOTIFY_EMAIL&&(process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_URL));
let processingNotifications=false;
async function processNotifications(){
 if(processingNotifications||!emailConfigured())return;
 processingNotifications=true;
 try{
  const pending=await pool.query("SELECT id FROM inquiries WHERE notification_sent_at IS NULL AND (notification_attempt_at IS NULL OR notification_attempt_at<now()-interval '5 minutes') ORDER BY created_at LIMIT 10");
  for(const item of pending.rows){
   await pool.query('UPDATE inquiries SET notification_attempt_at=now() WHERE id=$1',[item.id]);
   try{
    const api=process.env.NODE_ENV==='test'&&process.env.TEST_EMAIL_API_URL?process.env.TEST_EMAIL_API_URL:'https://api.brevo.com/v3/smtp/email';
    const site=process.env.RENDER_EXTERNAL_URL||process.env.PUBLIC_URL;
    const response=await fetch(api,{method:'POST',headers:{'content-type':'application/json','api-key':process.env.BREVO_API_KEY},body:JSON.stringify({sender:{name:'Sebastian Photos',email:process.env.BREVO_SENDER_EMAIL},to:[{email:process.env.NOTIFY_EMAIL}],subject:'New photography inquiry',textContent:`A new inquiry is waiting in your portfolio dashboard: ${site.replace(/\/$/,'')}/admin/`}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error(`Email provider returned ${response.status}`);
    await pool.query('UPDATE inquiries SET notification_sent_at=now() WHERE id=$1',[item.id]);
   }catch(e){console.error('Notification could not be sent:',e.message);break}
  }
 }catch(e){console.error('Notification queue unavailable:',e.code||e.message)}finally{processingNotifications=false}
}
app.use((req,res,next)=>{void processNotifications();next()});
setInterval(()=>void processNotifications(),300000).unref();
app.get('/api/content',async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await content())}catch(e){next(e)}});
app.get('/api/image/:id',async(req,res,next)=>{try{const result=await pool.query('SELECT image,mime FROM photos WHERE id=$1',[req.params.id]);const row=result.rows[0];if(!row?.image)return res.sendStatus(404);res.set({'Content-Type':row.mime,'Cache-Control':'public, max-age=86400'}).send(row.image)}catch(e){next(e)}});
app.post('/api/login',sameOrigin,limiter(15,15),async(req,res,next)=>{try{
 const lock=await pool.query(`INSERT INTO login_attempts (id,count,window_start) VALUES ('global',1,now())
 ON CONFLICT(id) DO UPDATE SET count=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.count+1 END,
 window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING count`);
 if(lock.rows[0].count>8)return bad(res,'Too many attempts. Wait 15 minutes and try again.',429);
 const password=String(req.body.password||'');const stored=await pool.query("SELECT value FROM settings WHERE key='password'");
 if(password.length<14||password.length>128||!await verifyPassword(password,stored.rows[0].value))return bad(res,'Password not recognized.',401);
 await pool.query("DELETE FROM login_attempts WHERE id='global'");await pool.query('DELETE FROM sessions WHERE expires_at<=now()');
 const token=randomBytes(32).toString('hex');await pool.query("INSERT INTO sessions VALUES ($1,now()+interval '7 days')",[hash(token)]);
 res.cookie('seb_admin',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:7*86400000}).set('Cache-Control','no-store').json({ok:true});
 }catch(e){next(e)}});
app.post('/api/logout',sameOrigin,authorized,async(req,res,next)=>{try{await pool.query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.cookies.seb_admin)]);res.clearCookie('seb_admin',{path:'/'}).json({ok:true})}catch(e){next(e)}});
app.get('/api/admin',authorized,async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await content())}catch(e){next(e)}});
app.get('/api/inquiries',authorized,async(req,res,next)=>{try{const result=await pool.query('SELECT id,name,email,package,message,created_at AS "createdAt" FROM inquiries ORDER BY created_at DESC LIMIT 500');res.set('Cache-Control','no-store').json(result.rows)}catch(e){next(e)}});
app.get('/api/email-status',authorized,async(req,res,next)=>{try{const result=await pool.query('SELECT count(*)::integer AS pending FROM inquiries WHERE notification_sent_at IS NULL');res.set('Cache-Control','no-store').json({configured:emailConfigured(),pending:result.rows[0].pending})}catch(e){next(e)}});
app.post('/api/contact',sameOrigin,limiter(5,15),async(req,res,next)=>{try{const name=text(req.body.name,120),email=text(req.body.email,254),message=text(req.body.message,6000),pkg=text(req.body.package,120);if(!name||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return bad(res,'Please enter your name, a valid email, and a message.');if(req.body.website)return res.json({ok:true});await pool.query('INSERT INTO inquiries (id,name,email,package,message) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),name,email,pkg,message]);void processNotifications();res.json({ok:true})}catch(e){next(e)}});
app.post('/api/admin',sameOrigin,authorized,upload.single('file'),async(req,res,next)=>{try{
 const f=req.body,action=f.action,id=String(f.id||'');
 if(action==='savePageCopy'){const copy={};for(const key of Object.keys(defaults.pageCopy)){const limit=key.endsWith('Title')?120:6000;if(String(f[key]||'').length>limit)return bad(res,'Page text is too long.');copy[key]=String(f[key]||'').trim()}await pool.query("UPDATE settings SET value=$1 WHERE key='page_copy'",[JSON.stringify(copy)])}
 else if(action==='savePackage'){const name=text(f.name,121),price=text(f.price,101),description=text(f.description,301),details=text(f.details,6001),category=String(f.category||''),position=Number(f.position||0);if(!idValid(id)||!packageCategories.includes(category)||!name||name.length>120||price.length>100||description.length>300||details.length>6000||!Number.isSafeInteger(position))return bad(res,'Please enter valid package details.');await pool.query(`INSERT INTO packages VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET category=excluded.category,name=excluded.name,price=excluded.price,description=excluded.description,details=excluded.details,position=excluded.position`,[id,category,name,price,description,details,position])}
 else if(action==='deletePackage'){if(!idValid(id))return bad(res,'Invalid item.');await pool.query('DELETE FROM packages WHERE id=$1',[id])}
 else if(action==='uploadPhoto'){const file=req.file,category=String(f.category||''),alt=text(f.alt,251),title=text(f.title,121);const b=file?.buffer;const valid=b&&(b.subarray(0,3).equals(Buffer.from([255,216,255]))||b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'));if(!file||!valid||!['image/jpeg','image/png','image/webp'].includes(file.mimetype)||!categories.includes(category)||!alt||alt.length>250||title.length>120)return bad(res,'Choose a JPG, PNG, or WebP photo and enter a description.');const photoId=randomUUID();await pool.query('INSERT INTO photos VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(position),-1)+1 FROM photos WHERE category=$5),$6,$7)',[photoId,`/api/image/${photoId}`,title,alt,category,b,file.mimetype])}
 else if(action==='savePhoto'){const category=String(f.category||''),alt=text(f.alt,251),title=text(f.title,121),position=Number(f.position||0);if(!idValid(id)||!categories.includes(category)||!alt||alt.length>250||title.length>120||!Number.isSafeInteger(position))return bad(res,'Enter a valid category and image description.');await pool.query('UPDATE photos SET title=$1,alt=$2,category=$3,position=$4 WHERE id=$5',[title,alt,category,position,id])}
 else if(action==='deletePhoto'){if(!idValid(id))return bad(res,'Invalid item.');await pool.query('DELETE FROM photos WHERE id=$1',[id])}
 else return bad(res,'Unknown action.');res.json({ok:true});
 }catch(e){next(e)}});
app.use('/api',(req,res)=>bad(res,'Not found.',404));
app.use(express.static(path.join(root,'dist'),{index:false}));
app.get('/{*path}',(req,res)=>res.sendFile(path.join(root,'dist','index.html')));
app.use((err,req,res,next)=>{console.error('Request failed:',err.code||err.message);if(err instanceof multer.MulterError)return bad(res,err.code==='LIMIT_FILE_SIZE'?'The photo is larger than 10 MB.':'Invalid upload.',400);res.status(500).json({error:'Something went wrong. Please try again.'})});
app.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('Portfolio server started.'));
