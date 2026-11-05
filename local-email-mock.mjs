import http from 'node:http';
let count=0;
http.createServer(async(req,res)=>{
 if(req.method==='GET'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({count}))}
 let body='';for await(const chunk of req)body+=chunk;
 const email=JSON.parse(body);
 if(req.headers['api-key']!=='test-key'||email.to?.[0]?.email!=='recipient@example.invalid'||!email.textContent.includes('/admin/')){res.statusCode=400;return res.end()}
 if(email.replyTo?.email!=='local-test@example.invalid'||!['Local Test','local-test@example.invalid','Standard','A local test inquiry'].every(value=>email.textContent.includes(value))){res.statusCode=400;return res.end()}
 count++;res.statusCode=201;res.end('{}');
}).listen(Number(process.env.TEST_PORT||4180),'127.0.0.1',()=>console.log('Local email mock ready.'));
