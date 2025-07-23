# YouTube Search Project - Code Map

## 프로젝트 개요
Flask 기반 YouTube 검색 및 분석 도구로, 고급 필터링, API 키 관리, 데이터 분석 기능을 제공하는 엔터프라이즈급 웹 애플리케이션

## 🏗️ 전체 아키텍처

```
YouTubeSearch_00/
├── mysite/                     # 메인 애플리케이션
│   ├── flask_app.py           # 애플리케이션 진입점
│   ├── wsgi.py               # WSGI 배포 설정
│   ├── requirements.txt      # Python 의존성
│   └── app/                  # 애플리케이션 팩토리 패턴
│       ├── __init__.py       # Flask 앱 팩토리
│       ├── config/          # 설정 파일들
│       ├── routes/          # API 라우트
│       ├── static/          # 정적 파일 (CSS, JS)
│       ├── templates/       # HTML 템플릿
│       └── utils/           # 유틸리티 모듈
├── wordpress/              # WordPress 연동
└── 백엔드프로그램개요.txt   # 프로젝트 문서
```

## 🔧 백엔드 아키텍처

### 메인 애플리케이션
- **`flask_app.py`**: 개발 서버 런처
- **`app/__init__.py`**: Flask 팩토리 패턴, CORS 설정, 블루프린트 등록

### 라우트 시스템 (`app/routes/`)

#### `youtube_search.py` - 메인 YouTube 검색 API
**핵심 엔드포인트:**
- `GET /` - 메인 검색 인터페이스
- `GET /mobile` - 모바일 최적화 인터페이스  
- `POST /search` - YouTube Data API 검색 실행
- `GET /demo-search` - 데모 모드 (가짜 데이터)

**API 키 관리:**
- `POST /server-key/get` - 서버 API 키 조회
- `POST /server-key/report-failure` - 실패한 키 신고

**관리자 기능:**
- `GET /admin/api-keys` - API 키 관리 대시보드
- `GET /admin/api-keys/status` - 키 상태 통계
- `POST /admin/api-keys/add` - 새 키 추가
- `POST /admin/api-keys/delete` - 키 삭제
- `POST /admin/api-keys/reset-failed` - 실패 키 리셋

#### `your_new_program.py` - 추가 기능 라우트

### 유틸리티 모듈 (`app/utils/`)

#### `api_key_manager.py` - API 키 관리 시스템
- **스레드 안전성**: 파일 잠금 메커니즘
- **일일 리셋**: 오전 9:30 (KST) 자동 리셋
- **실패 추적**: 자동 복구 시스템
- **사용량 통계**: JSON 기반 상태 관리

#### `hybrid_search.py` - 하이브리드 검색 시스템
#### `usage_tracker.py` - 사용량 추적
#### `youtube_filter.py` - YouTube 필터링

## 🎨 프론트엔드 아키텍처

### 모듈 시스템 (`app/static/js/youtube/`)

#### 메인 앱
- **`youtube-app.js`**: ES6 모듈 시스템, 의존성 주입 패턴

#### 매니저 패턴 (`managers/`)
- **`search-manager.js`**: 검색 오케스트레이션, API 호출
- **`data-manager.js`**: 데이터 저장, 설정, 비디오 컬렉션 관리
- **`ui-manager.js`**: UI 업데이트, 모달 상호작용
- **`tools-manager.js`**: 유틸리티 기능, 도구
- **`analysis-manager.js`**: 데이터 분석 기능

#### 컴포넌트 (`components/`)
- **`video-display.js`**: 검색 결과 렌더링, 비디오 카드
- **`modal-components.js`**: 모달 다이얼로그 관리
- **`ui-controls.js`**: 사용자 입력 컨트롤

#### 유틸리티 (`utils/`)
- **`api-helpers.js`**: API 통신 유틸리티
- **`dom-utils.js`**: DOM 조작 헬퍼
- **`formatters.js`**: 데이터 포맷팅
- **`calculations.js`**: 분석 및 계산 함수
- **`browser-usage-tracker.js`**: 클라이언트 사이드 추적

#### 데이터 (`data/`)
- **`data-export.js`**: Excel/JSON 내보내기

## 🔍 주요 기능

### 1. 검색 시스템
- **하이브리드 API 키 시스템**: 개인 키 → 서버 키 → 데모 모드
- **자동 장애조치**: API 키 실패 시 자동 전환
- **실시간 검색**: 진행 상황 알림

