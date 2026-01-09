/**
 * @fileoverview YouTube 검색 기능을 관리하는 매니저입니다.
 * 검색어, 필터, API 모드 등을 기반으로 백엔드 API를 호출하고 결과를 처리합니다.
 */

import ApiHelpers from '../utils/api-helpers.js';
import browserUsageTracker from '../utils/browser-usage-tracker.js';

class SearchManager {
    /**
     * SearchManager 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스.
     * @param {object} dependencies.uiManager - UI 관리자 인스턴스.
     * @param {object} dependencies.videoDisplay - 비디오 표시 컴포넌트 인스턴스.
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;
        this.videoDisplay = dependencies.videoDisplay;

        this.searchInput = document.getElementById('search-input');
        
        // 🚀 최적화된 상태 관리 (메모리 누수 방지)
        this.statusCache = new Map();
        this.statusUpdateQueue = [];
        this.isUpdatingStatus = false;
        
        // 🚀 메모리 누수 방지를 위한 리소스 관리
        this.cleanupHandlers = [];
        this.activeIntervals = new Set();
        this.activeTimeouts = new Set();
        
        // 🚀 LRU 캐시 구현 (메모리 제한)
        this.maxCacheSize = 50;
        this.cacheAccessOrder = new Map();
        
        // 🚀 DOM 업데이트 배치 처리용
        this.pendingUpdate = null;
        
        // 🚀 디바운스 설정은 메서드 정의 후에 초기화
        this.statusUpdateDebounced = null;
        
        // 🚀 초기화 완료 후 디바운스 설정 및 상태 업데이트 시작
        const initTimeout = setTimeout(() => {
            this.statusUpdateDebounced = this.debounce(this.updateSearchStatusFast.bind(this), 100);
            this.updateSearchStatusFast();
            
            // 메모리 누수 방지: interval ID 추적
            const statusInterval = setInterval(() => this.updateSearchStatusFast(), 15000);
            this.activeIntervals.add(statusInterval);
            
            // 5분마다 캐시 정리
            const cacheCleanupInterval = setInterval(() => this.cleanupCache(), 300000);
            this.activeIntervals.add(cacheCleanupInterval);
            
            this.activeTimeouts.delete(initTimeout);
        }, 0);
        this.activeTimeouts.add(initTimeout);
        
        // 🚀 페이지 언로드 시 리소스 정리
        this.setupCleanupHandlers();
    }

    /**
     * 🚀 최적화된 검색을 수행합니다.
     * 현재 검색 필터와 API 모드 설정을 사용하여 백엔드 API를 호출합니다. (병렬 처리 최적화)
     */
    async performSearch() {
        return this.performSearchOptimized();
    }

    /**
     * 하이브리드 검색을 수행합니다 (단일/다중 검색 자동 판별).
     * @param {string} query - 검색어 (쉼표로 구분 시 다중 검색)
     * @returns {Promise<Array>} 검색 결과 배열
     */
    async performHybridSearch(query) {
        if (!query || !query.trim()) {
            this.uiManager.showNotification('검색어를 입력해주세요.', 'warning');
            return [];
        }

        const trimmedQuery = query.trim();
        
        // 쉼표 감지로 단일/다중 검색 판별
        if (trimmedQuery.includes(',')) {
            // 다중 검색
            return this.performMultiSearch(trimmedQuery);
        } else {
            // 단일 검색
            return this.performSingleSearch(trimmedQuery);
        }
    }

    /**
     * 단일 검색을 수행합니다.
     * @param {string} keyword - 단일 검색 키워드
     * @returns {Promise<Array>} 검색 결과 배열
     */
    async performSingleSearch(keyword) {
        try {
            const { isApiMode, currentApiKey, searchFilters } = this.dataManager;
            
            this.uiManager.showLoadingOverlay();
            this.showProgressiveNotification(`"${keyword}" 검색 중...`, 'info');

            let videos = [];
            
            if (isApiMode && currentApiKey) {
                // API 모드 검색
                videos = await ApiHelpers.performRealSearch(
                    keyword,
                    currentApiKey,
                    {
                        sortBy: searchFilters.sortBy,
                        duration: searchFilters.duration,
                        uploadStartDate: searchFilters.uploadStartDate,
                        uploadEndDate: searchFilters.uploadEndDate,
                        maxResults: searchFilters.maxResults,
                        minViews: searchFilters.minViews,
                        maxViews: searchFilters.maxViews,
                        minSubscribers: searchFilters.minSubscribers,
                        maxSubscribers: searchFilters.maxSubscribers,
                        channelStartDate: searchFilters.channelStartDate,
                        channelEndDate: searchFilters.channelEndDate,
                        koreanOnly: searchFilters.koreanOnly
                    },
                    this.uiManager.showNotification.bind(this.uiManager)
                );
            } else {
                // ✅ 기존 ApiHelpers.performHybridSearch 사용 (체험 로직 내장)
                videos = await ApiHelpers.performHybridSearch(
                    keyword,
                    isApiMode ? currentApiKey : '',
                    searchFilters,
                    this.uiManager.showNotification.bind(this.uiManager)
                );
            }

            // 레전드 데이터로 확장
            const enrichedVideos = this.dataManager.enrichVideosWithLegendData(
                videos, 
                keyword, 
                'single', 
                this
            );

            this.showProgressiveNotification(
                `단일 검색 완료: ${enrichedVideos.length}개 결과`, 
                'success'
            );

            return enrichedVideos;

        } catch (error) {
            console.error('단일 검색 오류:', error);
            this.handleSearchError(error);
            return [];
        } finally {
            this.uiManager.hideLoadingOverlay();
        }
    }

