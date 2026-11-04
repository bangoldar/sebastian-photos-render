import {useState} from 'react';

export default function Contact(){
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const selected=new URLSearchParams(location.search).get('package')||'';
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;setBusy(true);setStatus('Sending your message…');
  try{const body=Object.fromEntries(new FormData(form).entries());const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not send your message.');form.reset();setStatus('Your message has been sent. Thank you!')}catch(error){setStatus(error instanceof Error?error.message:'Could not send your message. Please try again.')}finally{setBusy(false)}
 }
 return <main className="page wrap contact-page"><header className="page-header"><h1>Let’s talk<span>.</span></h1><p>Have a game, event, or idea in mind? I’d love to hear about it.</p></header><div className="contact-grid"><div><h2>Start a conversation</h2><p>Please include your preferred date, time, location, and the package you’re interested in so I can confirm availability and provide an accurate quote.</p><p>I’ll get back to you within 1–2 business days to confirm availability and go over the details of your booking.</p><a className="contact-email" href="mailto:sebphotosbc@gmail.com">sebphotosbc@gmail.com</a></div><div><h2>Send a message</h2><form className="contact-form" onSubmit={submit}><label>Name<input name="name" maxLength={120} autoComplete="name" required/></label><label>Email<input type="email" name="email" maxLength={254} autoComplete="email" required/></label><label>Package <small>(optional)</small><input name="package" defaultValue={selected} maxLength={120}/></label><label>Message<textarea name="message" rows={7} maxLength={6000} required placeholder="Tell me about your game or event."/></label><label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label><button className="button-dark" disabled={busy}>Send message</button><p role="status" aria-live="polite">{status}</p></form></div></div></main>
}
