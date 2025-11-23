// index.js - Global Random Chat Backend API Server
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// -------------------- 메모리 저장소 --------------------
const users = new Map();      // userId -> { email, password, gender, country, nickname }
const emailToUserId = new Map();
const matches = new Map();    // matchId -> { users:[u1,u2], messages:[], createdAt, active }
const waitingQueue = [];      // [{ userId, preferredCountry, preferredGender }]
const messages = [];          // 전체 메시지 로그 (필요시)
const blocks = new Set();     // `${userId}:${targetId}`
const reports = [];           // 신고 로그

// -------------------- 유틸 --------------------
function isBlocked(userA, userB) {
  return blocks.has(`${userA}:${userB}`) || blocks.has(`${userB}:${userA}`);
}

function getUserInfo(userId) {
  const user = users.get(userId);
  if (!user) return null;
  return {
    userId: user.userId,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    country: user.country
  };
}

// -------------------- 인증 API --------------------

// 회원가입
app.post('/auth/signup', (req, res) => {
  const { email, password, nickname, gender, country } = req.body;

  if (!email || !password || !nickname) {
    return res.status(400).json({ error: 'email, password, nickname 필수' });
  }
  if (emailToUserId.has(email)) {
    return res.status(400).json({ error: '이미 존재하는 이메일' });
  }

  const userId = uuidv4();
  const user = {
    userId,
    email,
    password,
    nickname: nickname || 'User',
    gender: gender || 'other',
    country: country || 'KR',
    createdAt: new Date().toISOString()
  };

  users.set(userId, user);
  emailToUserId.set(email, userId);

  console.log(`[회원가입] ${email} -> ${userId}`);

  return res.json({
    success: true,
    user: {
      id: userId,
      email: user.email,
      nickname: user.nickname,
      gender: user.gender,
      country: user.country,
      created_at: user.createdAt
    }
  });
});

// 로그인
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;

  const userId = emailToUserId.get(email);
  if (!userId) return res.status(400).json({ success: false, error: '존재하지 않는 계정' });

  const user = users.get(userId);
  if (user.password !== password) {
    return res.status(400).json({ success: false, error: '비밀번호 불일치' });
  }

  console.log(`[로그인] ${email} -> ${userId}`);

  return res.json({
    success: true,
    user: {
      id: userId,
      email: user.email,
      nickname: user.nickname,
      gender: user.gender,
      country: user.country,
      created_at: user.createdAt
    }
  });
});

// 로그아웃 (더미)
app.post('/auth/logout', (req, res) => {
  console.log('[로그아웃] 요청');
  return res.json({ success: true });
});

// -------------------- 매칭 API --------------------

// 매칭 시작
app.post('/match/start', (req, res) => {
  const { user_id, preferred_country, preferred_gender } = req.body;
  const userId = user_id;
  const preferredCountry = preferred_country;
  const preferredGender = preferred_gender;

  const me = users.get(userId);
  if (!me) return res.status(400).json({ success: false, error: '잘못된 userId' });

  // 이미 큐에 있으면 제거
  const idx = waitingQueue.findIndex(w => w.userId === userId);
  if (idx >= 0) waitingQueue.splice(idx, 1);

  // 큐에서 조건에 맞는 상대 찾기
  let partnerIndex = -1;
  for (let i = 0; i < waitingQueue.length; i++) {
    const candidate = waitingQueue[i];
    const other = users.get(candidate.userId);
    if (!other) continue;

    // 서로 차단 여부
    if (isBlocked(userId, candidate.userId)) continue;

    // 상대가 원하는 조건 고려
    const myGenderOk =
      !candidate.preferredGender || candidate.preferredGender === 'any' || candidate.preferredGender === me.gender;
    const myCountryOk =
      !candidate.preferredCountry || candidate.preferredCountry === 'any' || candidate.preferredCountry === me.country;

    const otherGenderOk =
      !preferredGender || preferredGender === 'any' || preferredGender === other.gender;
    const otherCountryOk =
      !preferredCountry || preferredCountry === 'any' || preferredCountry === other.country;

    if (myGenderOk && myCountryOk && otherGenderOk && otherCountryOk) {
      partnerIndex = i;
      break;
    }
  }

  if (partnerIndex === -1) {
    // 못 찾으면 큐에 넣고 대기
    waitingQueue.push({ userId, preferredCountry, preferredGender });
    console.log(`[매칭 대기] ${me.nickname} (${userId})`);
    return res.json({ success: true, status: 'waiting' });
  }

  const partner = waitingQueue.splice(partnerIndex, 1)[0];
  const partnerUser = users.get(partner.userId);

  const matchId = uuidv4();
  const match = {
    id: matchId,
    user_id: userId,
    partner_id: partner.userId,
    partner_nickname: partnerUser.nickname,
    partner_country: partnerUser.country,
    partner_gender: partnerUser.gender,
    status: 'matched',
    created_at: new Date().toISOString(),
    users: [userId, partner.userId],
    messages: [],
    active: true
  };
  matches.set(matchId, match);

  console.log(`[매칭 성공] ${me.nickname} <-> ${partnerUser.nickname}`);

  return res.json({
    success: true,
    match: match
  });
});