    /**
     * 다중 검색을 수행합니다.
     * @param {string} queryString - 쉼표로 구분된 키워드 문자열
     * @returns {Promise<Array>} 레전드 필터링된 통합 검색 결과 배열
     */
    async performMultiSearch(queryString) {
        try {
            // 키워드 분리 및 정리
            const keywords = queryString.split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

            if (keywords.length === 0) {
                this.uiManager.showNotification('유효한 검색어가 없습니다.', 'warning');
                return [];
            }

            this.uiManager.showLoadingOverlay();
            this.showProgressiveNotification(
                `다중 검색 시작: ${keywords.length}개 키워드`, 
                'info'
            );

            const { isApiMode, currentApiKey, searchFilters } = this.dataManager;
            const searchResults = [];

            // 키워드별 병렬 검색
            const searchPromises = keywords.map(async (keyword, index) => {
                try {
                    this.showProgressiveNotification(
                        `검색 중: "${keyword}" (${index + 1}/${keywords.length})`, 
                        'info'
                    );

                    let videos = [];

                    if (isApiMode && currentApiKey) {
                        // API 모드 검색 (기존 모든 필터 적용)
                        videos = await ApiHelpers.performRealSearch(
                            keyword,
                            currentApiKey,
                            {
                                sortBy: searchFilters.sortBy,
                                duration: searchFilters.duration,
                                uploadStartDate: searchFilters.uploadStartDate,
                                uploadEndDate: searchFilters.uploadEndDate,
                                maxResults: searchFilters.maxResults,
                                minViews: searchFilters.minViews,
                                maxViews: searchFilters.maxViews,
                                minSubscribers: searchFilters.minSubscribers,
                                maxSubscribers: searchFilters.maxSubscribers,
                                channelStartDate: searchFilters.channelStartDate,
                                channelEndDate: searchFilters.channelEndDate,
                                koreanOnly: searchFilters.koreanOnly
                            },
                            () => {} // 개별 키워드 알림은 숨김
                        );
                    } else {
                        // ✅ 기존 ApiHelpers.performHybridSearch 사용 (체험 로직 내장)
                        videos = await ApiHelpers.performHybridSearch(
                            keyword,
                            isApiMode ? currentApiKey : '',
                            searchFilters,
                            () => {}
                        );
                    }

                    // 레전드 데이터로 확장
                    const enrichedVideos = this.dataManager.enrichVideosWithLegendData(
                        videos, 
                        keyword, 
                        'multi', 
                        this
                    );

                    return {
                        keyword: keyword,
                        videos: enrichedVideos
                    };

                } catch (error) {
                    console.error(`키워드 "${keyword}" 검색 실패:`, error);
                    return {
                        keyword: keyword,
                        videos: []
                    };
                }
            });

            // 모든 검색 완료 대기
            const results = await Promise.all(searchPromises);
            
            // 결과 통합 및 레전드 필터링
            const mergedVideos = this.dataManager.mergeMultiSearchResults(results, this);
            
            this.showProgressiveNotification(
                `다중 검색 완료: ${mergedVideos.length}개 레전드 발견`, 
                'success'
            );

            return mergedVideos;

        } catch (error) {
            console.error('다중 검색 오류:', error);
            this.handleSearchError(error);
            return [];
        } finally {
            this.uiManager.hideLoadingOverlay();
        }
    }

    /**
     * 🚀 고속 검색 수행 (하이브리드 검색 통합)
     */
    async performSearchOptimized() {
        const query = this.searchInput ? this.searchInput.value.trim() : '';
        const { isApiMode, currentApiKey } = this.dataManager;

        if (!query) {
            this.uiManager.showNotification('검색어를 입력해주세요.', 'warning');
            return;
        }

        // API 모드일 때 API 키 유효성 검증
        if (isApiMode && !this.validateApiKey(currentApiKey)) {
            this.uiManager.showNotification('유효하지 않은 API 키입니다. API 키를 확인해주세요.', 'error');
            return;
        }

        try {
            const startTime = performance.now();
            
            // 🚀 하이브리드 검색 수행
            const videos = await this.performHybridSearch(query);
            
            const duration = Math.round(performance.now() - startTime);
            
            // 🚀 데이터 처리 및 UI 업데이트
            this.dataManager.currentVideos = videos || [];
            this.dataManager.clearSelectedVideos();

            // 🚀 검색 타입 결정
            const searchType = query.includes(',') ? 'multi' : 'single';

            // 🚀 UI 업데이트 (병렬 처리)
            await Promise.all([
                this.uiManager.updateApiButton(),
                this.videoDisplay.displaySearchResults(this.dataManager.currentVideos, searchType),
                this.uiManager.showSearchResults()
            ]);

            // 🚀 검색 타입별 완료 메시지
            const searchTypeKorean = searchType === 'multi' ? '다중' : '단일';
            this.showProgressiveNotification(
                `${searchTypeKorean} 검색 완료! ${this.dataManager.currentVideos.length}개 결과 (${duration}ms)`, 
                'success'
            );
            
            this.uiManager.updateResultActionsButtons(this.dataManager.selectedVideos.size > 0);

            // 🚀 즉시 상태 업데이트
            this.updateSearchStatusFast();

        } catch (error) {
            console.error('하이브리드 검색 오류:', error);
            this.handleSearchError(error);
        } finally {
            // 진행률 알림은 자동으로 사라지도록
            setTimeout(() => this.uiManager.hideNotification(), 1000);
        }
    }

