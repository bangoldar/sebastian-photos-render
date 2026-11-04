export const defaults = [
 {id:'standard',category:'single',name:'Standard',price:'$50',description:'Single player',details:'1 player\n35–45 professionally edited photos\n1 game coverage\n1–3 day digital delivery',position:0},
 {id:'premium',category:'single',name:'Premium',price:'$65',description:'Single player',details:'1 player\n55+ professionally edited photos\nFull game coverage\nPriority editing and digital delivery within 1–2 days',position:1},
 {id:'basic-group',category:'group',name:'Basic Group',price:'$80',description:'Group',details:'Up to 4 players\n10–15 edited photos per player\n1 game coverage\nIndividual moments for each player\n3–5 day digital delivery',position:2},
 {id:'team',category:'group',name:'Team',price:'$130',description:'Group',details:'Up to 8 players\n10–15 edited photos per player\nFull game coverage\nIndividual and group photos\nCelebrations and key moments\n3–7 day digital delivery',position:3},
 {id:'full-team',category:'group',name:'Full Team',price:'$200',description:'Soccer teams',details:'Designed for soccer teams. For other sports, please inquire.\nFull team coverage\n10+ edited photos per player\nFull game/session coverage\nIndividual action photos\nTeam and group photos\nCandid moments and celebrations\nPriority editing and delivery',position:4},
 {id:'add-ons',category:'addons',name:'Add-ons',price:'',description:'Make it your own',details:'Rush delivery — $15\n15 extra edited photos — $15\nExtended coverage (30 minutes) — $25\nAdditional player — $30 (group packages only)',position:5},
];
export const packageCategories = ['single','group','addons'] as const;
export const categories = ['Soccer','Basketball','Creative','Hockey'] as const;
const counts: Record<string,number> = {Soccer:32,Basketball:16,Creative:16,Hockey:12};
const folders: Record<string,string> = {Soccer:'portofolio',Basketball:'basketball',Creative:'creative',Hockey:'hockey'};
export const defaultPhotos = categories.flatMap((category) => Array.from({length:counts[category]},(_,i)=>({id:`${folders[category]}-${i}`, objectKey:`/photos/${folders[category]}-${i}.webp`, title:'', alt:`${category} photography by Sebastian Calle Perez`,category,position:i})));
export type Photo = typeof defaultPhotos[number];
export type Package = typeof defaults[number];

export const defaultPageCopy = {
 groupTitle:'Team Package',
 groupText:'The Full Team Package is designed specifically for soccer teams. If you are a hockey, basketball, or other sports team, please reach out through the Contact section of the website so we can discuss a package that fits your team’s needs.',
 eventsTitle:'Events',
 eventsText:'For event photography, tournaments, graduations, or other special occasions, please email (sebphotosbc@gmail.com) or DM me to discuss availability and pricing. Packages can be customized to suit your event and specific needs!\n\nA small transportation fee may apply depending on the location. If none of our packages perfectly fits your needs, feel free to reach out! We’d be happy to create a customized package tailored to your specific occasion.',
 bookingTitle:'Ready to Book?',
 bookingText:'Interested in booking a photography package? Head over to the Contact section of the website and send me a message with the package you’re interested in.\n\nWhen contacting me, please include your preferred date, time, and location so I can confirm availability and provide an accurate quote.\n\nPlease note that additional fees may apply depending on the location, such as transportation or travel fees.\n\nI’ll get back to you within 1–2 business days to confirm availability and go over the details of your booking.',
};
export type PageCopy = typeof defaultPageCopy;
