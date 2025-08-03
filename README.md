# 🎥 YouTube Search & Analytics Platform

> **YouTube 검색 및 분석 도구** - YouTube Data API v3를 활용한 고급 비디오 검색, 필터링, 분석 플랫폼

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0.2-green)](https://flask.palletsprojects.com)
[![YouTube API](https://img.shields.io/badge/YouTube%20API-v3-red)](https://developers.google.com/youtube/v3)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 📋 목차

- [🌟 주요 기능](#-주요-기능)
- [🏗️ 시스템 아키텍처](#️-시스템-아키텍처)
- [🚀 설치 및 실행](#-설치-및-실행)
- [⚙️ 설정](#️-설정)
- [📖 사용법](#-사용법)
- [🔧 개발 가이드](#-개발-가이드)
- [📁 프로젝트 구조](#-프로젝트-구조)
- [🤝 기여하기](#-기여하기)
- [📄 라이선스](#-라이선스)

## 🌟 주요 기능

### 🔍 고급 검색 & 필터링
- **다양한 정렬 옵션**: 관련성, 업로드일, 조회수, 평점별 정렬
- **채널 필터링**: 개설년도, 구독자수, 최소 조회수 조건
- **영상 길이 필터**: 4분미만/4-20분/20분이상 세분화
- **지역화 지원**: 한국어 콘텐츠 우선 (regionCode: 'KR')
- **결과 개수 제한**: 10~50개 검색 결과 사용자 설정

### 📊 데이터 분석 & 인사이트
- **기본 통계**: 조회수/좋아요/댓글수 평균, 최대/최소값 분석
- **트렌드 분석**: 업로드 시간대 패턴, 인기 키워드 트렌드
- **채널 비교**: 여러 채널 성과 지표 상호 비교
- **예측 모델**: 조회수 증가 예측 (선형 회귀 모델)

### 💾 데이터 관리 & 내보내기
- **다양한 형식 지원**: CSV (UTF-8 BOM), JSON 구조화 데이터
- **선택적 내보내기**: 개별 선택 또는 전체 선택 시스템
- **Excel 호환**: CSV 파일 Excel 완벽 호환

### 🛠️ 고급 도구
- **비디오 도구**: 일괄 열기, 상세정보 모달, URL 복사/공유
- **API 관리**: 키 삭제, 데모 모드, 할당량 실시간 확인
- **UI 도구**: 홈 새로고침, 인터페이스 초기화


## 🏗️ 시스템 아키텍처

### 백엔드 (Flask)
```
Flask Application (Port 5000)
├── YouTube Data API v3 Integration
├── Blueprint Pattern Routing
├── API Key Management System
└── CORS Support
```

### 프론트엔드 (Vanilla JavaScript)
```
Modular Architecture (5 Managers)
├── SearchManager    # 검색 & 필터 통합 관리
├── DataManager      # 데이터 저장/관리
├── AnalysisManager  # 통계 분석 기능
├── ToolsManager     # 비디오 도구 관리
└── UIManager        # UI 상태 관리
```

### 인프라
- **웹서버**: Nginx (Port 80/443)
- **백엔드**: Flask (Port 5000)
- **도메인**: api.tipmaster.co.kr/youtube/

## 🚀 설치 및 실행

### 요구사항
- Python 3.8 이상
- YouTube Data API v3 키
- Flask 3.0.2 이상

### 로컬 개발 환경 설정

1. **저장소 클론**
```bash
git clone [repository-url]
cd YouTubeSearch
```

2. **가상환경 생성 및 활성화**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 또는
venv\Scripts\activate     # Windows
```

3. **의존성 설치**
```bash
pip install -r requirements.txt
```

4. **환경변수 설정**
```bash
# .env 파일 생성
echo "YOUTUBE_API_KEY=your_youtube_api_key_here" > .env
```

5. **애플리케이션 실행**
```bash
python flask_app.py
```

6. **접속 확인**
```
http://localhost:5000/youtube/
```

## ⚙️ 설정

### YouTube API 키 설정

1. **Google Cloud Console**에서 프로젝트 생성
2. **YouTube Data API v3** 활성화
3. **API 키** 생성 및 복사
4. 웹 인터페이스에서 API 키 등록 또는 설정 파일에 추가

### 설정 파일 위치
```
app/config/
├── api_keys.txt          # API 키 저장
├── api_key_status.json   # API 키 상태 관리
└── usage_data.json       # 사용량 추적 데이터
```

## 📖 사용법

### 1. 기본 검색
1. 메인 화면에서 검색어 입력
2. 검색 버튼 클릭 또는 Enter
3. 검색 결과 테이블에서 확인

### 2. 고급 필터링
1. 필터 버튼 클릭
2. 원하는 조건 설정
   - 정렬 방식 선택
   - 채널 조건 설정
   - 영상 길이 필터
3. 필터 적용

### 3. 데이터 분석
1. 검색 결과에서 분석할 비디오 선택
2. 분석 버튼 클릭
3. 통계 차트 및 인사이트 확인

### 4. 데이터 내보내기
1. 원하는 비디오들 선택
2. 내보내기 버튼 클릭
3. CSV 또는 JSON 형식 선택
4. 파일 다운로드

## 🔧 개발 가이드

### 프론트엔드 모듈 구조

#### 매니저 시스템 (managers/)
```javascript
// 검색 및 필터 관리
SearchManager.performSearch(query, filters)
SearchManager.applyFilters(filterData)

// 데이터 관리
DataManager.toggleVideoSelection(videoId)
DataManager.exportToCSV(selectedVideos)

// 분석 기능
AnalysisManager.generateStatistics(videos)
AnalysisManager.createTrendAnalysis(data)

// 도구 기능  
ToolsManager.openSelectedVideos()
ToolsManager.clearAllResults()

// UI 상태 관리
UIManager.showModal(modalType)
UIManager.updateButtonStates()
```

#### 컴포넌트 시스템 (components/)
- **VideoDisplay**: 비디오 카드 및 테이블 렌더링
- **ModalComponents**: 모든 모달 UI 컴포넌트
- **UIControls**: 드롭다운, 버튼, 키보드 단축키

#### 유틸리티 (utils/)
- **Formatters**: 숫자, 날짜, 시간 포맷팅
- **APIHelpers**: HTTP 요청, 오류 처리, 재시도 로직
- **DOMUtils**: DOM 조작, 브라우저 기능, 로컬스토리지

### 백엔드 API 엔드포인트

```python
# 검색 API
GET/POST /youtube/api/search
GET /youtube/api/demo-search

# 설정 API  
POST /youtube/api/set-api-key
GET /youtube/api/get-api-status
DELETE /youtube/api/delete-api-key

```

### 코드 기여 가이드

1. **브랜치 생성**: `feature/기능명` 또는 `fix/버그명`
2. **코딩 스타일**: PEP 8 (Python), ESLint (JavaScript)
3. **커밋 메시지**: Conventional Commits 형식
4. **테스트**: 기능 추가 시 테스트 코드 포함
5. **문서화**: README 및 코드 주석 업데이트

## 📁 프로젝트 구조

```
YouTubeSearch/
├── app/                          # Flask 애플리케이션
│   ├── routes/                   # API 라우터
│   │   ├── youtube_search.py     # YouTube 검색 API
│   │   └── your_new_program.py  # 추가 기능
│   ├── static/                   # 정적 파일
│   │   ├── css/
│   │   │   └── youtube_styles.css
│   │   └── js/
│   │       ├── youtube/          # YouTube 관련 JS
│   │       │   ├── managers/     # 5개 핵심 매니저
│   │       │   ├── components/   # UI 컴포넌트
│   │       │   ├── utils/        # 유틸리티 함수
│   │       │   └── data/         # 데이터 처리
│   ├── templates/                # HTML 템플릿
│   │   ├── base.html
│   │   └── youtube/
│   │       ├── index.html        # 메인 페이지
│   │       ├── mobile.html       # 모바일 버전
│   │       ├── analyzer.html     # 분석 도구
│   ├── utils/                    # 백엔드 유틸리티
│   │   ├── api_key_manager.py    # API 키 관리
│   │   ├── hybrid_search.py      # 하이브리드 검색
│   │   ├── youtube_filter.py     # 필터링 로직
│   │   └── usage_tracker.py      # 사용량 추적
│   └── config/                   # 설정 파일
│       ├── api_keys.txt
│       ├── api_key_status.json
│       └── usage_data.json
├── flask_app.py                  # Flask 애플리케이션 진입점
├── wsgi.py                       # WSGI 설정
├── requirements.txt              # Python 의존성
└── README.md                     # 프로젝트 문서 (이 파일)

```

## 🤝 기여하기

1. **Fork** 이 저장소
2. **Feature 브랜치** 생성 (`git checkout -b feature/AmazingFeature`)
3. **변경사항 커밋** (`git commit -m 'Add some AmazingFeature'`)
4. **브랜치에 Push** (`git push origin feature/AmazingFeature`)
5. **Pull Request** 생성

### 기여 규칙
- 코드 스타일 가이드 준수
- 테스트 케이스 작성
- 문서 업데이트
- 한국어/영어 모두 지원

## 📞 지원 및 문의

- **이슈 리포팅**: [GitHub Issues](링크)
- **기능 요청**: [GitHub Discussions](링크)
- **이메일**: [연락처]
- **문서**: [Wiki](링크)

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.

---

## 🎯 로드맵

### v1.0 (현재)
- ✅ 기본 YouTube 검색 기능
- ✅ 고급 필터링 시스템
- ✅ 데이터 내보내기

### v1.1 (예정)
- 🔄 실시간 트렌드 분석
- 🔄 채널 구독자 추이 분석
- 🔄 키워드 경쟁 분석
- 🔄 API 할당량 최적화

### v2.0 (계획)
- 📋 YouTube Shorts 분석
- 📋 댓글 감성 분석
- 📋 경쟁사 분석 도구
- 📋 자동 리포트 생성

---

**Made with ❤️ for YouTube Content Creators & Marketers**

> 이 도구는 YouTube 컨텐츠 크리에이터, 마케터, 연구자들이 보다 효율적으로 YouTube 데이터를 분석할 수 있도록 설계되었습니다.