### 2. 고급 필터링
- **정렬**: 관련성, 조회수, 날짜, 평점
- **재생시간**: 짧음, 보통, 긺
- **업로드 날짜**: 범위 설정
- **조회수 범위**: 최소/최대값
- **구독자 수**: 채널 구독자 필터링
- **채널 생성일**: 채널 나이 필터
- **한국어 콘텐츠**: 언어별 필터링

### 3. 데이터 분석 & 내보내기
- **Excel 내보내기**: 검색 결과 스프레드시트
- **JSON 내보내기**: AI 친화적 데이터 형식
- **통계 분석**: 조회수, 구독자 분석
- **사용량 추적**: 브라우저 및 서버 사이드

### 4. 성능 최적화
- **LRU 캐싱**: 메모리 제한 (최대 50개 항목)
- **디바운싱**: 상태 업데이트 최적화 (100ms)
- **메모리 누수 방지**: 정리 핸들러
- **성능 모니터링**: 메트릭 수집

## 📱 UI/UX 특징

### 반응형 디자인
- **데스크톱 인터페이스**: `templates/youtube/index.html`
- **모바일 인터페이스**: `templates/youtube/mobile.html`
- **CSS 스타일**: `static/css/youtube_styles.css`

### 사용자 경험
- **프로그레시브 검색**: 실시간 피드백
- **결과 액션**: 선택된 비디오 대량 작업
- **모달 시스템**: 팝업 다이얼로그
- **로딩 상태**: 시각적 진행 표시

## 🔐 설정 및 보안

### API 키 관리
- **멀티 티어 시스템**: 개인 → 서버 → 데모
- **자동 로테이션**: 실패 감지 및 키 교체
- **일일 사용량 추적**: 9:30 AM KST 리셋
- **관리자 인터페이스**: 완전한 키 관리

### 설정 파일 (`config/`)
- **`api_keys.txt`**: API 키 목록
- **`api_key_status.json`**: 키 상태 추적
- **`usage_data.json`**: 사용량 데이터

## 🚀 배포 및 확장성

### 의존성 (`requirements.txt`)
- **Flask 3.0.2**: CORS 지원
- **Google API Client**: YouTube Data API v3
- **데이터 처리**: pandas, numpy, beautifulsoup4
- **추가 도구**: selenium, opencv, plotly

### WSGI 배포
- **`wsgi.py`**: 프로덕션 배포 설정
- **확장 가능한 아키�ecture**: 블루프린트 패턴

## 🔄 워크플로우

### 검색 프로세스
1. 사용자 검색 입력
2. API 키 선택 (하이브리드 시스템)
3. YouTube Data API 호출
4. 필터링 및 정렬 적용
5. 결과 렌더링 및 캐싱
6. 데이터 분석 및 내보내기 옵션

### API 키 생명주기
1. 키 추가 (관리자)
2. 사용량 추적
3. 실패 감지
4. 자동 로테이션
5. 일일 리셋 (9:30 AM KST)

## 📊 모니터링 및 분석

### 사용량 추적
- **서버 사이드**: `usage_tracker.py`
- **클라이언트 사이드**: `browser-usage-tracker.js`
- **API 키 통계**: 실시간 모니터링

### 성능 메트릭
- **검색 응답 시간**
- **캐시 히트율**
- **API 키 성공률**
- **메모리 사용량**

## 🔗 연동 시스템

### WordPress 연동 (`wordpress/`)
- **`youtube-mobile/`**: 모바일 WordPress 플러그인
- **`youtube-tool/`**: 데스크톱 WordPress 도구

## 📚 추가 문서
- **`백엔드프로그램개요.txt`**: 상세 프로젝트 설명
- **디버그 페이지**: `templates/youtube/debug.html`

---

## 🎯 결론

이 프로젝트는 **엔터프라이즈급 YouTube 검색 애플리케이션**으로:

1. **확장 가능한 백엔드**: Flask 블루프린트 아키텍처
2. **견고한 API 관리**: 다단계 API 키 시스템과 자동 장애조치
3. **모듈형 프론트엔드**: ES6 모듈과 의존성 주입, 성능 최적화
4. **고급 검색**: 포괄적 필터링 및 분석 기능
5. **사용자 경험**: 반응형 디자인, 프로그레시브 로딩, 실시간 피드백
6. **데이터 내보내기**: 분석 및 보고를 위한 다중 내보내기 형식
7. **관리 도구**: 완전한 API 키 관리 인터페이스

프로젝트는 적절한 관심사 분리, 에러 처리, 성능 최적화, 유지 관리 가능한 아키텍처 패턴을 보여주는 엔터프라이즈 수준의 코드 조직을 보여줍니다.