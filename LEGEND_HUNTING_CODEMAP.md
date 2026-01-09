# 🗺️ YouTube 레전드 헌팅 시스템 전체 코드맵

## 📁 프로젝트 구조 개요

```
youtube-search-analytics/
├── app/
│   ├── routes/
│   │   └── youtube_search.py          # 🔥 서버 API 엔드포인트
│   ├── utils/
│   │   ├── api_key_manager.py         # 🔑 API 키 관리
│   │   ├── usage_tracker.py           # 📊 체험 횟수 추적
│   │   └── hybrid_search.py           # 🔍 하이브리드 검색
│   ├── templates/youtube/
│   │   └── index.html                 # 🎨 메인 UI 템플릿
│   └── static/js/youtube/
│       ├── managers/
│       │   ├── search-manager.js      # 🏆 레전드 검색 엔진
│       │   ├── data-manager.js        # 💾 데이터 관리 시스템
│       │   └── ui-manager.js          # 🎛️ UI 상태 관리
│       ├── components/
│       │   └── video-display.js       # 📺 비디오 표시 컴포넌트
│       ├── data/
│       │   └── data-export.js         # 💾 데이터 내보내기 시스템
│       └── utils/
│           └── api-helpers.js         # 🌐 API 통신 헬퍼
└── LEGEND_HUNTING_PLAN.md             # 📋 개발 계획서 (신규)
```

---

## 🔥 핵심 시스템 매핑

### **1. 레전드 검색 엔진 (search-manager.js)**

#### **클래스 구조**
```javascript
class SearchManager {
    // 🎯 핵심 메서드들
    performSearch(keyword)                    // Line 84: 메인 검색 진입점
    performMultiKeywordSearch(keywords)       // Line 162: 다중 키워드 검색
    calculateLegendScore(video)               // Line 286: 레전드 점수 계산
    
    // 📊 데이터 처리
    enrichVideosWithLegendData(videos)       // 비디오에 레전드 데이터 추가
    mergeMultiSearchResults(results)         // 다중 검색 결과 통합
}
```

#### **레전드 점수 계산 로직**
```javascript
// Line 286-348: calculateLegendScore() 메서드
레전드 점수 공식:
score = (조회수 / 경과개월수) × 구독자가중치

구독자 가중치 매핑:
- 1만 미만:    5.0
- 1만~10만:    3.0  
- 10만~100만:  2.0
- 100만 이상:  1.0

레전드 티어 분류:
- 3000+ : 슈퍼레전드
- 1000+ : 레전드  
- 300+  : 준레전드
- 기타   : 일반
```

#### **다중 검색 워크플로우**
```javascript
// Line 162-276: performMultiKeywordSearch() 실행 흐름
1. 키워드 분할 (쉼표 기준)
2. 병렬 검색 실행 (Promise.all)
3. 각 결과에 레전드 데이터 추가
4. 레전드 점수 필터링 적용 
5. 키워드별 상위 10개 선별
6. 최종 통합 결과 생성
```

### **2. 데이터 관리 시스템 (data-manager.js)**

#### **클래스 구조**
```javascript
class DataManager {
    // 🎯 레전드 헌팅 전용 속성
    searchFilters: {
        legendScoreMin: 100    // Line 48: 레전드점수 최소값
    }
    
    // 📊 핵심 메서드들
    enrichVideosWithLegendData()             // Line 388: 레전드 데이터 확장
    mergeMultiSearchResults()                // Line 418: 다중 검색 통합
    getLegendStatistics()                    // Line 464: 레전드 통계 계산
    getLegendScoreMinFilter()                // Line 504: 필터값 조회
}
```

#### **레전드 데이터 확장 구조**
```javascript
// Line 400-410: enrichVideosWithLegendData() 반환 구조
{
    ...video,                              // 기존 비디오 데이터
    keyword: keyword,                      // 검색 키워드
    legendScore: legendData.score,         // 레전드 점수 (숫자)
    legendTier: legendData.tier,           // 레전드 등급 (문자열)
    searchType: searchType,                // 검색 타입 ('single'/'multi')
    monthsElapsed: legendData.monthsElapsed, // 경과 개월 수
    subscriberWeight: legendData.subscriberWeight // 구독자 가중치
}
```

