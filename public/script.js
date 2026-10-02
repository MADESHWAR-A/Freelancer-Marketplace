const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let currentUser = null;
let chatSocket = null;
let activeChatUserId = null;

// When opened through VS Code Live Server, the HTML is usually on :5500
// while Express runs on :3000. When opened from Express or a public tunnel,
// relative URLs are used so deployment remains same-origin.
const API_BASE = (() => {
  const h = location.hostname;
  const p = Number(location.port || (location.protocol === "https:" ? 443 : 80));
  const isLocal = h === "localhost" || h === "127.0.0.1";
  return isLocal && p !== 3000 ? `http://${h}:3000` : "";
})();

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function wsUrl(path) {
  if (API_BASE) {
    return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}:3000${path}`;
  }
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${path}`;
}

function toast(message, type = "success") {
  const root = $("#toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl(url), {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: controller.signal,
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || data.message || `Request failed (HTTP ${response.status})`;
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Request timed out. Make sure the Workly server is running.");
    if (error instanceof TypeError) throw new Error('Unable to reach the Workly server. Start the Express server with "npm start" and open http://localhost:3000 (or use Live Server with the backend running on port 3000).');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function openModal(id) { $(`#${id}`)?.classList.remove("hidden"); }
function closeModal(id) { $(`#${id}`)?.classList.add("hidden"); }

function initParticles() {
  const canvas = $("#particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const nodes = [];
  const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); };
  const count = Math.min(55, Math.floor(innerWidth / 25));
  resize();
  for (let i=0;i<count;i++) nodes.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25});
  addEventListener("resize", resize);
  function frame() {
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if(n.x<0||n.x>innerWidth)n.vx*=-1;
      if(n.y<0||n.y>innerHeight)n.vy*=-1;
      ctx.beginPath();ctx.arc(n.x,n.y,1.4,0,Math.PI*2);ctx.fillStyle="rgba(56,189,248,.5)";ctx.fill();
    }
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d<130){ctx.strokeStyle=`rgba(56,189,248,${.12*(1-d/130)})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    }
    requestAnimationFrame(frame);
  }
  frame();
}

async function guard(role) {
  try {
    const { user } = await api("/api/auth/me");
    currentUser = user;
    if (role && user.role !== role) {
      location.href = user.role === "client" ? "client-dashboard.html" : "freelancer-dashboard.html";
      return false;
    }
    $("#userName") && ($("#userName").textContent = user.name);
    return true;
  } catch {
    location.href = "auth.html";
    return false;
  }
}

async function initAuth() {
  $$('[data-demo-login]').forEach(button => {
    button.addEventListener('click', () => {
      const form = $('#loginForm');
      form.email.value = button.dataset.demoEmail;
      form.password.value = button.dataset.demoPassword;
      form.role.value = button.dataset.demoRole;
      $$('[data-auth-tab]').forEach(x => x.classList.remove('active'));
      $('[data-auth-tab="login"]')?.classList.add('active');
      form.classList.remove('hidden');
      $('#registerForm')?.classList.add('hidden');
      toast(`${button.dataset.demoRole === 'client' ? 'Client' : 'Freelancer'} demo credentials filled`, 'success');
    });
  });

  try {
    const { user } = await api("/api/auth/me");
    location.href = user.role === "client" ? "client-dashboard.html" : "freelancer-dashboard.html";
    return;
  } catch {}
  $$("[data-auth-tab]").forEach(tab => tab.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach(x => x.classList.remove("active"));
    tab.classList.add("active");
    $("#loginForm").classList.toggle("hidden", tab.dataset.authTab !== "login");
    $("#registerForm").classList.toggle("hidden", tab.dataset.authTab !== "register");
  }));

  $("#loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const data = formDataObject(e.currentTarget);
      const { user } = await api("/api/auth/login", { method:"POST", body:JSON.stringify(data) });
      location.href = user.role === "client" ? "client-dashboard.html" : "freelancer-dashboard.html";
    } catch (err) { toast(err.message, "error"); }
  });

  $("#registerForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const { user } = await api("/api/auth/register", { method:"POST", body:JSON.stringify(formDataObject(e.currentTarget)) });
      location.href = user.role === "client" ? "client-dashboard.html" : "freelancer-dashboard.html";
    } catch (err) { toast(err.message, "error"); }
  });
}

function setupCommon() {
  $("#logoutBtn")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method:"POST" }).catch(()=>{});
    location.href = "auth.html";
  });
  $$("[data-close]").forEach(btn => btn.addEventListener("click", () => closeModal(btn.dataset.close)));
  $$(".modal").forEach(m => m.addEventListener("click", e => { if(e.target === m) m.classList.add("hidden"); }));
}

async function loadClient() {
  if (!(await guard("client"))) return;
  setupCommon();

  const projectsEl = $("#clientProjects");
  projectsEl.classList.add("loading");
  try {
    const { projects } = await api("/api/projects/my-projects");
    projectsEl.classList.remove("loading");
    $("#activeCount").textContent = projects.filter(p=>p.status==="open").length;
    $("#bidCount").textContent = projects.reduce((n,p)=>n+Number(p.proposal_count||0),0);
    $("#progressCount").textContent = projects.filter(p=>p.status==="in_progress").length;
    projectsEl.innerHTML = projects.length ? projects.map(projectCardClient).join("") : `<div class="project-card"><p>No projects yet. Post your first project.</p></div>`;
    $$(".proposal-view").forEach(b => b.addEventListener("click", () => loadProposals(b.dataset.id)));
  } catch (err) { projectsEl.classList.remove("loading"); toast(err.message,"error"); }

  $("#openProjectModal")?.addEventListener("click",()=>openModal("projectModal"));
  $("#projectForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await api("/api/projects",{method:"POST",body:JSON.stringify(formDataObject(e.currentTarget))});
      closeModal("projectModal"); e.currentTarget.reset(); toast("Project published successfully"); loadClient();
    } catch(err){toast(err.message,"error")}
  });

  const p = currentUser;
  const form = $("#clientProfileForm");
  form.company_name.value=p.company_name||""; form.bio.value=p.bio||""; form.portfolio_url.value=p.portfolio_url||"";
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    try{await api("/api/users/profile",{method:"PUT",body:JSON.stringify({...formDataObject(e.currentTarget),skills:p.skills||"",hourly_rate:p.hourly_rate||0})});toast("Profile updated");}
    catch(err){toast(err.message,"error")}
  });

  bindChat();
}

function projectCardClient(p){
  return `<article class="project-card"><div class="row-between"><div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div><strong>$${Number(p.budget).toLocaleString()}</strong></div><div class="meta">${chips(p.skills_required)}<span class="chip">${esc(p.status)}</span></div><div class="row-between"><small class="muted">${Number(p.proposal_count)} proposal(s)</small><button class="btn btn-ghost proposal-view" data-id="${p.id}">View proposals</button></div></article>`;
}

async function loadProposals(projectId){
  try{
    const {proposals}=await api(`/api/projects/${projectId}/proposals`);
    $("#proposalList").innerHTML=proposals.length?proposals.map(p=>`
      <article class="project-card"><div class="row-between"><div><h3>${esc(p.freelancer_name)}</h3><p>${esc(p.cover_letter)}</p></div><strong>$${Number(p.bid_amount).toLocaleString()}</strong></div>
      <div class="meta"><span class="chip">${p.delivery_days} days</span>${chips(p.skills)}</div>
      <div class="actions">
        <button class="btn btn-primary proposal-status" data-id="${p.id}" data-status="accepted">Accept</button>
        <button class="btn btn-ghost proposal-status" data-id="${p.id}" data-status="rejected">Reject</button>
        <button class="btn btn-ghost chat-start" data-user="${p.freelancer_id}">Chat</button>
      </div></article>`).join("") : `<p class="muted">No proposals received yet.</p>`;
    openModal("proposalModal");
    $$(".proposal-status").forEach(b=>b.onclick=async()=>{try{await api(`/api/projects/proposals/${b.dataset.id}/status`,{method:"PUT",body:JSON.stringify({status:b.dataset.status})});toast(`Proposal ${b.dataset.status}`);closeModal("proposalModal");loadClient();}catch(e){toast(e.message,"error")}});
    $$(".chat-start").forEach(b=>b.onclick=()=>openChat(Number(b.dataset.user)));
  }catch(e){toast(e.message,"error")}
}

async function loadFreelancer(){
  if (!(await guard("freelancer"))) return;
  setupCommon();
  const feed=$("#projectFeed"); feed.classList.add("loading");
  try{
    const [{projects},{proposals}]=await Promise.all([api("/api/projects"),api("/api/proposals/my-bids")]);
    feed.classList.remove("loading");
    $("#openCount").textContent=projects.length;$("#proposalCount").textContent=proposals.length;$("#acceptedCount").textContent=proposals.filter(p=>p.status==="accepted").length;
    feed.innerHTML=projects.length?projects.map(projectCardFreelancer).join(""):`<div class="project-card"><p>No open projects right now.</p></div>`;
    $("#myBids").innerHTML=proposals.length?proposals.map(p=>`<article class="project-card"><div class="row-between"><div><h3>${esc(p.project_title)}</h3><p>${esc(p.cover_letter)}</p></div><strong>$${Number(p.bid_amount).toLocaleString()}</strong></div><div class="meta"><span class="chip">${esc(p.status)}</span><span class="chip">${p.delivery_days} days</span><span class="chip">Client: ${esc(p.client_name)}</span></div></article>`).join(""):`<p class="muted">No proposals submitted yet.</p>`;
    $$(".proposal-start").forEach(b=>b.onclick=()=>{$("#proposalProjectId").value=b.dataset.id;openModal("proposalModal")});
    $$(".chat-start").forEach(b=>b.onclick=()=>openChat(Number(b.dataset.user)));
  }catch(e){feed.classList.remove("loading");toast(e.message,"error")}

  const p=currentUser, form=$("#freelancerProfileForm");
  form.skills.value=p.skills||"";form.hourly_rate.value=p.hourly_rate||0;form.bio.value=p.bio||"";form.portfolio_url.value=p.portfolio_url||"";form.company_name.value=p.company_name||"";
  form.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/users/profile",{method:"PUT",body:JSON.stringify(formDataObject(e.currentTarget))});toast("Profile updated");}catch(err){toast(err.message,"error")}});

  $("#proposalForm")?.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/proposals",{method:"POST",body:JSON.stringify(formDataObject(e.currentTarget))});closeModal("proposalModal");e.currentTarget.reset();toast("Proposal submitted successfully");loadFreelancer()}catch(err){toast(err.message,"error")}})
  bindChat();
}

function projectCardFreelancer(p){
  return `<article class="project-card"><div class="row-between"><div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div><strong>$${Number(p.budget).toLocaleString()}</strong></div><div class="meta">${chips(p.skills_required)}<span class="chip">${Number(p.proposal_count)} bid(s)</span></div><div class="row-between"><small class="muted">Client: ${esc(p.client_name)}</small><div class="actions"><button class="btn btn-primary proposal-start" data-id="${p.id}">Submit proposal</button><button class="btn btn-ghost chat-start" data-user="${p.client_id}">Chat</button></div></div></article>`;
}

function chips(text=""){return String(text).split(",").map(s=>s.trim()).filter(Boolean).map(s=>`<span class="chip">${esc(s)}</span>`).join("")}
function esc(v=""){const d=document.createElement("div");d.textContent=v;return d.innerHTML}

async function openChat(userId){
  activeChatUserId=userId;openModal("chatModal");
  const box=$("#chatMessages");box.innerHTML="<p class='muted'>Loading history…</p>";
  try{
    const {messages}=await api(`/api/messages/${userId}`);
    renderMessages(messages);
    if(chatSocket)chatSocket.close();
    const protocol=location.protocol==="https:"?"wss":"ws";
    chatSocket=new WebSocket(wsUrl(`/ws/chat/${currentUser.id}`));
    chatSocket.onopen = () => {
      toast("Live chat connected", "success");
    };
    chatSocket.onerror = () => {
      toast("Live chat connection failed. Check the server or tunnel.", "error");
    };
    chatSocket.onclose = () => {
      // Closing a chat is normal; no toast is needed here.
    };
    chatSocket.onmessage=e=>{
      try {
        const packet=JSON.parse(e.data);
        if(packet.type==="message" && (Number(packet.message.sender_id)===Number(activeChatUserId) || Number(packet.message.receiver_id)===Number(activeChatUserId))) {
          renderMessages([packet.message],true);
        }
        if(packet.type==="error") toast(packet.error || "Chat error", "error");
      } catch {
        toast("Received an invalid chat response", "error");
      }
    };
  }catch(e){toast(e.message,"error")}
}

function renderMessages(messages,append=false){
  const box=$("#chatMessages");if(!append)box.innerHTML="";
  for(const m of messages){const div=document.createElement("div");div.className=`bubble ${Number(m.sender_id)===Number(currentUser.id)?"mine":""}`;div.textContent=m.content;box.appendChild(div)}
  box.scrollTop=box.scrollHeight;
}
function bindChat(){
  $("#chatForm")?.addEventListener("submit",e=>{
    e.preventDefault();const input=$("#chatText");const content=input.value.trim();
    if(!content||!chatSocket||chatSocket.readyState!==1)return;
    chatSocket.send(JSON.stringify({sender_id:currentUser.id,receiver_id:activeChatUserId,content}));input.value="";
    const mine={sender_id:currentUser.id,receiver_id:activeChatUserId,content};renderMessages([mine],true);
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  initParticles();
  const page=document.body.dataset.page;
  if(page==="auth")initAuth();
  if(page==="client")loadClient();
  if(page==="freelancer")loadFreelancer();
});
function updateTime() {
    const now = new Date();

    const time = now.toLocaleTimeString();

    document.getElementById("time").textContent = time;
}

updateTime();
setInterval(updateTime, 1000);