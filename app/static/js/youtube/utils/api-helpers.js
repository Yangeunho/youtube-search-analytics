/**
 * @fileoverview API 통신 관련 헬퍼 함수들을 제공합니다.
 * YouTube Data API와의 통신, 오류 처리, 데모 검색 등을 관리합니다.
 */

import YouTubeCalculations from './calculations.js';
import browserUsageTracker from './browser-usage-tracker.js';

/**
 * 🚀 요청 배치 및 중복 제거 관리자
 */
class RequestManager {
    constructor() {
        this.batchQueue = new Map();
        this.batchTimeout = null;
        this.batchDelay = 50; // 50ms 배치 지연
        this.batchSize = 5;   // 최대 5개 요청을 배치로 처리
        this.pendingRequests = new Map(); // 중복 요청 방지
        this.requestCache = new Map(); // 요청 결과 캐시
        this.maxCacheSize = 100;
        this.cacheAccessOrder = new Map(); // LRU 캐시용
    }

    /**
     * 🚀 요청 중복 제거 및 배치 처리
     */
    async request(url, options = {}) {
        const requestKey = this.generateRequestKey(url, options);
        
        // 1. 캐시 확인 (5분 유효)
        const cached = this.getFromCache(requestKey);
        if (cached) {
            return cached;
        }

        // 2. 진행 중인 요청 확인 (중복 제거)
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }

        // 3. 새 요청 생성
        const requestPromise = this.createRequest(url, options);
        this.pendingRequests.set(requestKey, requestPromise);

        try {
            const result = await requestPromise;
            this.setToCache(requestKey, result);
            return result;
        } finally {
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * 🚀 요청 키 생성 (URL과 옵션 기반)
     */
    generateRequestKey(url, options) {
        const method = options.method || 'GET';
        const body = options.body || '';
        const headers = JSON.stringify(options.headers || {});
        return `${method}:${url}:${headers}:${body}`;
    }

    /**
     * 🚀 실제 요청 생성
     */
    async createRequest(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * 🚀 LRU 캐시에서 조회
     */
    getFromCache(key) {
        const cached = this.requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < 300000) { // 5분 유효
            this.cacheAccessOrder.set(key, Date.now());
            return cached.data;
        }
        return null;
    }

    /**
     * 🚀 LRU 캐시에 저장
     */
    setToCache(key, data) {
        // 캐시 크기 제한
        if (this.requestCache.size >= this.maxCacheSize) {
            this.evictLRU();
        }

        this.requestCache.set(key, {
            data,
            timestamp: Date.now()
        });
        this.cacheAccessOrder.set(key, Date.now());
    }

    /**
     * 🚀 LRU 캐시 정리
     */
    evictLRU() {
        const oldestKey = [...this.cacheAccessOrder.entries()]
            .sort((a, b) => a[1] - b[1])[0][0];
        
        this.requestCache.delete(oldestKey);
        this.cacheAccessOrder.delete(oldestKey);
    }

    /**
     * 🚀 캐시 정리
     */
    clearCache() {
        this.requestCache.clear();
        this.cacheAccessOrder.clear();
        this.pendingRequests.clear();
    }
}

// 전역 요청 관리자 인스턴스
const requestManager = new RequestManager();

/**
 * 🚀 메모이제이션 유틸리티
 */
function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    const maxCacheSize = 1000;
    const accessOrder = new Map();
    
    return function(...args) {
        const key = keyFn(...args);
        
        // 캐시 히트
        if (cache.has(key)) {
            accessOrder.set(key, Date.now());
            return cache.get(key);
        }
        
        // LRU 정리
        if (cache.size >= maxCacheSize) {
            const oldestKey = [...accessOrder.entries()]
                .sort((a, b) => a[1] - b[1])[0][0];
            cache.delete(oldestKey);
            accessOrder.delete(oldestKey);
        }
        
        // 계산 및 캐시 저장
        const result = fn.apply(this, args);
        cache.set(key, result);
        accessOrder.set(key, Date.now());
        
        return result;
    };
}

class ApiHelpers {
    /**
     * 개인 API 키를 가져옵니다.
     * @returns {string} 개인 API 키
     */
    static getPersonalApiKey() {
        try {
            // 로컬 스토리지에서 개인 API 키 확인
            const savedApiKey = localStorage.getItem('youtube_api_key');
            if (savedApiKey) {
                return savedApiKey;
            }
            
            // API 키 입력 필드에서 확인
            const apiKeyInput = document.getElementById('api-key-input');
            if (apiKeyInput && apiKeyInput.value.trim()) {
                return apiKeyInput.value.trim();
            }
            
            return '';
        } catch (error) {
            console.error('개인 API 키 확인 실패:', error);
            return '';
        }
    }

