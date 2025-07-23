# Whisper 자막 생성 서비스 구현 가이드

## 프로젝트 개요

### 목적
기존 Flask 웹 애플리케이션에 Whisper AI 기반 자막 생성 기능을 추가하여, 사용자의 Google Colab과 연동하는 하이브리드 서비스 구축

### 핵심 아키텍처
- **프론트엔드**: 운영자의 Flask 웹사이트 (UI만 제공)
- **백엔드**: 사용자의 개별 Google Colab 인스턴스 (실제 Whisper 처리)
- **연동 방식**: ngrok을 통한 API 통신

## 현재 환경 분석

### 기존 인프라
```
호스팅어 서버: /var/www/mysite/
├── 워드프레스 설치 (블로그)
├── Flask 백엔드 운영 중
└── YouTube 관련 기능 이미 구축됨
```

### 기존 Flask 구조
```
/var/www/mysite/app/
├── routes/
│   ├── __init__.py
│   ├── youtube_search.py (기존 - 복잡한 YouTube API 기능)
│   └── [기타 라우트들...]
├── templates/youtube/
│   └── index.html (기존 YouTube 검색 UI)
├── static/js/youtube/ (복잡한 JS 구조)
└── [기타 디렉토리들...]
```

### Nginx 설정
- **현재 상태**: 이미 Flask 앱과 연동 완료
- **수정 필요성**: 없음 (Blueprint 추가는 Flask 내부 라우팅)

## 구현 계획

### 1. 파일 구조 설계

#### 새로 추가할 파일들
```
/var/www/mysite/app/
├── routes/
│   └── whisper.py (신규 - Whisper 전용 라우트)
├── templates/youtube/
│   └── whisper/
│       ├── generator.html (메인 UI)
│       └── mobile.html (모바일 대응, 선택사항)
└── static/
    ├── js/whisper/
    │   ├── colab-connector.js (Colab 연결 관리)
    │   ├── file-uploader.js (파일 업로드 처리)
    │   └── whisper-manager.js (전체 기능 조율)
    └── css/whisper_styles.css (UI 스타일링)
```

#### Blueprint 등록
```python
# flask_app.py 또는 app/__init__.py에 추가
from app.routes.whisper import whisper_bp
app.register_blueprint(whisper_bp, url_prefix='/youtube')
```

### 2. URL 구조 설계

#### 사용자 접근 경로
```
/youtube/whisper                    → 메인 UI 페이지
/youtube/api/whisper/connect        → Colab 연결 API
/youtube/api/whisper/upload         → 파일 업로드 API
/youtube/api/whisper/status/<id>    → 진행 상황 확인 API
/youtube/api/whisper/download/<id>  → 결과 다운로드 API
```

### 3. 기능 명세

#### 핵심 기능
1. **Colab 연결 관리**
   - ngrok URL 입력 및 검증
   - 연결 상태 확인
   - 연결 해제 처리

2. **파일 업로드 처리**
   - 지원 형식: MP3, MP4, WAV, M4A, WebM, OGG
   - 최대 크기: 100MB
   - 드래그 앤 드롭 지원

3. **자막 생성 프로세스**
   - 실시간 진행 상황 표시
   - 에러 처리 및 재시도
   - 결과 파일 다운로드 (SRT, VTT, TXT)

4. **사용자 경험**
   - 반응형 디자인 (모바일/데스크톱)
   - 로딩 상태 표시
   - 알림 및 에러 메시지

## 사용자 플로우

### 전체 과정
1. **서비스 접근**
   ```
   워드프레스 블로그 → iframe으로 Flask UI 접근
   또는 직접 /youtube/whisper 접근
   ```

2. **Colab 환경 설정**
   ```
   사용자: Colab 노트북 실행 → ngrok URL 생성
   웹 UI: URL 입력 → 연결 확인
   ```

3. **파일 처리**
   ```
   파일 업로드 → Colab으로 전송 → Whisper 처리 → 결과 다운로드
   ```