### **3. UI 관리 시스템 (ui-manager.js)**

#### **레전드 관련 UI 메서드**
```javascript
class UIManager {
    // 🎯 레전드 필터 관리
    loadFiltersToUI()                        // Line 55: 저장된 필터 UI 반영
    getLegendScoreMinFilter()                // 레전드 점수 최소값 조회
    
    // 📊 AI 분석 연동  
    handleAiAnalyzeClick()                   // Line 691: AI 분석 버튼 처리
    collectSelectedVideoData()               // Line 755: 레전드 데이터 수집
}
```

### **4. 비디오 표시 컴포넌트 (video-display.js)**

#### **레전드 데이터 표시**
```javascript
class VideoDisplay {
    // 🎯 검색 결과 표시
    displaySearchResults(videos, searchType) // Line 337: 검색 타입별 표시
    _createTableRowHtml(video)               // Line 364: 테이블 행 생성
    
    // 📊 레전드 점수 표시 로직
    Line 385-387: 레전드 점수 표시
    Line 398, 417: 키워드 컬럼 표시  
    Line 410: 레전드 티어 툴팁
}
```

### **5. 데이터 내보내기 시스템 (data-export.js)**

#### **통합 내보내기 시스템**
```javascript
class DataExport {
    // 🎯 핵심 메서드들
    generateJsonData(selectedVideos)        // Line 164: 통합 JSON 생성
    exportToExcel()                         // Line 32: Excel 내보내기 (13컬럼)
    exportToJson()                          // Line 390: JSON 내보내기
    generateSelectedVideosJsonData()        // Line 446: AI 분석용 데이터
}
```

#### **13개 Excel 컬럼 구조**
```javascript
// Line 107-121: Excel 데이터 구조
1. 썸네일주소 (고품질 URL 우선)
2. 제목
3. 게시일  
4. 조회수
5. 레전드점수 ⭐ (기존 영상떡상률 대체)
6. 좋아요
7. 댓글수
8. 영상길이
9. 채널명
10. 구독자수
11. 영상확산률
12. 키워드 ⭐ (신규 추가)
13. 동영상주소
```

#### **AI 분석용 확장 데이터**
```javascript
// Line 344-374: 레전드 헌팅 메트릭
legendHuntingMetrics: {
    legendScore: 레전드 점수,
    legendTier: 레전드 티어,
    isLegendEligible: 레전드 자격 여부,
    subscriberWeight: 구독자 가중치,
    monthsElapsed: 경과 개월수,
    legendRank: 키워드 내 순위,
    keywordContext: 키워드 컨텍스트,
    multiSearchFiltered: 다중검색 필터링 여부
}

// Line 357-372: AI 종합 점수 (레전드 통합)
comprehensiveScores: {
    overallPerformanceScore: 레전드점수 20% 반영,
    growthPotentialScore: 레전드점수 30% 반영,
    legendPerformanceScore: 순수 레전드 성과 점수
}
```

### **6. UI 템플릿 (index.html)**

#### **레전드 헌팅 UI 요소**
```html
<!-- Line 33: 다중 검색 안내 -->
<input placeholder="검색어 입력 (쉼표로 구분시 다중검색)">

<!-- Line 226: 테이블 헤더 - 레전드점수 -->
<th data-sort-by="legendScore" title="레전드점수=(조회수/경과월수)×구독자가중치">레전드점수</th>

<!-- Line 233: 테이블 헤더 - 키워드 -->
<th data-sort-by="keyword" title="검색 키워드">키워드</th>

<!-- Line 351-360: 레전드 점수 필터 -->
<div class="filter-group">
    <label>레전드점수 최소값 (다중검색용)</label>
    <input type="number" id="legend-score-input" value="100">
    <small>단일검색에는 적용되지 않습니다</small>
</div>
```