    /**
     * 🚀 최적화된 하이브리드 검색을 수행합니다.
     * 개인 API 키 → 서버 API 키 (1일 5회) → 데모 모드 순서로 검색 (병렬 처리 최적화)
     * @param {string} query - 검색어.
     * @param {string} personalApiKey - 개인 API 키 (선택사항).
     * @param {object} filters - 검색 필터 객체.
     * @param {Function} showNotification - 알림을 표시하는 콜백 함수.
     * @returns {Promise<Array<object>>} 검색 결과 비디오 배열.
     * @throws {Error} API 요청 실패 시.
     */
    static async performHybridSearch(query, personalApiKey, filters, showNotification) {
        console.log('🚀 최적화된 하이브리드 검색 시작:', { query, hasPersonalKey: !!personalApiKey });
        const startTime = performance.now();
        
        let keyData; 
        try {
            // 1단계: 개인 API 키가 있으면 우선 사용 (가장 빠름)
            if (personalApiKey && personalApiKey.trim()) {
                try {
                    console.log('📝 개인 API 키로 검색 시도');
                    showNotification('개인 API 키로 검색 중...', 'info');
                    const videos = await this.performDirectYouTubeSearch(query, personalApiKey, filters, showNotification);
                    showNotification('개인 API 키로 검색되었습니다.', 'success');
                    console.log(`✅ 개인 API 키 검색 성공: ${videos.length}개 (${Math.round(performance.now() - startTime)}ms)`);
                    return videos;
                } catch (error) {
                    console.warn('❌ 개인 API 키 검색 실패:', error);
                    showNotification('개인 API 키 검색 실패, 서버 키로 시도합니다.', 'warning');
                }
            }

            // ===================== [수정 1] 할당량 선확인 로직 =====================
            // 서버 키를 사용하기 전, 브라우저 사용량 한도를 먼저 확인합니다.
            if (!browserUsageTracker.canSearch()) {
                console.log('🚫 브라우저 사용량 한도 초과, 데모 모드로 즉시 전환');
                showNotification('일일 체험 한도를 초과하여 데모 모드로 전환합니다.', 'warning');
                throw new Error('FALLBACK_TO_DEMO');
            }
            // ====================================================================

            // 2단계: 🚀 브라우저 기반 서버 키 검색
            try {
                console.log('🔧 브라우저 기반 서버 키 검색 시도');
                showNotification('서버 API 키로 검색 중...', 'info');
                
                keyData = await requestManager.request('/youtube/server-key/get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ forceRefresh: true })
                });

                if (keyData.success && keyData.apiKey) {
                    try {
                        const serverVideos = await this.performDirectYouTubeSearch(query, keyData.apiKey, filters, showNotification);
                        
                        // ===================== [수정 2] 사용량 증가 로직 =====================
                        // 체험 검색이 성공했으므로 여기서 사용량 카운트를 증가시킵니다.
                        try {
                            browserUsageTracker.incrementUsage();
                        } catch (e) {
                            console.warn('사용량 증가에 실패했습니다 (이미 한도 초과).', e.message);
                        }
                        // ================================================================
                        
                        const currentPersonalApiKey = ApiHelpers.getPersonalApiKey();
                        
                        if (!currentPersonalApiKey || !currentPersonalApiKey.trim()) {
                            showNotification(`체험 검색 완료!`, 'info');
                        } else {
                            showNotification(`서버 API 키로 검색되었습니다.`, 'success');
                        }
                        
                        console.log(`✅ 브라우저 기반 서버 키 검색 성공: ${serverVideos.length}개 (${Math.round(performance.now() - startTime)}ms)`);
                        return serverVideos;
                        
                    } catch (usageError) {
                        if (usageError.message.includes('한도')) {
                            console.log('🚫 브라우저 사용량 한도 도달 - 데모모드로 전환');
                            throw new Error('FALLBACK_TO_DEMO');
                        }
                        throw usageError;
                    }
                } else {
                    console.log('❌ 서버 키를 가져오지 못했습니다:', keyData);
                    showNotification('서버 키를 가져올 수 없어 데모 모드로 전환합니다.', 'warning');
                    throw new Error('FALLBACK_TO_DEMO');
                }

            } catch (error) {
                if (error.message === 'FALLBACK_TO_DEMO') {
                    throw error; 
                }
                
                console.warn('❌ 브라우저 기반 서버 키 검색 실패:', error);
                showNotification('서버 키 검색 실패, 데모 모드로 전환합니다.', 'warning');
                throw new Error('FALLBACK_TO_DEMO');
            }

        } catch (error) {
            // 데모모드 전환 신호인 경우 데모 검색 실행
            if (error.message === 'FALLBACK_TO_DEMO') {
                console.log('🎭 데모 모드 검색 시작');
                showNotification('데모 모드로 검색 중...', 'info');
                const demoVideos = await this.performDemoSearchFast(query, filters, showNotification);
                console.log(`✅ 데모 모드 검색 완료: ${demoVideos.length}개 (${Math.round(performance.now() - startTime)}ms)`);
                return demoVideos;
            }
            
            console.error('💥 최적화된 하이브리드 검색 중 예상치 못한 오류:', error);
            showNotification(error.message || '검색 중 오류가 발생했습니다.', 'error');
            throw error;
        }
    }

    /**
     * 🚀 최적화된 백엔드 통합 검색을 수행합니다 (타임아웃 적용)
     * @param {string} query - 검색어.
     * @param {string} apiKey - YouTube Data API 키.
     * @param {object} filters - 검색 필터 객체.
     * @param {Function} showNotification - 알림을 표시하는 콜백 함수.
     * @returns {Promise<Array<object>>} 검색 결과 비디오 배열.
     */
    static async performBackendSearch(query, apiKey, filters, showNotification) {
        return this.performBackendSearchFast(query, apiKey, filters, showNotification, false); // 기본값은 개인 키
    }

    /**
     * 🚀 고속 백엔드 검색 (타임아웃 및 병렬 처리 최적화)
     */
    static async performBackendSearchFast(query, apiKey, filters, showNotification, isServerKey = false) {
        const requestData = {
            query: query,
            apiKey: apiKey,
            isServerKey: isServerKey, 
            maxResults: filters.maxResults || 20,
            sortBy: filters.sortBy || 'relevance',
            duration: filters.duration || 'any',
            minViews: filters.minViews || 0,
            maxViews: filters.maxViews || '',
            minSubscribers: filters.minSubscribers || 0,
            maxSubscribers: filters.maxSubscribers || '',
            uploadStartDate: filters.uploadStartDate || '',
            uploadEndDate: filters.uploadEndDate || '',
            channelStartDate: filters.channelStartDate || '',
            channelEndDate: filters.channelEndDate || '',
            koreanOnly: filters.koreanOnly || false
        };

        console.log('🔍 백엔드 검색 요청 데이터:', {
            query: requestData.query,
            isServerKey: requestData.isServerKey,
            apiKey: requestData.apiKey ? requestData.apiKey.substring(0, 10) + '...' : 'None'
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

        try {
            const response = await fetch('/Youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ 고속 백엔드 검색 성공: ${data.items?.length || 0}개`);
            return data.items || [];

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('검색 시간이 초과되었습니다. 다시 시도해주세요.');
            }
            console.error('고속 백엔드 검색 오류:', error);
            this.handleYouTubeApiError(error, showNotification);
            throw error;
        }
    }

    /**
     * YouTube API를 통해 실제 검색을 수행합니다.
     * 🔧 새로운 방식: YouTube Data API v3를 직접 호출
     * @param {string} query - 검색어.
     * @param {string} apiKey - YouTube Data API 키.
     * @param {object} filters - 검색 필터 객체.
     * @param {Function} showNotification - 알림을 표시하는 콜백 함수.
     * @returns {Promise<Array<object>>} 검색 결과 비디오 배열.
     * @throws {Error} API 요청 실패 시.
     */
    static async performRealSearch(query, apiKey, filters, showNotification) {
        if (!apiKey) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        try {
            return await this.performDirectYouTubeSearch(query, apiKey, filters, showNotification);
            
        } catch (error) {
            console.error('YouTube API 검색 오류:', error);
            this.handleYouTubeApiError(error, showNotification);
            throw error;
        }
    }

    /**
     * YouTube Data API v3를 직접 호출하여 검색을 수행합니다.
     * 백엔드 로직을 최대한 반영한 구현
     * @param {string} query - 검색어.
     * @param {string} apiKey - YouTube Data API 키.
     * @param {object} filters - 검색 필터 객체.
     * @param {Function} showNotification - 알림을 표시하는 콜백 함수.
     * @returns {Promise<Array<object>>} 검색 결과 비디오 배열.
     */
    static async performDirectYouTubeSearch(query, apiKey, filters, showNotification) {
        const baseUrl = 'https://www.googleapis.com/youtube/v3';
        let allEnrichedItems = [];
        let pageToken = null;
        const API_MAX_RESULTS_PER_PAGE = 50;
        
        const maxApiCalls = 10;
        let apiCallCount = 0;
        const desiredMaxResults = parseInt(filters.maxResults) || 50;

        while (allEnrichedItems.length < desiredMaxResults && apiCallCount < maxApiCalls) {
            apiCallCount++;
            
            const remainingNeeded = desiredMaxResults - allEnrichedItems.length;
            let numToFetch;
            
            if (filters.duration && ['short', 'medium'].includes(filters.duration) && apiCallCount > 1) {
                numToFetch = Math.min(API_MAX_RESULTS_PER_PAGE, remainingNeeded * 2);
            } else {
                numToFetch = Math.min(API_MAX_RESULTS_PER_PAGE, remainingNeeded);
            }

            const searchParams = this.buildSearchParams(query, apiKey, filters, pageToken, numToFetch);
            const searchUrl = `${baseUrl}/search?${searchParams}`;
            
            console.log(`API 호출 ${apiCallCount}: ${searchUrl}`);
            
            const searchResponse = await fetch(searchUrl);
            if (!searchResponse.ok) {
                const errorData = await searchResponse.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP 오류: ${searchResponse.status}`);
            }
            
            const searchData = await searchResponse.json();
            const videoIds = searchData.items
                ?.filter(item => item.id?.videoId)
                ?.map(item => item.id.videoId) || [];
            
            if (videoIds.length === 0) {
                console.log(`API 호출 ${apiCallCount}: 더 이상 검색할 비디오가 없습니다.`);
                break;
            }

            const videosData = await this.fetchVideoDetails(baseUrl, apiKey, videoIds);
            
            const channelIds = [...new Set(videosData.map(video => video.snippet?.channelId).filter(Boolean))];
            const channelsDict = await this.fetchChannelDetails(baseUrl, apiKey, channelIds);
            
            const beforeFilterCount = videosData.length;
            let itemsAddedThisRound = 0;
            
            for (const video of videosData) {
                if (allEnrichedItems.length >= desiredMaxResults) break;

                const channelId = video.snippet?.channelId;
                const channelInfo = channelsDict[channelId] || {};
                
                const enrichedVideo = {
                    ...video,
                    channelSnippet: channelInfo.snippet || {},
                    channelStatistics: channelInfo.statistics || {}
                };

                this.enrichVideoWithCalculationsMemoized(enrichedVideo, channelInfo);

                if (!this.passesClientSideFiltersMemoized(enrichedVideo, filters)) {
                    continue;
                }

                allEnrichedItems.push(enrichedVideo);
                itemsAddedThisRound++;
            }

            console.log(`API 호출 ${apiCallCount}: ${beforeFilterCount}개 검색 → ${itemsAddedThisRound}개 추가 (총 ${allEnrichedItems.length}/${desiredMaxResults}개)`);

            pageToken = searchData.nextPageToken;
            if (!pageToken) {
                console.log("더 이상 검색할 페이지가 없습니다.");
                break;
            }
        }

        console.log(`검색 완료: 요청 ${desiredMaxResults}개 → 실제 ${allEnrichedItems.length}개 제공 (API 호출 ${apiCallCount}회)`);
        
        return allEnrichedItems;
    }

    /**
     * Youtube API 파라미터를 구성합니다.
     * 백엔드 로직을 반영한 파라미터 구성
     */
    static buildSearchParams(query, apiKey, filters, pageToken, maxResults) {
        const params = new URLSearchParams({
            key: apiKey,
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: maxResults.toString(),
            order: filters.sortBy || 'relevance',
            regionCode: 'KR',
            relevanceLanguage: 'ko'
        });

        if (pageToken) {
            params.append('pageToken', pageToken);
        }

        if (filters.duration && filters.duration !== 'any') {
            let apiDuration = filters.duration;
            
            if (filters.duration === 'short') {
                apiDuration = 'short';         
            } else if (filters.duration === 'medium') {
                apiDuration = 'short';        
            } else if (filters.duration === 'long') {
                apiDuration = 'medium';        
            } else if (filters.duration === 'longer') {
                apiDuration = 'long';
            }
            
            params.append('videoDuration', apiDuration);
        }

        const uploadDateToUse = filters.uploadStartDate;
        
        if (uploadDateToUse) {
            let publishedAfter = uploadDateToUse;
            
            if (publishedAfter.length === 4 && /^\d{4}$/.test(publishedAfter)) {
                publishedAfter = `${publishedAfter}-01-01T00:00:00Z`;
            } else if (publishedAfter.length === 10 && publishedAfter.includes('-') && publishedAfter.split('-').length === 3) {
                publishedAfter = `${publishedAfter}T00:00:00Z`;
            } else if (publishedAfter.includes('T') && !publishedAfter.endsWith('Z')) {
                publishedAfter = `${publishedAfter}Z`;
            } else if (!publishedAfter.endsWith('Z') && !publishedAfter.includes('+') && !publishedAfter.endsWith('00')) {
                 console.warn(`Invalid publishedAfter format: ${uploadDateToUse}`);
                 publishedAfter = null;
            }
            
            if (publishedAfter) {
                params.append('publishedAfter', publishedAfter);
            }
        }

        return params.toString();
    }

    /**
     * 비디오 상세 정보를 가져옵니다.
     */
    static async fetchVideoDetails(baseUrl, apiKey, videoIds) {
        const videosUrl = `${baseUrl}/videos?${new URLSearchParams({
            key: apiKey,
            part: 'snippet,statistics,contentDetails,topicDetails,status',
            id: videoIds.join(',')
        })}`;

        const response = await fetch(videosUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `비디오 정보 조회 실패: ${response.status}`);
        }

        const data = await response.json();
        return data.items || [];
    }

    /**
     * 채널 상세 정보를 가져옵니다.
     */
    static async fetchChannelDetails(baseUrl, apiKey, channelIds) {
        if (channelIds.length === 0) return {};

        const channelsUrl = `${baseUrl}/channels?${new URLSearchParams({
            key: apiKey,
            part: 'snippet,statistics',
            id: channelIds.join(',')
        })}`;

        const response = await fetch(channelsUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `채널 정보 조회 실패: ${response.status}`);
        }

        const data = await response.json();
        const channelsDict = {};
        (data.items || []).forEach(channel => {
            channelsDict[channel.id] = channel;
        });
        
        return channelsDict;
    }

    /**
     * 클라이언트 측 필터링을 적용합니다.
     * 백엔드의 서버 측 필터링 로직을 반영
     */
    static passesClientSideFilters(video, filters) {
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        if (filters.minViews && viewCount < parseInt(filters.minViews)) return false;
        if (filters.maxViews && viewCount > parseInt(filters.maxViews)) return false;

        const subscriberCount = parseInt(video.channelStatistics?.subscriberCount || 0);
        if (filters.minSubscribers && subscriberCount < parseInt(filters.minSubscribers)) return false;
        if (filters.maxSubscribers && subscriberCount > parseInt(filters.maxSubscribers)) return false;

        if (filters.channelStartDate || filters.channelEndDate) {
            const channelPublishedAt = video.channelSnippet?.publishedAt;
            if (channelPublishedAt) {
                try {
                    const channelDate = new Date(channelPublishedAt);
                    
                    if (filters.channelStartDate) {
                        const startDate = new Date(filters.channelStartDate);
                        if (channelDate < startDate) return false;
                    }
                    
                    if (filters.channelEndDate) {
                        const endDate = new Date(filters.channelEndDate);
                        if (channelDate > endDate) return false;
                    }
                } catch (error) {
                    console.warn(`Invalid channel date format: ${channelPublishedAt}`);
                    return false;
                }
            }
        }

        if (filters.uploadEndDate) {
            const videoPublishedAt = video.snippet?.publishedAt;
            if (videoPublishedAt) {
                try {
                    const videoDate = new Date(videoPublishedAt);
                    const endDate = new Date(filters.uploadEndDate);
                    if (videoDate > endDate) return false;
                } catch (error) {
                    console.warn(`Invalid video date format: ${videoPublishedAt}`);
                    return false;
                }
            }
        }

        if (filters.koreanOnly) {
            const title = video.snippet?.title || '';
            const description = video.snippet?.description || '';
            const koreanRegex = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
            if (!koreanRegex.test(title + description)) return false;
        }

        if (filters.duration === 'short' || filters.duration === 'medium') {
            const durationStr = video.contentDetails?.duration || '';
            if (durationStr) {
                const durationSeconds = YouTubeCalculations.parseDurationToSeconds(durationStr);
                
                if (filters.duration === 'short' && durationSeconds >= 60) {  
                    return false;
                } else if (filters.duration === 'medium' && (durationSeconds < 60 || durationSeconds >= 240)) {  
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 사용량 증가를 비동기로 처리합니다 (데모모드 폴백 지원)
     * @param {number} expectedRemaining - 예상 남은 횟수
     * @param {Function} showNotification - 알림 함수
     * @returns {Promise<boolean>} 데모모드 전환 여부
     */
    static async incrementUsageAsync(expectedRemaining, showNotification) {
        try {
            const response = await fetch('/youtube/usage/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('📊 사용량 증가 완료:', data);
                
                if (data.fallbackToDemo) {
                    console.log('🎭 사용량 초과로 데모모드 전환:', data.message);
                    if (showNotification && data.message) {
                        showNotification(data.message, 'info');
                    }
                    return true;
                }
                
                if (showNotification) {
                    showNotification(`일일 검색 횟수 차감 완료. 남은 횟수: ${data.remainingSearches}회`, 'success', 5000);
                }
                return false;
            } else {
                console.warn('⚠️ 사용량 증가 실패: HTTP', response.status);
                
                if (showNotification) {
                    showNotification('일일 사용량 초과로 데모모드로 검색합니다.', 'info');
                }
                return true;
            }
        } catch (error) {
            console.warn('⚠️ 사용량 증가 오류:', error.message);
            
            if (showNotification) {
                showNotification('일일 사용량 초과로 데모모드로 검색합니다.', 'info');
            }
            return true;
        }
    }

    /**
     * API 키 실패를 백엔드에 보고합니다.
     * @param {string} apiKey - 실패한 API 키
     * @param {string} errorMessage - 에러 메시지
     */
    static async reportKeyFailure(apiKey, errorMessage) {
        try {
            const response = await fetch('/youtube/server-key/report-failure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    apiKey: apiKey,
                    errorMessage: errorMessage
                })
            });
            
            if (response.ok) {
                console.log('✅ API 키 실패 보고 완료:', apiKey.substring(0, 20) + '...');
            } else {
                console.warn('⚠️ API 키 실패 보고 실패:', response.status);
            }
        } catch (error) {
            console.warn('⚠️ API 키 실패 보고 오류:', error.message);
        }
    }

    /**
     * YouTube API 오류를 처리합니다.
     */
    static handleYouTubeApiError(error, showNotification) {
        if (error.message.includes('API 키') || error.message.includes('keyInvalid')) {
            showNotification('API 키를 확인해주세요. Google Cloud Console에서 YouTube Data API v3를 활성화하고 올바른 키를 입력했는지 확인하세요.', 'error');
        } else if (error.message.includes('할당량') || error.message.includes('quotaExceeded')) {
            showNotification('API 할당량을 초과했습니다. 잠시 후 다시 시도하거나 API 키의 할당량을 확인해주세요.', 'error');
        } else if (error.message.includes('accessNotConfigured')) {
            showNotification('YouTube Data API v3가 활성화되지 않았습니다. Google Cloud Console에서 API를 활성화해주세요.', 'error');
        } else {
            showNotification('검색 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    }

    /**
     * 데모 검색을 수행합니다 (API 키 불필요).
     * @param {string} query - 검색어.
     * @param {object} backendFilters - 백엔드로 전달할 필터 객체.
     * @param {Function} showNotification - 알림을 표시하는 콜백 함수.
     * @returns {Promise<Array<object>>} 데모 검색 결과 비디오 배열.
     * @throws {Error} 데모 검색 실패 시.
     */
    static async performDemoSearch(query, backendFilters, showNotification) {
        return this.performDemoSearchFast(query, backendFilters, showNotification);
    }

    /**
     * 🚀 고속 데모 검색 (캐싱 적용)
     */
    static async performDemoSearchFast(query, backendFilters, showNotification) {
        const cacheKey = `demo_${query}_${backendFilters.maxResults || 10}`;
        const cached = this.getDemoCache(cacheKey);
        
        if (cached) {
            console.log('📦 데모 캐시 사용:', cacheKey);
            return cached;
        }

        const params = new URLSearchParams({ 
            q: query,
            apiMode: false
        });
        if (backendFilters.maxResults) params.append('maxResults', backendFilters.maxResults);
        
        const demoApiUrl = `/youtube/demo-search?${params.toString()}`;

        try {
            const response = await fetch(demoApiUrl);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
            }

            const data = await response.json();
            const demoVideos = data.items || [];

            this.setDemoCache(cacheKey, demoVideos, 5 * 60 * 1000);
            
            return demoVideos;

        } catch (error) {
            console.error('데모 검색 오류:', error);
            showNotification('데모 검색 중 오류가 발생했습니다: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * 백엔드 API에 일반적인 요청을 보냅니다.
     * @param {string} endpoint - API 엔드포인트.
     * @param {object} options - 요청 옵션.
     * @param {Function} showNotification - 알림 콜백 함수.
     * @returns {Promise<object>} API 응답 데이터.
     */
    static async makeApiRequest(endpoint, options = {}, showNotification) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(endpoint, defaultOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error(`API 요청 오류 (${endpoint}):`, error);
            
            if (showNotification) {
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    showNotification('네트워크 연결을 확인해주세요.', 'error');
                } else {
                    showNotification(`API 요청 실패: ${error.message}`, 'error');
                }
            }
            
            throw error;
        }
    }

    /**
     * 인기 동영상을 가져옵니다.
     * @param {Function} showNotification - 알림 콜백 함수.
     * @returns {Promise<Array<object>>} 인기 동영상 배열.
     */
    static async fetchTrendingVideos(showNotification) {
        try {
            const data = await this.makeApiRequest('/youtube/home-trending', {}, showNotification);
            return data.items || [];
        } catch (error) {
            console.error('인기 동영상 로드 오류:', error);
            throw error;
        }
    }

    /**
     * API 키의 유효성을 검증합니다.
     * @param {string} apiKey - 검증할 API 키.
     * @param {Function} showNotification - 알림 콜백 함수.
     * @returns {Promise<boolean>} 유효성 여부.
     */
    static async validateApiKey(apiKey, showNotification) {
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            showNotification('유효하지 않은 API 키 형식입니다.', 'error');
            return false;
        }

        try {
            const testData = {
                q: 'test',
                apiKey: apiKey,
                maxResults: 1,
                apiMode: true
            };

            const response = await fetch('/youtube/validate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData)
            });

            if (response.ok) {
                showNotification('API 키가 유효합니다.', 'success');
                return true;
            } else {
                const errorData = await response.json().catch(() => ({}));
                showNotification(`API 키 검증 실패: ${errorData.error || '알 수 없는 오류'}`, 'error');
                return false;
            }

        } catch (error) {
            console.error('API 키 검증 오류:', error);
            showNotification('API 키 검증 중 오류가 발생했습니다.', 'error');
            return false;
        }
    }

    /**
     * API 할당량 정보를 가져옵니다.
     * @param {string} apiKey - API 키.
     * @param {Function} showNotification - 알림 콜백 함수.
     * @returns {Promise<object|null>} 할당량 정보 또는 null.
     */
    static async getQuotaInfo(apiKey, showNotification) {
        try {
            const data = await this.makeApiRequest('/youtube/quota-info', {
                method: 'POST',
                body: JSON.stringify({ apiKey })
            }, showNotification);

            return data.quota || null;

        } catch (error) {
            console.error('할당량 정보 조회 오류:', error);
            return null;
        }
    }

    /**
     * 발생한 오류를 처리하고 사용자에게 알림을 표시합니다.
     * @param {Error} error - 발생한 오류 객체.
     * @param {string} context - 오류가 발생한 컨텍스트 (예: '검색', '초기화').
     * @param {Function} showNotification - 알림을 표시하는 콜백 함수.
     */
    static handleError(error, context = '', showNotification) {
        console.error(`오류 발생 ${context}:`, error);
        
        let errorMessage = '알 수 없는 오류가 발생했습니다.';
        let errorType = 'error';

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '네트워크 연결을 확인해주세요.';
        }
        else if (error.name === 'AbortError' || error.message.includes('timeout')) {
            errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
        }
        else if (error.message.includes('API')) {
            errorMessage = error.message;
        }
        else if (error.message.includes('quota') || error.message.includes('limit')) {
            errorMessage = 'API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
            errorType = 'warning';
        }
        else if (error.message.includes('auth') || error.message.includes('permission') || error.message.includes('key')) {
            errorMessage = 'API 키를 확인해주세요.';
        }
        else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            errorMessage = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
        else if (error.message.includes('400') || error.message.includes('404')) {
            errorMessage = '잘못된 요청입니다. 입력값을 확인해주세요.';
        }
        else if (error.message) {
            errorMessage = error.message;
        }

        if (showNotification) {
            showNotification(errorMessage, errorType);
        }
    }

    /**
     * 요청 재시도 로직을 수행합니다.
     * @param {Function} requestFunction - 재시도할 요청 함수.
     * @param {number} maxRetries - 최대 재시도 횟수.
     * @param {number} delay - 재시도 간격 (밀리초).
     * @param {Function} showNotification - 알림 콜백 함수.
     * @returns {Promise<any>} 요청 결과.
     */
    static async retryRequest(requestFunction, maxRetries = 3, delay = 1000, showNotification) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFunction();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries) {
                    if (showNotification) {
                        showNotification(`요청 실패, ${attempt}/${maxRetries} 재시도 중...`, 'warning', 2000);
                    }
                    
                    const waitTime = delay * Math.pow(2, attempt - 1);
                    await this.sleep(waitTime);
                } else {
                    if (showNotification) {
                        showNotification(`${maxRetries}번 재시도 후 실패했습니다.`, 'error');
                    }
                }
            }
        }

        throw lastError;
    }

    /**
     * 지정된 시간만큼 대기합니다.
     * @param {number} ms - 대기 시간 (밀리초).
     * @returns {Promise<void>} 대기 완료 Promise.
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * URL 파라미터를 안전하게 인코딩합니다.
     * @param {object} params - 파라미터 객체.
     * @returns {string} 인코딩된 쿼리 스트링.
     */
    static encodeUrlParams(params) {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                searchParams.append(key, String(value));
            }
        });

        return searchParams.toString();
    }

    /**
     * JSON 응답을 안전하게 파싱합니다.
     * @param {Response} response - Fetch Response 객체.
     * @returns {Promise<object>} 파싱된 JSON 객체.
     */
    static async safeJsonParse(response) {
        try {
            return await response.json();
        } catch (error) {
            console.error('JSON 파싱 오류:', error);
            return {
                error: 'Invalid JSON response',
                status: response.status,
                statusText: response.statusText
            };
        }
    }

    /**
     * 네트워크 연결 상태를 확인합니다.
     * @returns {boolean} 온라인 상태 여부.
     */
    static isOnline() {
        return navigator.onLine;
    }

    /**
     * 연결 상태 변화를 모니터링합니다.
     * @param {Function} onOnline - 온라인 상태 콜백.
     * @param {Function} onOffline - 오프라인 상태 콜백.
     */
    static monitorConnection(onOnline, onOffline) {
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }

    /**
     * API 응답 시간을 측정합니다.
     * @param {Function} apiFunction - 측정할 API 함수.
     * @returns {Promise<{result: any, duration: number}>} 결과와 소요 시간.
     */
    static async measureApiPerformance(apiFunction) {
        const startTime = performance.now();
        
        try {
            const result = await apiFunction();
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            
            return { result, duration };
        } catch (error) {
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            
            throw { ...error, duration };
        }
    }

    /**
     * 캐시를 활용한 API 요청을 수행합니다.
     * @param {string} cacheKey - 캐시 키.
     * @param {Function} apiFunction - API 함수.
     * @param {number} cacheDuration - 캐시 지속 시간 (밀리초).
     * @returns {Promise<any>} API 결과.
     */
    static async cachedApiRequest(cacheKey, apiFunction, cacheDuration = 5 * 60 * 1000) {
        const cached = this.getFromCache(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < cacheDuration) {
            console.log(`캐시에서 데이터 반환: ${cacheKey}`);
            return cached.data;
        }

        try {
            const result = await apiFunction();
            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            if (cached) {
                console.warn('API 요청 실패, 캐시된 데이터 사용:', error);
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * 캐시에서 데이터를 가져옵니다.
     * @param {string} key - 캐시 키.
     * @returns {object|null} 캐시된 데이터 또는 null.
     */
    static getFromCache(key) {
        try {
            const item = localStorage.getItem(`api_cache_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('캐시 읽기 오류:', error);
            return null;
        }
    }

    /**
     * 캐시에 데이터를 저장합니다.
     * @param {string} key - 캐시 키.
     * @param {any} data - 저장할 데이터.
     */
    static setCache(key, data) {
        try {
            const cacheItem = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheItem));
        } catch (error) {
            console.error('캐시 저장 오류:', error);
        }
    }

    /**
     * 캐시를 지웁니다.
     * @param {string} pattern - 지울 캐시 키 패턴 (선택사항).
     */
    static clearCache(pattern = null) {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('api_cache_')) {
                    if (!pattern || key.includes(pattern)) {
                        localStorage.removeItem(key);
                    }
                }
            });
            console.log('API 캐시가 지워졌습니다.');
        } catch (error) {
            console.error('캐시 지우기 오류:', error);
        }
    }

    /**
     * 배치 요청을 처리합니다.
     * @param {Array} requests - 요청 배열.
     * @param {number} batchSize - 배치 크기.
     * @param {number} delay - 배치 간 지연 시간.
     * @param {Function} onProgress - 진행률 콜백.
     * @returns {Promise<Array>} 모든 요청의 결과 배열.
     */
    static async batchRequests(requests, batchSize = 5, delay = 1000, onProgress = null) {
        const results = [];
        const totalBatches = Math.ceil(requests.length / batchSize);

        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const currentBatch = Math.floor(i / batchSize) + 1;

            if (onProgress) {
                onProgress(currentBatch, totalBatches);
            }

            try {
                const batchResults = await Promise.allSettled(
                    batch.map(request => typeof request === 'function' ? request() : request)
                );
                
                results.push(...batchResults);

                if (i + batchSize < requests.length) {
                    await this.sleep(delay);
                }
            } catch (error) {
                console.error(`배치 ${currentBatch} 처리 오류:`, error);
            }
        }

        return results;
    }

    /**
     * API 상태를 확인합니다.
     * @param {Function} showNotification - 알림 콜백 함수.
     * @returns {Promise<object>} API 상태 정보.
     */
    static async checkApiStatus(showNotification) {
        try {
            const data = await this.makeApiRequest('/api/status', {}, showNotification);
            return {
                status: 'online',
                version: data.version || 'unknown',
                timestamp: data.timestamp || new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'offline',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 디버그 정보를 수집합니다.
     * @returns {object} 디버그 정보 객체.
     */
    static collectDebugInfo() {
        return {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            url: window.location.href,
            referrer: document.referrer,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localStorage: {
                available: this.isLocalStorageAvailable(),
                usage: this.getLocalStorageUsage()
            }
        };
    }

    /**
     * 로컬 스토리지 사용 가능 여부를 확인합니다.
     * @returns {boolean} 사용 가능 여부.
     */
    static isLocalStorageAvailable() {
        try {
            const testKey = '__test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 로컬 스토리지 사용량을 계산합니다.
     * @returns {object} 사용량 정보.
     */
    static getLocalStorageUsage() {
        try {
            let totalSize = 0;
            let itemCount = 0;

            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                    itemCount++;
                }
            }

            return {
                itemCount: itemCount,
                totalSize: totalSize,
                totalSizeKB: Math.round(totalSize / 1024 * 100) / 100
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // 🚀 =============== 최적화 별도 메서드들 ===============

    /**
     * 🔥 API 키 할당량 빠른 테스트 (1초 타임아웃)
     */
    static async testApiKeyQuota(apiKey) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            const testUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&part=snippet&q=test&type=video&maxResults=1`;
            const response = await fetch(testUrl, { signal: controller.signal });
            
            clearTimeout(timeoutId);
            
            if (response.status === 403) {
                return { isValid: false, reason: 'quota_exceeded' };
            }
            
            return { isValid: response.ok, reason: response.ok ? 'valid' : 'other_error' };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { isValid: false, reason: 'timeout' };
            }
            return { isValid: false, reason: 'network_error' };
        }
    }

    /**
     * 🚀 병렬 사용량 증가 처리
     */
    static async incrementUsageParallel() {
        try {
            const response = await fetch('/youtube/usage/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result && typeof result.remainingSearches === 'number') {
                const validRemaining = Math.max(0, Math.min(result.remainingSearches, 5));
                return { ...result, remainingSearches: validRemaining };
            }
            
            console.warn('⚠️ 사용량 증가 응답 검증 실패:', result);
            return { success: false, remainingSearches: 0 };
            
        } catch (error) {
            console.error('💥 사용량 증가 실패:', error);
            return { success: false, remainingSearches: 0, error: error.message };
        }
    }

    /**
     * 🚀 상태 업데이트 비동기 처리 (UI 블로킹 방지)
     */
    static updateSearchStatusAsync(remainingSearches) {
        if (remainingSearches === undefined || remainingSearches === null) {
            console.warn('⚠️ 잘못된 remainingSearches 값:', remainingSearches);
            return;
        }
        
        const validRemaining = Math.max(0, Math.min(parseInt(remainingSearches) || 0, 5));
        
        setTimeout(() => {
            try {
                if (window.youtubeApp && window.youtubeApp.searchManager) {
                    window.youtubeApp.searchManager.updateSearchStatusImmediately(validRemaining);
                    console.log(`🔄 API 헬퍼에서 상태 업데이트: ${validRemaining}/5회`);
                }
            } catch (error) {
                console.warn('상태 업데이트 실패:', error);
            }
        }, 0);
    }

    /**
     * 🚀 데모 캐시 관리
     */
    static getDemoCache(key) {
        try {
            const item = localStorage.getItem(`demo_cache_${key}`);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            if (Date.now() > parsed.expires) {
                localStorage.removeItem(`demo_cache_${key}`);
                return null;
            }
            
            return parsed.data;
        } catch (error) {
            return null;
        }
    }

    static setDemoCache(key, data, ttl) {
        try {
            const item = {
                data: data,
                expires: Date.now() + ttl
            };
            localStorage.setItem(`demo_cache_${key}`, JSON.stringify(item));
        } catch (error) {
            console.warn('데모 캐시 저장 실패:', error);
        }
    }

    /**
     * 🚀 검색 상태 조회 (캐싱 적용)
     */
    static async getSearchStatus() { // [수정] 중복되던 메서드 중 캐싱이 적용된 버전만 남김
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch('/Youtube-status', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('검색 상태 조회 실패:', error);
            }
            return {
                hybridSearchEnabled: false,
                status: {
                    message: '검색 상태 조회 중 오류가 발생했습니다.'
                }
            };
        }
    }

    /**
     * 🚀 성능 모니터링 메서드
     */
    static measurePerformance(label, fn) {
        return async (...args) => {
            const start = performance.now();
            try {
                const result = await fn(...args);
                const duration = Math.round(performance.now() - start);
                console.log(`🚀 ${label}: ${duration}ms`);
                return result;
            } catch (error) {
                const duration = Math.round(performance.now() - start);
                console.error(`💥 ${label} 실패: ${duration}ms`, error);
                throw error;
            }
        };
    }

    /**
     * 🚀 메모이제이션된 계산 함수
     */
    static getCalculationsMemoized = memoize(
        (publishedAt, viewCount, subscriberCount) => {
            return {
                dailyRate: YouTubeCalculations.calculateDailyRate(publishedAt, viewCount, subscriberCount),
                growthRatio: YouTubeCalculations.calculateGrowthRatio(viewCount, subscriberCount)
            };
        },
        (publishedAt, viewCount, subscriberCount) => `${publishedAt}_${viewCount}_${subscriberCount}`
    );

    static enrichVideoWithCalculationsMemoized(video, channelInfo) {
        if (!video || !video.snippet || !video.statistics) {
            return video;
        }

        const publishedAt = video.snippet.publishedAt;
        const viewCount = video.statistics.viewCount || '0';
        const subscriberCount = channelInfo.statistics?.subscriberCount || '0';

        // 계산 결과만 메모이제이션으로 캐싱
        const calculations = this.getCalculationsMemoized(publishedAt, viewCount, subscriberCount);
        
        // 현재 비디오 객체에 계산값 추가
        video.rawVideoAccelerationRate = calculations.dailyRate;
        video.rawChannelAccelerationRate = calculations.growthRatio;

        return video;
    }

    /**
     * 🚀 메모이제이션된 필터링 함수
     */
    static passesClientSideFiltersMemoized = memoize(
        (video, filters) => {
            return this.passesClientSideFilters(video, filters);
        },
        (video, filters) => `${video.id}_${JSON.stringify(filters)}_${video.statistics?.viewCount || 0}`
    );

    /**
     * 🚀 리소스 정리 (메모리 누수 방지)
     */
    static cleanup() {
        requestManager.clearCache();
        console.log('🧹 ApiHelpers 리소스 정리 완료');
    }
}

export default ApiHelpers;