// 최근 매칭 기록
app.get('/match/recent', (req, res) => {
  const userId = req.query.user_id;
  const list = [];
  
  for (const m of matches.values()) {
    if (m.users.includes(userId)) {
      const partnerId = m.users.find(id => id !== userId);
      const partner = users.get(partnerId);
      
      list.push({
        id: m.id,
        user_id: userId,
        partner_id: partnerId,
        partner_nickname: partner ? partner.nickname : 'Unknown',
        partner_country: partner ? partner.country : 'KR',
        partner_gender: partner ? partner.gender : 'other',
        status: m.active ? 'matched' : 'ended',
        created_at: m.created_at,
        ended_at: m.active ? null : m.ended_at
      });
    }
  }
  
  list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return res.json(list.slice(0, 20));
});

// 매칭 종료
app.post('/match/end', (req, res) => {
  const { match_id } = req.body;
  const m = matches.get(match_id);
  if (!m) return res.status(400).json({ success: false, error: '잘못된 matchId' });
  
  m.active = false;
  m.ended_at = new Date().toISOString();
  
  console.log(`[매칭 종료] ${match_id}`);
  return res.json({ success: true });
});

// 신고
app.post('/match/report', (req, res) => {
  const { match_id, reported_user_id, reason } = req.body;
  
  reports.push({
    id: uuidv4(),
    match_id,
    reported_user_id,
    reason,
    created_at: new Date().toISOString()
  });
  
  console.log(`[신고] matchId: ${match_id}, target: ${reported_user_id}`);
  return res.json({ success: true });
});

// -------------------- 사용자 / 차단 API --------------------

app.post('/user/block', (req, res) => {
  const { user_id, blocked_user_id } = req.body;
  
  if (!user_id || !blocked_user_id) {
    return res.status(400).json({ success: false, error: 'user_id, blocked_user_id 필요' });
  }
  
  blocks.add(`${user_id}:${blocked_user_id}`);
  console.log(`[차단] ${user_id} -> ${blocked_user_id}`);
  
  return res.json({ success: true });
});

// -------------------- 채팅 API --------------------

// 메시지 전송
app.post('/chat/send', (req, res) => {
  const { match_id, sender_id, message, auto_translate } = req.body;
  
  const match = matches.get(match_id);
  if (!match || !match.active) {
    return res.status(400).json({ success: false, error: '유효하지 않은 matchId' });
  }
  
  if (!match.users.includes(sender_id)) {
    return res.status(400).json({ success: false, error: '이 매치의 참여자가 아님' });
  }

  const msg = {
    id: uuidv4(),
    match_id,
    sender_id,
    message,
    translated_message: auto_translate ? `[번역] ${message}` : null,
    timestamp: new Date().toISOString(),
    is_read: false
  };

  match.messages.push(msg);
  messages.push(msg);

  console.log(`[메시지] ${sender_id}: ${message}`);

  return res.json({
    success: true,
    message: msg
  });
});

// 메시지 조회
app.get('/chat/messages', (req, res) => {
  const matchId = req.query.match_id;
  const match = matches.get(matchId);
  
  if (!match) {
    return res.status(400).json({ success: false, error: '잘못된 matchId' });
  }
  
  return res.json(match.messages || []);
});

// 번역 (더미: 그대로 반환 + 접두사)
app.post('/translate', (req, res) => {
  const { message, target_language } = req.body;
  
  // TODO: 실제 배포시 Google Translate 등 연동
  return res.json({
    translated_message: `[${target_language}] ${message}`
  });
});

// -------------------- 헬스체크 & 상태 --------------------

app.get('/', (req, res) => {
  res.json({
    service: 'RandomChat Backend API',
    version: '1.0.0',
    status: 'running',
    stats: {
      users: users.size,
      matches: matches.size,
      waiting: waitingQueue.length,
      messages: messages.length
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║  🌍 Global Random Chat Backend API Server        ║
║  🚀 Server running on port ${PORT}                   ║
║  📡 Ready to accept connections                   ║
╚═══════════════════════════════════════════════════╝
  `);
});