---

## 🔄 데이터 흐름 매핑

### **단일 검색 플로우**
```
사용자 입력 → SearchManager.performSearch()
            ↓
       하이브리드 검색 (기존 로직)
            ↓
   DataManager.enrichVideosWithLegendData()
            ↓
       VideoDisplay.displaySearchResults()
            ↓
        검색 결과 표시
```

### **다중 검색 플로우** 
```
사용자 입력 (쉼표 포함) → SearchManager.performSearch()
                      ↓
             SearchManager.performMultiKeywordSearch()
                      ↓
            키워드별 병렬 검색 (Promise.all)
                      ↓
         각 결과에 레전드 점수 계산 및 추가
                      ↓
            DataManager.mergeMultiSearchResults()
                      ↓
          레전드 점수 필터링 + 키워드별 상위 10개 선별
                      ↓
             VideoDisplay.displaySearchResults()
                      ↓
            키워드별 그룹핑된 레전드 결과 표시
```

### **데이터 내보내기 플로우**
```
선택된 비디오 → DataExport.generateJsonData()
             ↓
        통합 레전드 데이터 생성 (60+ 지표)
             ↓
         ┌─── Excel (13컬럼) ─── DataExport.exportToExcel()
         │
         ├─── JSON (완전판) ─── DataExport.exportToJson()
         │
         └─── AI 분석 ────── UIManager.handleAiAnalyzeClick()
                            ↓
                 localStorage 저장 + 외부 분석 도구 연동
```

---

## 🎯 핵심 알고리즘 매핑

### **1. 레전드 점수 계산 알고리즘**
**위치**: `search-manager.js:286-348`

```javascript
calculateLegendScore(video) {
    // 1단계: 업로드일 기준 경과 개월 수 계산
    const publishedAt = video.snippet?.publishedAt || video.publishedAt;
    const monthsElapsed = this.calculateMonthsElapsed(publishedAt);
    
    // 2단계: 구독자 수 기준 가중치 계산
    const subscriberCount = video.channelStatistics?.subscriberCount || 0;
    const subscriberWeight = this.getSubscriberWeight(subscriberCount);
    
    // 3단계: 레전드 점수 계산
    const viewCount = video.statistics?.viewCount || 0;
    const score = Math.round((viewCount / Math.max(monthsElapsed, 1)) * subscriberWeight);
    
    // 4단계: 레전드 티어 결정
    const tier = this.determineLegendTier(score);
    
    return { score, tier, monthsElapsed, subscriberWeight };
}
```

### **2. 다중 검색 통합 알고리즘**
**위치**: `data-manager.js:418-459`

```javascript
mergeMultiSearchResults(multiSearchResults) {
    // 1단계: 각 키워드별 결과 처리
    multiSearchResults.forEach(result => {
        // 레전드 점수 필터링
        const filteredVideos = result.videos.filter(video => {
            return video.legendScore >= this.getLegendScoreMinFilter();
        });
        
        // 키워드별 상위 10개 선택
        const topVideos = filteredVideos
            .sort((a, b) => b.legendScore - a.legendScore)
            .slice(0, 10);
            
        mergedResults.push(...topVideos);
    });
    
    // 2단계: 최종 정렬 (키워드별 + 레전드 점수순)
    return mergedResults.sort((a, b) => {
        if (a.keyword !== b.keyword) {
            return a.keyword.localeCompare(b.keyword);
        }
        return b.legendScore - a.legendScore;
    });
}
```

### **3. 통합 데이터 생성 알고리즘**
**위치**: `data-export.js:164-383`

