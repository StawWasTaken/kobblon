import { chromium } from 'playwright'
const j = (body) => ({ status:200, contentType:'application/json', body: JSON.stringify(body) })
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.route('**/rest/v1/rpc/forum_boards*', (r) => r.fulfill(j([{ slug:'help-and-support', name:'Help and support', blurb:'x', kind:'bugs', staff_only:false, topic_count:1, post_count:1, last_post_at:null, last_title:null, last_topic_id:null, last_author:null, last_author_avatar:null }])))
await p.route('**/rest/v1/rpc/forum_topics_list*', (r) => r.fulfill(j([])))
await p.route('**/rest/v1/rpc/forum_topic', (r) => r.fulfill(j([{ id:1, category:'help-and-support', category_name:'Help and support', category_kind:'bugs', title:'My door will not open when I touch it', body:'x', images:[], status:'open', is_pinned:false, is_locked:false, is_removed:false, view_count:1, reply_count:0, like_count:0, answer_id:null, last_post_at:new Date().toISOString(), created_at:new Date().toISOString(), edited_at:null, liked:false, author_id:'a', author_name:'Pixelhead', author_username:'pixelhead', author_avatar:null, author_is_verified:false, author_is_admin:false, author_is_moderator:false }])))
await p.route('**/rest/v1/rpc/forum_replies*', (r) => r.fulfill(j([])))
await p.route('**/rest/v1/rpc/forum_seen*', (r) => r.fulfill(j(null)))
for (const [path, label] of [['/forum','index'],['/forum/c/help-and-support','board'],['/forum/t/1','thread'],['/forum/new','new']]) {
  await p.goto('http://localhost:4190' + path, { waitUntil:'load' }).catch(()=>{})
  await p.waitForTimeout(3500)
  console.log(label.padEnd(7), '->', await p.title())
}
await b.close()
