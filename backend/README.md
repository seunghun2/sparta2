# Global Random Chat Backend API

Node.js + Express 기반 랜덤 채팅 앱 백엔드 서버

## 🚀 배포 방법 (Railway)

### 1단계: GitHub 저장소 생성
```bash
cd randomchat-backend
git init
git add .
git commit -m "Initial commit: Random Chat Backend"
git remote add origin https://github.com/YOUR_USERNAME/randomchat-backend.git
git push -u origin main
```

### 2단계: Railway 배포
1. [Railway](https://railway.app) 접속
2. **"New Project"** 클릭
3. **"Deploy from GitHub"** 선택
4. 저장소 연결: `randomchat-backend`
5. 자동 배포 완료 대기
6. 생성된 URL 확인 (예: `https://randomchat-backend-production.up.railway.app`)

### 3단계: Flutter 앱 연결
Flutter 앱의 서비스 파일에서 API URL 변경:

```dart
// lib/services/auth_service.dart
static const String apiBaseUrl = 'https://YOUR-RAILWAY-URL.up.railway.app';
```

## 📡 API 엔드포인트

### 인증 API
- `POST /auth/signup` - 회원가입
- `POST /auth/login` - 로그인
- `POST /auth/logout` - 로그아웃

### 매칭 API
- `POST /match/start` - 매칭 시작
- `GET /match/recent?user_id={id}` - 최근 매칭 목록
- `POST /match/end` - 매칭 종료
- `POST /match/report` - 신고

### 채팅 API
- `POST /chat/send` - 메시지 전송
- `GET /chat/messages?match_id={id}` - 메시지 조회
- `POST /translate` - 번역 (더미)

### 기타
- `GET /` - 서버 상태 확인
- `GET /health` - 헬스체크

## 🛠️ 로컬 실행

```bash
# 의존성 설치
npm install

# 서버 실행
npm start

# 기본 포트: 3000
# http://localhost:3000
```

## 📦 기술 스택

- **Node.js** 18+
- **Express** 4.19.2
- **CORS** 2.8.5
- **UUID** 9.0.1

## 🔒 보안 참고사항

현재는 개발/테스트용 메모리 저장소를 사용합니다.
프로덕션 배포 시:
- PostgreSQL/MongoDB 등 데이터베이스 연동
- JWT 토큰 기반 인증
- 비밀번호 해싱 (bcrypt)
- Rate limiting
- HTTPS 강제

## 📝 라이센스

MIT
