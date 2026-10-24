import { chromium } from 'playwright'

const boards = [
  { slug:'announcements', name:'Announcements', blurb:'What Kobblon is doing, said by the people doing it.', kind:'plain', staff_only:true, topic_count:12, post_count:340, last_post_at:new Date(Date.now()-3.6e6).toISOString(), last_title:'The Launcher beta, and who gets in first', last_topic_id:3, last_author:'Staw', last_author_avatar:null },
  { slug:'community-creations', name:'Community creations', blurb:'Worlds, items, art and whatever else you made. Show it here.', kind:'plain', staff_only:false, topic_count:218, post_count:1904, last_post_at:new Date(Date.now()-9e5).toISOString(), last_title:'I rebuilt the whole station in 2D', last_topic_id:7, last_author:'imCooki3', last_author_avatar:null },
  { slug:'feedback-and-suggestions', name:'Feedback and suggestions', blurb:'Ideas for Kobblon, and the things that are wrong with it.', kind:'both', staff_only:false, topic_count:143, post_count:2201, last_post_at:new Date(Date.now()-4.2e6).toISOString(), last_title:'Let a World belong to a Community', last_topic_id:11, last_author:'VAsyan', last_author_avatar:null },
  { slug:'help-and-support', name:'Help and support', blurb:'Stuck on something? Ask, and somebody who knows will answer.', kind:'bugs', staff_only:false, topic_count:402, post_count:3310, last_post_at:new Date(Date.now()-3e5).toISOString(), last_title:'My door will not open when I touch it', last_topic_id:1, last_author:'Pixelhead', last_author_avatar:null },
  { slug:'building-and-scripting', name:'Building and scripting', blurb:'Making Worlds: the engine, the Workspace, and how to do the hard part.', kind:'plain', staff_only:false, topic_count:171, post_count:1488, last_post_at:new Date(Date.now()-7.2e6).toISOString(), last_title:'A pattern for lifts that do not drop you', last_topic_id:5, last_author:'Brickk', last_author_avatar:null },
  { slug:'off-topic', name:'Off topic', blurb:'Everything else, within the Guidelines.', kind:'plain', staff_only:false, topic_count:96, post_count:770, last_post_at:new Date(Date.now()-1.1e7).toISOString(), last_title:'What are you listening to while you build', last_topic_id:9, last_author:'Noodle', last_author_avatar:null },
]

const who = (n, name, opts={}) => ({
  author_id:`0000000${n}-0000-0000-0000-00000000000${n}`, author_username:name.toLowerCase(),
  author_name:name, author_avatar:null, author_is_verified:!!opts.v,
  author_is_admin:!!opts.a, author_is_moderator:!!opts.m,
})

const topic = (id, title, body, cat, catName, o={}) => ({
  id, category:cat, category_name:catName, category_kind:o.kind ?? 'plain',
  title, body, images:[], status:o.status ?? 'open', status_at:o.status?new Date().toISOString():null,
  status_by_name:o.status?'Staw':null,
  is_pinned:!!o.pinned, is_locked:!!o.locked, is_removed:false,
  view_count:o.views ?? 1240, reply_count:o.replies ?? 14, like_count:o.likes ?? 9,
  answer_id:o.answer ?? null, last_post_at:new Date(Date.now()-(o.ago ?? 3e6)).toISOString(),
  created_at:new Date(Date.now()-8.6e7).toISOString(), edited_at:null, liked:false,
  ...who(o.n ?? 1, o.by ?? 'Pixelhead', o),
})

const topics = [
  topic(1,'My door will not open when I touch it','I have a door in my World and the touch handler fires but nothing moves. Here is what I have tried so far, and the script is below.','help-and-support','Help and support',{kind:'bugs',status:'solved',replies:23,views:8402,likes:31,answer:101,n:1}),
  topic(11,'Let a World belong to a Community','Right now a World belongs to a person. Half the point of a Community is building together, so it should be able to hold one.','feedback-and-suggestions','Feedback and suggestions',{kind:'both',status:'approved',by:'VAsyan',n:2,v:true,replies:88,views:12044,likes:142,ago:4.2e6}),
  topic(7,'I rebuilt the whole station in 2D','Six weeks, one tileset, far too much coffee. Screenshots inside, and the file is free to take apart.','community-creations','Community creations',{by:'imCooki3',n:3,v:true,replies:41,views:9330,likes:97,ago:9e5}),
  topic(3,'The Launcher beta, and who gets in first','We are letting the first thousand accounts in next week. Here is how it will work and what is still missing.','announcements','Announcements',{by:'Staw',n:4,a:true,pinned:true,replies:210,views:41200,likes:388,ago:3.6e6}),
  topic(12,'Chat eats the first message after a reconnect','Reproducible: drop the connection, come back, type. The first line never lands.','feedback-and-suggestions','Feedback and suggestions',{kind:'both',status:'looked-at',by:'Brickk',n:5,replies:7,views:1102,likes:12,ago:2e6}),
  topic(9,'What are you listening to while you build','Mine is the same four albums on a loop. Go.','off-topic','Off topic',{by:'Noodle',n:6,replies:132,views:5400,likes:28,ago:1.1e7}),
]

const replies = [
  { id:101, topic_id:1, body:'Your handler is on the model and not on the part. Move it down one level and it fires.\n\nIf that does not do it, check that the door is anchored - an unanchored door will fight the tween.', images:[], reply_to:null, reply_to_name:null, is_removed:false, like_count:44, created_at:new Date(Date.now()-7e6).toISOString(), edited_at:null, is_answer:true, liked:false, ...who(4,'Staw',{a:true}) },
  { id:102, topic_id:1, body:'Had the same thing last week. The anchor was it for me.', images:[], reply_to:101, reply_to_name:'Staw', is_removed:false, like_count:6, created_at:new Date(Date.now()-5e6).toISOString(), edited_at:null, is_answer:false, liked:false, ...who(3,'imCooki3',{v:true}) },
  { id:103, topic_id:1, body:'Thank you both, that was exactly it.', images:[], reply_to:null, reply_to_name:null, is_removed:false, like_count:2, created_at:new Date(Date.now()-3e6).toISOString(), edited_at:null, is_answer:false, liked:false, ...who(1,'Pixelhead') },
]

const json = (body) => ({ status:200, contentType:'application/json', body:JSON.stringify(body) })

const [url, out, w, h] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width:+w, height:+h } })
await p.route('**/rest/v1/rpc/forum_boards*', (r) => r.fulfill(json(boards)))
await p.route('**/rest/v1/rpc/forum_topics_list*', async (r) => {
  const sent = JSON.parse(r.request().postData() || '{}')
  let rows = topics
  if (sent.in_category) rows = rows.filter((t) => t.category === sent.in_category)
  r.fulfill(json(rows.slice(0, sent.in_limit ?? 20)))
})
await p.route('**/rest/v1/rpc/forum_topic', (r) => r.fulfill(json([topics[0]])))
await p.route('**/rest/v1/rpc/forum_replies*', (r) => r.fulfill(json(replies)))
await p.route('**/rest/v1/rpc/forum_seen*', (r) => r.fulfill(json(null)))
await p.route('**/rest/v1/rpc/platform_stats*', (r) => r.fulfill(json([{published_spaces:184,total_visits:51230,total_accounts:2140,people_online:37}])))
await p.goto(url, { waitUntil:'load' }).catch(() => {})
await p.waitForTimeout(9000)
const y = Number(process.argv[6] || 0)
if (y) { await p.evaluate((n) => window.scrollTo(0, n), y); await p.waitForTimeout(900) }
await p.screenshot({ path: out })
await b.close()