    /**
     * 🚀 최적화된 검색 상태를 업데이트합니다. (캐싱 + 디바운스)
     */
    async updateSearchStatus() {
        return this.updateSearchStatusFast();
    }

    /**
     * 🚀 브라우저 기반 고속 상태 업데이트 (localStorage 기반)
     */
    async updateSearchStatusFast() {
        // 🚀 중복 요청 방지
        if (this.isUpdatingStatus) {
            return;
        }

        try {
            this.isUpdatingStatus = true;

            // 🚀 LRU 캐시 확인 (5초 이내 데이터 재사용 - 브라우저 기반이므로 짧게)
            const cacheKey = 'browser_status_cache';
            const cached = this.getCacheItem(cacheKey);
            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                this.updateSearchStatusUIFast(cached.value);
                return;
            }

            // 🚀 브라우저 저장소에서 즉시 상태 조회 (네트워크 요청 없음)
            const statusData = browserUsageTracker.getStatus();
            
            // 🚀 캐시 저장 (5초간 유효)
            this.setCacheItem(cacheKey, statusData, 5000);

            // 🚀 UI 업데이트
            this.updateSearchStatusUIFast(statusData);
            
            console.log('🚀 브라우저 기반 상태 업데이트 완료:', statusData);

        } catch (error) {
            console.error('브라우저 상태 업데이트 실패:', error);
            
            // 🔄 오류 시 기본 상태로 폴백
            const fallbackStatus = {
                user_remaining_searches: 5,
                daily_limit: 5,
                can_use_server_key: true,
                has_active_server_keys: true,
                isLocalStorage: true
            };
            this.updateSearchStatusUIFast(fallbackStatus);
        } finally {
            this.isUpdatingStatus = false;
        }
    }

    /**
     * 🚀 브라우저 기반 검색 완료 후 즉시 상태 업데이트
     * @param {number} remainingSearches - 남은 검색 횟수 (사용하지 않음, 호환성 유지)
     */
    updateSearchStatusImmediately(remainingSearches) {
        // 개인 API 키 확인
        const personalApiKey = this.getPersonalApiKey();
        
        // 개인키가 등록되어 있으면 상태 표시 숨김 (개인키는 무제한 사용)
        if (personalApiKey && personalApiKey.trim()) {
            this.hideSearchStatusUI();
            return;
        }

        try {
            // 🚀 서버 + 브라우저 상태 동기화된 정보 조회
            // 서버에서 최신 상태 가져오기 시도
            this.fetchServerStatusAndUpdate().catch(() => {
                // 서버 실패 시 브라우저 상태로 폴백
                console.log('서버 상태 조회 실패, 브라우저 상태 사용');
                const browserStatus = browserUsageTracker.getStatus();
                this.updateSearchStatusUIFast(browserStatus);
            });
            
        } catch (error) {
            console.error('상태 업데이트 실패:', error);
            
            // 🔄 오류 시 브라우저 상태로 폴백
            try {
                const fallbackStatus = browserUsageTracker.getStatus();
                this.updateSearchStatusUIFast(fallbackStatus);
            } catch (fallbackError) {
                console.error('폴백 상태 업데이트도 실패:', fallbackError);
            }
        }
    }

    /**
     * 🚀 서버 상태 조회 및 UI 업데이트
     */
    async fetchServerStatusAndUpdate() {
        try {
            const response = await fetch('/youtube/usage/status', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const serverStatus = await response.json();
                if (serverStatus.success) {
                    console.log(`🔄 서버 상태 동기화 완료:`, serverStatus);
                    
                    // 🔥 캐시 무효화 및 업데이트
                    this.statusCache.delete('browser_status_cache');
                    this.cacheAccessOrder.delete('browser_status_cache');
                    this.setCacheItem('browser_status_cache', serverStatus, 5000);
                    
                    // UI 업데이트
                    this.updateSearchStatusUIFast(serverStatus);
                    return;
                }
            }
            
            throw new Error('서버 상태 조회 실패');
            
        } catch (error) {
            console.warn('서버 상태 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 검색 상태 UI를 업데이트합니다.
     * @param {object} status - 검색 상태 정보
     */
    updateSearchStatusUI(status) {
        return this.updateSearchStatusUIFast(status);
    }

    /**
     * 🚀 고속 UI 상태 업데이트 (DOM 조작 최적화)
     */
    updateSearchStatusUIFast(status) {
        // 🚀 개인 API 키 확인 (캐시 활용)
        const personalApiKey = this.getPersonalApiKeyFast();
        
        if (personalApiKey && personalApiKey.trim()) {
            this.hideSearchStatusUIFast();
            return;
        }
        
        // 🚀 상태 계산
        const remaining = status.user_remaining_searches || 0;
        const dailyLimit = status.daily_limit || 5;
        const canUseServer = status.can_use_server_key;
        const hasActiveKeys = status.has_active_server_keys;
        const usedCount = dailyLimit - remaining;

        // 🚀 메시지 생성
        let statusText = '';
        let bgColor = 'rgba(0, 123, 255, 0.9)'; // 기본 파란색
        
        if (canUseServer && hasActiveKeys) {
            statusText = `체험횟수 ${usedCount}/${dailyLimit}`;
            
            // 🚀 색상 변경으로 시각적 피드백
            if (remaining <= 1) {
                bgColor = 'rgba(220, 53, 69, 0.9)'; // 빨간색 (거의 소진)
            } else if (remaining <= 2) {
                bgColor = 'rgba(255, 193, 7, 0.9)'; // 노란색 (주의)
            }
        } else if (!canUseServer) {
            statusText = `일일 체험 사용량이 모두 소진되었습니다.\n3분이면 무료 키를 만들 수 있으며 제한없이 무료사용 가능합니다.`;
            bgColor = 'rgba(220, 53, 69, 0.9)'; // 빨간색
        } else if (!hasActiveKeys) {
            statusText = `서버 키 없음`;
            bgColor = 'rgba(108, 117, 125, 0.9)'; // 회색
        }

        // 🚀 DOM 업데이트 배치 처리
        this.batchDOMUpdate(() => {
            let statusElement = document.getElementById('search-status-info');
            
            if (!statusElement && statusText) {
                statusElement = this.createStatusElementFast();
            }

            if (statusElement) {
                // 🚀 배치된 스타일 업데이트 (reflow 최소화)
                const updates = {
                    background: bgColor,
                    display: statusText ? 'block' : 'none'
                };
                
                // 🚀 텍스트 업데이트
                if (statusText.includes('\n')) {
                    statusElement.innerHTML = statusText.replace(/\n/g, '<br>');
                } else {
                    statusElement.textContent = statusText;
                }

                // 🚀 스타일 일괄 적용 (reflow 한 번만 발생)
                Object.assign(statusElement.style, updates);

                // 🚀 애니메이션 효과 (필요한 경우에만)
                if (statusText && statusElement.style.opacity !== '1') {
                    this.animateStatusElement(statusElement);
                }
            }
        });
    }

    /**
     * 검색 상태 UI를 숨깁니다.
     */
    hideSearchStatusUI() {
        return this.hideSearchStatusUIFast();
    }

    /**
     * 🚀 고속 상태 숨김
     */
    hideSearchStatusUIFast() {
        requestAnimationFrame(() => {
            const statusElement = document.getElementById('search-status-info');
            if (statusElement) {
                statusElement.style.display = 'none';
            }
        });
    }

    /**
     * 개인 API 키를 가져옵니다.
     * @returns {string} 개인 API 키
     */
    getPersonalApiKey() {
        return this.getPersonalApiKeyFast();
    }

    /**
     * 🚀 고속 개인 API 키 확인 (캐싱)
     */
    getPersonalApiKeyFast() {
        // 🚀 캐시 확인
        if (this._personalApiKeyCache && Date.now() - this._personalApiKeyCache.timestamp < 1000) {
            return this._personalApiKeyCache.value;
        }

        try {
            let apiKey = '';
            
            // localStorage 확인
            const savedApiKey = localStorage.getItem('youtube_api_key');
            if (savedApiKey) {
                apiKey = savedApiKey;
            } else {
                // 입력 필드 확인
                const apiKeyInput = document.getElementById('api-key-input');
                if (apiKeyInput && apiKeyInput.value.trim()) {
                    apiKey = apiKeyInput.value.trim();
                }
            }
            
            // 🚀 캐시 저장
            this._personalApiKeyCache = {
                value: apiKey,
                timestamp: Date.now()
            };
            
            return apiKey;
        } catch (error) {
            console.error('개인 API 키 확인 실패:', error);
            return '';
        }
    }

    /**
     * API 키 유효성을 검증합니다.
     * @param {string} apiKey - 검증할 API 키.
     * @returns {boolean} 유효성 여부.
     */
    validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // YouTube Data API 키 형식 검증 (AIza로 시작하는 39자리)
        const apiKeyPattern = /^AIza[0-9A-Za-z-_]{35}$/;
        return apiKeyPattern.test(apiKey);
    }

    /**
    * 필터 모달에서 '적용' 버튼 클릭 시 호출됩니다.
    * 현재 UI의 필터 값을 DataManager에 저장합니다.
    */
    applyFilters() {
        const filters = this.dataManager.searchFilters;
    
        // UI에서 현재 필터 값을 가져와 DataManager에 업데이트
        const sortByElement = document.getElementById('sort-by');
        const durationElement = document.getElementById('duration');
        // const uploadDateElement = document.getElementById('upload-date');  // ✅ 제거 (HTML에 없음)
        const uploadStartDateElement = document.getElementById('upload-start-date');
        const uploadEndDateElement = document.getElementById('upload-end-date');
        const minViewsElement = document.getElementById('min-views');
        const maxViewsElement = document.getElementById('max-views');
        const minSubscribersElement = document.getElementById('min-subscribers');
        const maxSubscribersElement = document.getElementById('max-subscribers');
        const maxResultsElement = document.getElementById('max-results');
        const channelStartDateElement = document.getElementById('channel-start-date');  // ✅ 추가
        const channelEndDateElement = document.getElementById('channel-end-date');      // ✅ 추가
        // const channelYearElement = document.getElementById('channel-year');  // ✅ 제거 (HTML에 없음)
        const koreanOnlyElement = document.getElementById('korean-only');
        const legendScoreInputElement = document.getElementById('legend-score-input');  // 🎯 레전드점수 최소값
        // const channelTypeElement = document.getElementById('channel-type');  // ✅ 제거 (HTML에 없음)
        // const videoDimensionElement = document.getElementById('video-dimension');  // ✅ 제거 (HTML에 없음) 
    
        if (sortByElement) filters.sortBy = sortByElement.value;
        if (durationElement) filters.duration = durationElement.value;
        // if (uploadDateElement) filters.uploadDate = uploadDateElement.value;  // ✅ 제거
        if (uploadStartDateElement) filters.uploadStartDate = uploadStartDateElement.value;
        if (uploadEndDateElement) filters.uploadEndDate = uploadEndDateElement.value;
        if (minViewsElement) filters.minViews = minViewsElement.value;
        if (maxViewsElement) filters.maxViews = maxViewsElement.value;
        if (minSubscribersElement) filters.minSubscribers = minSubscribersElement.value;
        if (maxSubscribersElement) filters.maxSubscribers = maxSubscribersElement.value; 
        if (maxResultsElement) filters.maxResults = parseInt(maxResultsElement.value) || 50;
        if (channelStartDateElement) filters.channelStartDate = channelStartDateElement.value;  // ✅ 추가
        if (channelEndDateElement) filters.channelEndDate = channelEndDateElement.value;        // ✅ 추가
        // if (channelYearElement) filters.channelYear = channelYearElement.value;  // ✅ 제거
        if (koreanOnlyElement) filters.koreanOnly = koreanOnlyElement.checked;
        if (legendScoreInputElement) filters.legendScoreMin = parseInt(legendScoreInputElement.value) || 100;  // 🎯 레전드점수 최소값 저장
        // if (channelTypeElement) filters.channelType = channelTypeElement.value;  // ✅ 제거
        // if (videoDimensionElement) filters.videoDimension = videoDimensionElement.value;  // ✅ 제거 

        // ✅ 추가: min/max views 유효성 검증
        const parsedMinViews = parseInt(filters.minViews);
        const parsedMaxViews = parseInt(filters.maxViews);

        if (!isNaN(parsedMinViews) && !isNaN(parsedMaxViews) && parsedMaxViews !== 0) {
            if (parsedMinViews > parsedMaxViews) {
                this.uiManager.showNotification('최대 조회수는 최소 조회수보다 크거나 같아야 합니다.', 'error');
                return; // Stop applying filters
            }
        } 

        // ⭐ NEW: Validate min/max subscribers
        const parsedMinSubscribers = parseInt(filters.minSubscribers);
        const parsedMaxSubscribers = parseInt(filters.maxSubscribers);

        if (!isNaN(parsedMinSubscribers) && !isNaN(parsedMaxSubscribers) && parsedMaxSubscribers !== 0) {
            if (parsedMinSubscribers > parsedMaxSubscribers) {
                this.uiManager.showNotification('최대 구독자 수는 최소 구독자 수보다 크거나 같아야 합니다.', 'error');
                return; // Stop applying filters
            }
        }

        // ✅ 추가: 업로드일 범위 유효성 검증
        if (filters.uploadStartDate && filters.uploadEndDate) {
            const startDate = new Date(filters.uploadStartDate);
            const endDate = new Date(filters.uploadEndDate);
            
            if (startDate > endDate) {
                this.uiManager.showNotification('업로드 종료일은 시작일보다 늦어야 합니다.', 'error');
                return;
            }
        }

        // ✅ 추가: 채널 개설일 범위 유효성 검증
        if (filters.channelStartDate && filters.channelEndDate) {
            const startDate = new Date(filters.channelStartDate);
            const endDate = new Date(filters.channelEndDate);
            
            if (startDate > endDate) {
                this.uiManager.showNotification('채널 개설일 종료일은 시작일보다 늦어야 합니다.', 'error');
                return;
            }
        }
    
        // DataManager에 변경된 필터 저장
        this.dataManager.saveSettings();
    
        const filterModal = document.getElementById('filter-modal');
        if (filterModal) {
            this.uiManager.closeModal(filterModal);
        }
        
        this.uiManager.showNotification('필터가 적용되었습니다.', 'info');
    }
    
    /**
     * 검색 필터를 초기 상태로 재설정합니다.
     */
    resetFilters() {
        // DataManager의 필터 설정을 기본값으로 재설정
        this.dataManager.searchFilters = {
            sortBy: 'relevance',
            duration: 'any',
            // uploadDate: 'any',        // ✅ 제거 (사용 안됨)
            uploadStartDate: '',
            uploadEndDate: '',
            minViews: '',
            maxViews: '',
            minSubscribers: '',
            maxSubscribers: '', 
            maxResults: 50,
            channelStartDate: '',     // ✅ 추가
            channelEndDate: '',       // ✅ 추가
            // channelYear: '',          // ✅ 제거 (사용 안됨)
            koreanOnly: true,
            legendScoreMin: 100       // 🎯 레전드점수 최소값 기본값
            // channelType: 'any',       // ✅ 제거 (사용 안됨)
            // videoDimension: 'any'     // ✅ 제거 (사용 안됨)
        };
        this.dataManager.saveSettings(); // 재설정된 필터 저장
        
        this.uiManager.showNotification('필터가 초기화되었습니다.', 'info');
    
        // UI에 초기화된 값들 반영
        this._updateFilterModalUI();
    }
    
    /**
     * 필터 모달의 UI를 현재 필터 값으로 업데이트합니다.
     * @private
     */
    _updateFilterModalUI() {
        const filters = this.dataManager.searchFilters;
        
        const sortBySelect = document.getElementById('sort-by');
        const durationSelect = document.getElementById('duration');
        // const uploadDateSelect = document.getElementById('upload-date');  // ✅ 제거
        const uploadStartDateInput = document.getElementById('upload-start-date');
        const uploadEndDateInput = document.getElementById('upload-end-date');
        const minViewsInput = document.getElementById('min-views');
        const maxViewsInput = document.getElementById('max-views');
        const minSubscribersInput = document.getElementById('min-subscribers');
        const maxSubscribersInput = document.getElementById('max-subscribers'); 
        const maxResultsInput = document.getElementById('max-results');
        const channelStartDateInput = document.getElementById('channel-start-date');  // ✅ 추가
        const channelEndDateInput = document.getElementById('channel-end-date');      // ✅ 추가
        // const channelYearInput = document.getElementById('channel-year');  // ✅ 제거
        const koreanOnlyCheckbox = document.getElementById('korean-only');
        // const channelTypeSelect = document.getElementById('channel-type');  // ✅ 제거
        // const videoDimensionSelect = document.getElementById('video-dimension');  // ✅ 제거
        
        if (sortBySelect) sortBySelect.value = filters.sortBy;
        if (durationSelect) durationSelect.value = filters.duration;
        // if (uploadDateSelect) uploadDateSelect.value = filters.uploadDate;  // ✅ 제거
        if (uploadStartDateInput) uploadStartDateInput.value = filters.uploadStartDate;
        if (uploadEndDateInput) uploadEndDateInput.value = filters.uploadEndDate;
        if (minViewsInput) minViewsInput.value = filters.minViews;
        if (maxViewsInput) maxViewsInput.value = filters.maxViews;
        if (minSubscribersInput) minSubscribersInput.value = filters.minSubscribers;
        if (maxSubscribersInput) maxSubscribersInput.value = filters.maxSubscribers; 
        if (maxResultsInput) maxResultsInput.value = filters.maxResults;
        if (channelStartDateInput) channelStartDateInput.value = filters.channelStartDate;  // ✅ 추가
        if (channelEndDateInput) channelEndDateInput.value = filters.channelEndDate;        // ✅ 추가
        // if (channelYearInput) channelYearInput.value = filters.channelYear;  // ✅ 제거
        if (koreanOnlyCheckbox) koreanOnlyCheckbox.checked = filters.koreanOnly;
        // if (channelTypeSelect) channelTypeSelect.value = filters.channelType;  // ✅ 제거
        // if (videoDimensionSelect) videoDimensionSelect.value = filters.videoDimension;  // ✅ 제거 
    }

    /**
     * 다음 페이지 검색을 수행합니다.
     */
    async goToNextPage() {
        if (this.dataManager.nextPageToken) {
            this.dataManager.currentPage++;
            await this.performSearch();
        } else {
            this.uiManager.showNotification('다음 페이지가 없습니다.', 'warning');
        }
    }

    /**
     * 이전 페이지 검색을 수행합니다.
     */
    async goToPrevPage() {
        if (this.dataManager.prevPageToken && this.dataManager.currentPage > 1) {
            this.dataManager.currentPage--;
            await this.performSearch(); // 이전 페이지 토큰으로 검색
        } else {
            this.uiManager.showNotification('이전 페이지가 없습니다.', 'warning');
        }
    }

    /**
     * 현재 검색 결과를 새로고침합니다.
     */
    refreshSearch() {
        if (this.searchInput && this.searchInput.value.trim()) {
            this.performSearch();
        } else {
            this.uiManager.showNotification('검색어를 입력한 후 새로고침해주세요.', 'warning');
        }
    }

    /**
     * 검색 입력 필드를 지웁니다.
     */
    clearSearchInput() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.searchInput.focus();
        }
    }

    /**
     * 현재 검색어를 반환합니다.
     * @returns {string} 현재 검색어
     */
    getCurrentQuery() {
        return this.searchInput ? this.searchInput.value.trim() : '';
    }

    /**
     * 검색어를 설정합니다.
     * @param {string} query - 설정할 검색어
     */
    setQuery(query) {
        if (this.searchInput) {
            this.searchInput.value = query;
        }
    }

    /**
     * 🚀 상태 요소 생성 (최적화된 DOM 조작)
     */
    createStatusElementFast() {
        const statusElement = document.createElement('div');
        statusElement.id = 'search-status-info';
        statusElement.className = 'search-status-info';
        
        // 🚀 최적화된 스타일 적용
        Object.assign(statusElement.style, {
            position: 'fixed',
            top: '60px',
            right: '20px',
            background: 'rgba(0, 123, 255, 0.9)',
            color: 'white',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            zIndex: '9999',
            maxWidth: '220px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.3s ease',
            opacity: '0',
            transform: 'translateY(-10px)'
        });
        
        document.body.appendChild(statusElement);
        return statusElement;
    }

    /**
     * 🚀 진행률 표시 알림 (실시간 피드백)
     */
    showProgressiveNotification(message, type, duration = 0) {
        // 🚀 즉시 표시 (지연 없음)
        requestAnimationFrame(() => {
            this.uiManager.showNotification(message, type, duration);
        });
    }

    /**
     * 🚀 검색 오류 처리
     */
    handleSearchError(error) {
        let errorMessage = '검색 중 오류가 발생했습니다.';
        
        if (error.message.includes('timeout') || error.name === 'AbortError') {
            errorMessage = '검색 시간이 초과되었습니다. 다시 시도해주세요.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = '네트워크 연결을 확인해주세요.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        this.showProgressiveNotification(errorMessage, 'error');
        this.uiManager.showYouTubeHome();
    }

    /**
     * 🚀 디바운스 유틸리티
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 🚀 성능 모니터링
     */
    getPerformanceMetrics() {
        return {
            cacheHits: this.statusCache.size,
            lastUpdate: this._personalApiKeyCache?.timestamp || 0,
            isUpdating: this.isUpdatingStatus,
            queueLength: this.statusUpdateQueue.length
        };
    }

    /**
     * 🚀 DOM 업데이트 배치 처리 (성능 최적화)
     */
    batchDOMUpdate(updateFn) {
        if (this.pendingUpdate) return;
        
        this.pendingUpdate = requestAnimationFrame(() => {
            try {
                updateFn();
            } catch (error) {
                console.error('DOM 업데이트 오류:', error);
            } finally {
                this.pendingUpdate = null;
            }
        });
    }

    /**
     * 🚀 메모리 누수 방지: 리소스 정리 핸들러 설정
     */
    setupCleanupHandlers() {
        // 페이지 언로드 시 정리
        const cleanup = () => this.cleanup();
        
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('pagehide', cleanup);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanupCache();
            }
        });
        
        this.cleanupHandlers.push(
            () => window.removeEventListener('beforeunload', cleanup),
            () => window.removeEventListener('pagehide', cleanup)
        );
    }

    /**
     * 🚀 LRU 캐시 정리 (메모리 제한)
     */
    cleanupCache() {
        if (this.statusCache.size <= this.maxCacheSize) {
            return;
        }

        // LRU 정리: 가장 오래된 항목부터 제거
        const itemsToRemove = this.statusCache.size - this.maxCacheSize;
        const sortedByAccess = [...this.cacheAccessOrder.entries()]
            .sort((a, b) => a[1] - b[1])
            .slice(0, itemsToRemove);

        sortedByAccess.forEach(([key]) => {
            this.statusCache.delete(key);
            this.cacheAccessOrder.delete(key);
        });

        console.log(`🧹 캐시 정리 완료: ${itemsToRemove}개 항목 제거`);
    }

    /**
     * 🚀 캐시 접근 추적 (LRU 구현)
     */
    trackCacheAccess(key) {
        this.cacheAccessOrder.set(key, Date.now());
    }

    /**
     * 🚀 향상된 캐시 get (LRU 추적)
     */
    getCacheItem(key) {
        if (this.statusCache.has(key)) {
            this.trackCacheAccess(key);
            return this.statusCache.get(key);
        }
        return null;
    }

    /**
     * 🚀 향상된 캐시 set (LRU 추적)
     */
    setCacheItem(key, value, ttl = 30000) {
        this.statusCache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });
        this.trackCacheAccess(key);
        
        // 크기 제한 확인
        if (this.statusCache.size > this.maxCacheSize) {
            this.cleanupCache();
        }
    }

    /**
     * 🚀 상태 요소 애니메이션 (성능 최적화)
     */
    animateStatusElement(element) {
        // GPU 가속을 위한 will-change 속성 설정
        element.style.willChange = 'opacity, transform';
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        
        // RAF를 사용한 부드러운 애니메이션
        requestAnimationFrame(() => {
            element.style.transition = 'all 0.3s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
            
            // 애니메이션 완료 후 will-change 제거 (메모리 절약)
            setTimeout(() => {
                element.style.willChange = 'auto';
            }, 300);
        });
    }

    /**
     * 🚀 Virtual DOM 스타일 배치 업데이트
     */
    batchStyleUpdate(element, styles) {
        // 기존 스타일 읽기 (reflow 발생)
        const computedStyle = getComputedStyle(element);
        const needsUpdate = Object.entries(styles).some(([prop, value]) => 
            computedStyle[prop] !== value
        );
        
        // 변경이 필요한 경우에만 업데이트
        if (needsUpdate) {
            Object.assign(element.style, styles);
        }
        
        return needsUpdate;
    }

    /**
     * 레전드 점수를 계산합니다.
     * @param {object} video - 영상 데이터 객체
     * @param {number} video.viewCount - 조회수
     * @param {string} video.publishedAt - 업로드 날짜 (ISO 8601 형식)
     * @param {number} video.subscriberCount - 채널 구독자 수
     * @returns {object} { score: number, tier: string, monthsElapsed: number, subscriberWeight: number }
     */
    calculateLegendScore(video) {
        try {
            // 데이터 구조 확인
            const snippet = video.snippet || {};
            const statistics = video.statistics || {};
            const channelStatistics = video.channelStatistics || {};
            
            // 1단계: 경과 개월 수 계산
            const publishedAt = snippet.publishedAt || video.publishedAt;
            if (!publishedAt) {
                console.warn('업로드일 데이터가 없습니다:', video);
                return 0;
            }
            
            const uploadDate = new Date(publishedAt);
            const currentDate = new Date();
            
            const yearDiff = currentDate.getFullYear() - uploadDate.getFullYear();
            const monthDiff = currentDate.getMonth() - uploadDate.getMonth();
            const monthsElapsed = Math.max(1, yearDiff * 12 + monthDiff); // 최소 1개월 보장
            
            // 2단계: 구독자 가중치 계산
            const subscriberCount = parseInt(channelStatistics.subscriberCount || video.subscriberCount) || 0;
            let subscriberWeight;
            
            if (subscriberCount < 10000) {
                subscriberWeight = 1.0; // 작은 채널 우대
            } else if (subscriberCount < 100000) {
                subscriberWeight = 0.8;
            } else if (subscriberCount < 1000000) {
                subscriberWeight = 0.6;
            } else {
                subscriberWeight = 0.4; // 대형 채널 가중치 축소
            }
            
            // 3단계: 최종 레전드 점수 계산
            const viewCount = parseInt(statistics.viewCount || video.viewCount) || 0;
            if (viewCount === 0) {
                console.warn('조회수 데이터가 없습니다:', video);
                return 0;
            }
            
            const rawScore = (viewCount / monthsElapsed) * subscriberWeight;
            const legendScore = Math.round(rawScore);
            
            // 4단계: 레전드 등급 분류
            let tier;
            if (legendScore >= 100000) {
                tier = '슈퍼레전드';
            } else if (legendScore >= 60000) {
                tier = '레전드';
            } else if (legendScore >= 30000) {
                tier = '준레전드';
            } else {
                tier = '일반';
            }
            
            return {
                score: legendScore,
                tier: tier,
                monthsElapsed: monthsElapsed,
                subscriberWeight: subscriberWeight
            };
            
        } catch (error) {
            console.error('레전드 점수 계산 오류:', error);
            return {
                score: 0,
                tier: '일반',
                monthsElapsed: 1,
                subscriberWeight: 1.0
            };
        }
    }


    /**
     * 🚀 모든 리소스 정리
     */
    cleanup() {
        // 인터벌 정리
        this.activeIntervals.forEach(interval => clearInterval(interval));
        this.activeIntervals.clear();
        
        // 타임아웃 정리
        this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
        this.activeTimeouts.clear();
        
        // DOM 업데이트 대기 중인 작업 취소
        if (this.pendingUpdate) {
            cancelAnimationFrame(this.pendingUpdate);
            this.pendingUpdate = null;
        }
        
        // 이벤트 리스너 정리
        this.cleanupHandlers.forEach(handler => handler());
        this.cleanupHandlers.length = 0;
        
        // 캐시 정리
        this.statusCache.clear();
        this.cacheAccessOrder.clear();
        
        console.log('🧹 SearchManager 리소스 정리 완료');
    }
}

export default SearchManager;
