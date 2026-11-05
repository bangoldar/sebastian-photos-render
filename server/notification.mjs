export function notificationPayload(inquiry, {sender,recipient,site}){
 const body=`New photography inquiry\n\nName: ${inquiry.name}\nEmail: ${inquiry.email}\nPackage: ${inquiry.package||'Not specified'}\n\nMessage:\n${inquiry.message}\n\nReply to this email to respond to ${inquiry.name}.\n\nDashboard: ${site.replace(/\/$/,'')}/admin/`;
 return {sender:{name:'Sebastian Photos',email:sender},to:[{email:recipient}],replyTo:{email:inquiry.email},subject:'New photography inquiry',textContent:body};
}