```javascript
generateJsonData(selectedVideos) {
    return selectedVideos.map(video => ({
        // 기본 13개 컬럼 (Excel과 동일)
        썸네일주소: thumbnailUrl,
        제목: snippet.title,
        // ... 기타 기본 필드들
        
        // AI 분석용 확장 데이터 (60+ 지표)
        aiAnalysisData: {
            // 레전드 헌팅 전용 지표
            legendHuntingMetrics: {
                legendScore: video.legendScore,
                legendTier: video.legendTier,
                // ... 기타 레전드 지표들
            },
            
            // 종합 성과 점수 (레전드 점수 통합)
            comprehensiveScores: {
                overallPerformanceScore: 레전드점수_20%_반영,
                growthPotentialScore: 레전드점수_30%_반영,
                legendPerformanceScore: 순수_레전드_점수
            }
        }
    }));
}
```

---

## 🚀 성능 최적화 매핑

### **1. 병렬 처리 최적화**
- **위치**: `search-manager.js:189-210`
- **방법**: `Promise.all()` 사용하여 키워드별 동시 검색
- **효과**: N개 키워드 검색 시간을 1/N로 단축

### **2. 데이터 캐싱 전략**
- **위치**: `video-display.js:20-27`
- **방법**: `_cachedMockVideos` 변수로 데모 데이터 캐싱
- **효과**: 반복 액세스 시 즉시 로딩

### **3. 메모리 최적화**
- **위치**: `data-manager.js:56-73`
- **방법**: 암호화 키 생성 및 메모리 백업 시스템
- **효과**: 저장소 실패 시에도 세션 유지

---

## 🔧 확장 포인트 매핑

### **1. 레전드 점수 알고리즘 고도화**
- **현재**: `search-manager.js:306-325` - 고정 가중치 시스템
- **확장**: 머신러닝 기반 동적 가중치 적용
- **구현**: 새로운 `calculateAdvancedLegendScore()` 메서드 추가

### **2. 추가 필터링 옵션**
- **현재**: `data-manager.js:48` - 레전드 점수 최소값만
- **확장**: 업로드 기간별, 카테고리별 레전드 필터
- **구현**: `searchFilters` 객체 확장

### **3. 실시간 분석 대시보드**
- **현재**: `ui-manager.js:464-508` - 정적 통계
- **확장**: WebSocket 기반 실시간 레전드 트렌드
- **구현**: 새로운 `RealtimeDashboard` 클래스 추가

---

## 📊 테스트 포인트 매핑

### **1. 레전드 점수 계산 테스트**
```javascript
// 테스트 케이스 위치: search-manager.js:286-348
- 경과 개월수 계산 정확성
- 구독자 가중치 적용 검증  
- 레전드 티어 분류 검증
- 극값 처리 (0 조회수, 신규 채널 등)
```

### **2. 다중 검색 통합 테스트**
```javascript
// 테스트 케이스 위치: data-manager.js:418-459
- 키워드별 결과 분리 검증
- 레전드 점수 필터링 정확성
- 상위 N개 선별 로직 검증
- 최종 정렬 순서 검증
```

### **3. 데이터 내보내기 일관성 테스트**
```javascript
// 테스트 케이스 위치: data-export.js:164-383
- Excel/JSON 데이터 구조 일치성
- 레전드 데이터 누락 검사
- AI 분석 데이터 완전성 검증
- 13개 컬럼 구조 검증
```

---

## 🎯 결론

이 코드맵은 **YouTube 레전드 헌팅 시스템의 완전한 구조와 데이터 흐름**을 보여줍니다. 

**핵심 특징**:
- **모듈형 아키텍처**: 각 컴포넌트가 독립적으로 동작하면서 레전드 데이터로 통합
- **데이터 일관성**: 검색 → 표시 → 내보내기 전체 과정에서 동일한 레전드 구조 유지  
- **확장 가능성**: 레전드 알고리즘, 필터링, 분석 기능의 쉬운 확장 지원
- **성능 최적화**: 병렬 처리, 캐싱, 메모리 최적화로 사용자 경험 향상

이제 개발자들은 이 코드맵을 통해 **레전드 헌팅 시스템의 전체 구조를 한눈에 파악**하고, 필요한 기능을 정확한 위치에서 수정하거나 확장할 수 있습니다! 🗺️🏆