### 기술적 플로우
```
브라우저 (UI) ←→ Flask 서버 ←→ 사용자 Colab (ngrok) ←→ Whisper 모델
```

## 개발 우선순위

### Phase 1: 기본 구조 구축
1. `routes/whisper.py` 기본 라우트 생성
2. `templates/youtube/whisper/generator.html` UI 구현
3. 기본 Colab 연결 테스트

### Phase 2: 핵심 기능 구현
1. 파일 업로드 및 검증
2. Colab API 통신
3. 진행 상황 모니터링

### Phase 3: 사용자 경험 개선
1. 반응형 디자인 적용
2. 에러 처리 강화
3. 성능 최적화

### Phase 4: 통합 및 배포
1. 워드프레스 iframe 임베딩
2. 최종 테스트
3. 사용자 가이드 작성

## 기술적 고려사항

### 보안
- 파일 타입 및 크기 검증
- ngrok URL 형식 검증
- CSRF 토큰 사용
- 임시 파일 정리

### 성능
- 비동기 처리
- 파일 청크 업로드
- 진행 상황 WebSocket 또는 폴링
- 브라우저 캐시 최적화

### 호환성
- 크로스 브라우저 지원
- 모바일 대응
- 다양한 파일 형식 지원
- 네트워크 연결 불안정 대응

## 배포 전략

### 개발 환경
```bash
# 로컬에서 개발 및 테스트
cd /var/www/mysite
source venv/bin/activate
python flask_app.py
```

### 프로덕션 배포
```bash
# 파일 업로드 후 Flask 재시작
sudo systemctl restart flask-app  # 또는 해당 서비스명
```

### 워드프레스 통합
```html
<!-- 워드프레스 포스트/페이지에 삽입 -->
<iframe src="https://yourdomain.com/youtube/whisper" 
        width="100%" 
        height="700px" 
        frameborder="0"
        style="border-radius: 8px;">
</iframe>
```

## 비즈니스 연계

### 트래픽 증대 전략
- SEO 키워드: "무료 자막 생성", "AI 음성 인식"
- 블로그 콘텐츠: Whisper 사용법, 자막 생성 팁
- 소셜 미디어: 무료 서비스 홍보

### 수익화 방안
- 애드센스 광고 배치
- 관련 도구/서비스 어필리에이트
- 프리미엄 기능 (향후 확장)

### 사용자 유지
- 사용 가이드 제공
- FAQ 및 문제 해결
- 커뮤니티 구축 (댓글, 후기)

## 확장 계획

### 추가 기능 아이디어
- YouTube URL 직접 처리
- 배치 처리 (여러 파일 동시)
- 언어별 번역 기능
- 화자 분리 (Speaker Diarization)
- 자막 편집 도구

### 기술적 확장
- 다른 AI 모델 통합
- 클라우드 스토리지 연동
- 사용자 계정 시스템
- API 제공 (유료 서비스)

## 개발 체크리스트

### 필수 구현 사항
- [ ] routes/whisper.py 기본 구조
- [ ] HTML 템플릿 (generator.html)
- [ ] JavaScript 모듈 (colab-connector, file-uploader, whisper-manager)
- [ ] CSS 스타일링
- [ ] Blueprint 등록 및 테스트

### 선택 구현 사항
- [ ] 모바일 전용 UI
- [ ] 실시간 진행 상황 (WebSocket)
- [ ] 고급 에러 처리
- [ ] 사용자 설정 저장

### 배포 준비
- [ ] 프로덕션 환경 테스트
- [ ] 워드프레스 임베딩 테스트
- [ ] 사용자 가이드 작성
- [ ] 성능 모니터링 설정

---

**문서 버전**: 1.0  
**작성일**: 2025년 7월 21일  
**대상**: AI 개발 어시스턴트 및 개발팀  
**상태**: 구현 준비 완료