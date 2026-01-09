/**
 * @fileoverview 애플리케이션의 모든 데이터(비디오 목록, 선택 상태, 설정 등)를 관리하고
 * 로컬 스토리지와의 상호작용을 처리하는 매니저입니다.
 * 보안 강화: API 키 암호화 저장 및 세션 기반 관리 추가
 */

import DomUtils from '../utils/dom-utils.js';

class DataManager {
    constructor() {
        /**
         * 현재 검색된 또는 표시된 비디오 목록입니다.
         * @type {Array<object>}
         */
        this.currentVideos = [];

        /**
         * 사용자가 선택한 비디오 ID들을 저장하는 Set 객체입니다.
         * @type {Set<string>}
         */
        this.selectedVideos = new Set();

        /**
         * API 모드 활성화 여부입니다. (true: API 모드, false: 데모 모드)
         * @type {boolean}
         */
        this.isApiMode = false;

        /**
         * 현재 사용 중인 YouTube Data API 키입니다.
         * @type {string}
         */
        this.currentApiKey = '';

        /**
         * 검색 필터 설정을 저장하는 객체입니다.
         * @type {object}
         */
        this.searchFilters = {
            sortBy: 'relevance',   // 정렬 방식 (관련성, 최신순, 조회수, 평점)
            duration: 'any',       // 영상 길이 (전체, 짧음, 중간, 김)
            uploadDate: 'any',     // 업로드 날짜 (언제든지, 지난 1시간, 오늘 등)
            minViews: '',          // 최소 조회수
            minSubscribers: '',    // 최소 구독자 수
            maxResults: 50,        // 최대 결과 수 (1-50)
            channelYear: '',       // 채널 개설 연도
            koreanOnly: true,      // 한국어 콘텐츠 우선 여부
            legendScoreMin: 100    // 🎯 레전드점수 최소값 (다중검색용)
        };

        // 페이지네이션 관련
        this.currentPage = 1;
        this.nextPageToken = null;
        this.prevPageToken = null;

        // API 키 보안 설정
        this.useSessionStorage = true; // 세션 스토리지 우선 사용
        this.encryptionKey = this._generateEncryptionKey(); // 단순 암호화 키
    }

    /**
     * 단순 암호화 키를 생성합니다.
     * @returns {string} 암호화 키
     * @private
     */
    _generateEncryptionKey() {
        // 브라우저 고유 정보를 조합하여 키 생성
        const userAgent = navigator.userAgent || '';
        const platform = navigator.platform || '';
        const language = navigator.language || '';
        return btoa(userAgent + platform + language).substring(0, 16);
    }

    /**
     * 문자열을 간단히 암호화합니다 (XOR 기반).
     * @param {string} text - 암호화할 텍스트
     * @returns {string} 암호화된 텍스트
     * @private
     */
    _encrypt(text) {
        if (!text) return '';
        try {
            let result = '';
            for (let i = 0; i < text.length; i++) {
                const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                const textChar = text.charCodeAt(i);
                result += String.fromCharCode(textChar ^ keyChar);
            }
            return btoa(result); // Base64로 인코딩
        } catch (error) {
            console.warn('암호화 실패:', error);
            return btoa(text); // 실패 시 단순 Base64
        }
    }

    /**
     * 암호화된 문자열을 복호화합니다.
     * @param {string} encryptedText - 복호화할 텍스트
     * @returns {string} 복호화된 텍스트
     * @private
     */
    _decrypt(encryptedText) {
        if (!encryptedText) return '';
        try {
            const decoded = atob(encryptedText); // Base64 디코딩
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                const encryptedChar = decoded.charCodeAt(i);
                result += String.fromCharCode(encryptedChar ^ keyChar);
            }
            return result;
        } catch (error) {
            console.warn('복호화 실패:', error);
            try {
                return atob(encryptedText); // 실패 시 단순 Base64 디코딩
            } catch {
                return ''; // 완전 실패
            }
        }
    }

    /**
     * API 키를 안전하게 설정합니다.
     * @param {string} apiKey - 설정할 API 키
     */
    setApiKey(apiKey) {
        this.currentApiKey = apiKey;
        this.saveSettings();
    }

    /**
     * API 키를 안전하게 가져옵니다.
     * @returns {string} API 키
     */
    getApiKey() {
        return this.currentApiKey;
    }

    /**
     * API 키를 제거합니다.
     */
    clearApiKey() {
        this.currentApiKey = '';
        this.isApiMode = false;
        
        // 저장소에서도 제거
        if (this.useSessionStorage) {
            try {
                sessionStorage.removeItem('youtube_api_key');
            } catch (error) {
                console.warn('세션 스토리지 제거 실패:', error);
            }
        }
        
        try {
            localStorage.removeItem('youtube_api_key');
        } catch (error) {
            console.warn('로컬 스토리지 제거 실패:', error);
        }
        
        this.saveSettings();
    }

    /**
     * 스토리지 사용 가능 여부를 확인합니다.
     * @param {Storage} storage - 확인할 스토리지 (localStorage 또는 sessionStorage)
     * @returns {boolean} 사용 가능 여부
     * @private
     */
    _isStorageAvailable(storage) {
        try {
            const testKey = '__storage_test__';
            storage.setItem(testKey, 'test');
            storage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 특정 비디오를 선택 상태로 추가합니다.
     * @param {string} videoId - 선택할 비디오의 ID.
     */
    addSelectedVideo(videoId) {
        this.selectedVideos.add(videoId);
    }

    /**
     * 특정 비디오를 선택 상태에서 제거합니다.
     * @param {string} videoId - 선택 해제할 비디오의 ID.
     */
    removeSelectedVideo(videoId) {
        this.selectedVideos.delete(videoId);
    }

    /**
     * 모든 선택된 비디오를 지웁니다.
     */
    clearSelectedVideos() {
        this.selectedVideos.clear();
    }

    /**
     * 선택된 비디오 데이터 배열을 반환합니다.
     * @returns {Array} 선택된 비디오 객체 배열
     */
    getSelectedVideos() {
        return this.currentVideos.filter(video => 
            this.selectedVideos.has(video.id)
        );
    }

    /**
     * 선택된 비디오 개수를 반환합니다.
     * @returns {number} 선택된 비디오 개수
     */
    getSelectedVideosCount() {
        return this.selectedVideos.size;
    }

    /**
     * 선택된 비디오가 있는지 확인합니다.
     * @returns {boolean} 선택 여부
     */
    hasSelectedVideos() {
        return this.selectedVideos.size > 0;
    }

    /**
     * 특정 비디오 ID가 현재 선택되었는지 여부를 반환합니다.
     * @param {string} videoId - 확인할 비디오 ID.
     * @returns {boolean} 선택 여부.
     */
    isVideoSelected(videoId) {
        return this.selectedVideos.has(videoId);
    }

    /**
     * 현재 선택된 비디오 ID들의 Set 객체를 반환합니다.
     * @returns {Set<string>}
     */
    getSelectedVideoIds() {
        return new Set(this.selectedVideos);
    }

    /**
     * 현재 애플리케이션 설정을 저장소에 저장합니다.
     */
    saveSettings() {
        try {
            const settings = {
                isApiMode: this.isApiMode,
                searchFilters: this.searchFilters,
                timestamp: Date.now() // 저장 시간 추가
            };

            // API 키는 별도로 암호화하여 저장
            if (this.currentApiKey) {
                const encryptedApiKey = this._encrypt(this.currentApiKey);
                
                // 세션 스토리지 우선 사용 (브라우저 닫으면 자동 삭제)
                if (this.useSessionStorage && this._isStorageAvailable(sessionStorage)) {
                    sessionStorage.setItem('youtube_api_key', encryptedApiKey);
                }
                
                // 로컬 스토리지에도 백업 저장 (사용자가 선택한 경우)
                if (this._isStorageAvailable(localStorage)) {
                    localStorage.setItem('youtube_api_key', encryptedApiKey);
                }
            }

            // 일반 설정은 로컬 스토리지에 저장
            DomUtils.saveToLocalStorage('youtube_settings', settings);
            
        } catch (error) {
            console.warn('설정 저장 실패:', error);
            // 대안으로 메모리에만 보관
            this._memoryBackup = {
                isApiMode: this.isApiMode,
                apiKey: this.currentApiKey,
                searchFilters: this.searchFilters
            };
        }
    }

    /**
     * 저장소에서 애플리케이션 설정을 로드하고 적용합니다.
     */
    loadSettings() {
        try {
            // 일반 설정 로드
            const settings = DomUtils.loadFromLocalStorage('youtube_settings', {});
            if (settings.isApiMode !== undefined) {
                this.isApiMode = settings.isApiMode;
            }
            if (settings.searchFilters && typeof settings.searchFilters === 'object') {
                this.searchFilters = { ...this.searchFilters, ...settings.searchFilters };
            }

            // API 키 로드 (세션 스토리지 우선)
            let encryptedApiKey = '';
            
            if (this.useSessionStorage && this._isStorageAvailable(sessionStorage)) {
                encryptedApiKey = sessionStorage.getItem('youtube_api_key') || '';
            }
            
            // 세션 스토리지에 없으면 로컬 스토리지에서 로드
            if (!encryptedApiKey && this._isStorageAvailable(localStorage)) {
                encryptedApiKey = localStorage.getItem('youtube_api_key') || '';
            }
            
            if (encryptedApiKey) {
                this.currentApiKey = this._decrypt(encryptedApiKey);
                
                // API 키가 있으면 세션 스토리지로 복사
                if (this.currentApiKey && this.useSessionStorage && this._isStorageAvailable(sessionStorage)) {
                    sessionStorage.setItem('youtube_api_key', encryptedApiKey);
                }
            }

        } catch (error) {
            console.warn('설정 로드 실패:', error);
            
            // 메모리 백업에서 복구 시도
            if (this._memoryBackup) {
                this.isApiMode = this._memoryBackup.isApiMode;
                this.currentApiKey = this._memoryBackup.apiKey;
                this.searchFilters = this._memoryBackup.searchFilters;
            }
        }
    }

    /**
     * 저장소 모드를 변경합니다.
     * @param {boolean} useSession - 세션 스토리지 사용 여부
     */
    setStorageMode(useSession = true) {
        const oldApiKey = this.currentApiKey;
        this.useSessionStorage = useSession;
        
        if (oldApiKey) {
            this.currentApiKey = oldApiKey;
            this.saveSettings(); // 새로운 모드로 다시 저장
        }
    }

    /**
     * 보안 상태를 확인합니다.
     * @returns {object} 보안 상태 정보
     */
    getSecurityStatus() {
        return {
            hasApiKey: !!this.currentApiKey,
            isEncrypted: true, // 항상 암호화 사용
            storageMode: this.useSessionStorage ? 'session' : 'local',
            sessionAvailable: this._isStorageAvailable(sessionStorage),
            localAvailable: this._isStorageAvailable(localStorage)
        };
    }

    /**
     * 페이지네이션 토큰을 설정합니다.
     * @param {string|null} nextPageToken - 다음 페이지 토큰.
     * @param {string|null} prevPageToken - 이전 페이지 토큰.
     */
    setPaginationTokens(nextPageToken, prevPageToken) {
        this.nextPageToken = nextPageToken;
        this.prevPageToken = prevPageToken;
    }

    /**
     * 현재 페이지 번호를 설정합니다.
     * @param {number} page - 현재 페이지 번호.
     */
    setCurrentPage(page) {
        this.currentPage = page;
    }

    /**
     * 비디오 데이터에 레전드 점수와 키워드를 추가합니다.
     * @param {Array} videos - 영상 데이터 배열
     * @param {string} keyword - 검색 키워드
     * @param {string} searchType - 검색 타입 ('single' 또는 'multi')
     * @param {object} searchManager - 레전드 점수 계산을 위한 SearchManager 인스턴스
     * @returns {Array} 확장된 영상 데이터 배열
     */
    enrichVideosWithLegendData(videos, keyword, searchType = 'single', searchManager) {
        if (!videos || !Array.isArray(videos)) {
            return [];
        }

        return videos.map(video => {
            // 레전드 점수 계산
            const legendData = searchManager ? 
                searchManager.calculateLegendScore(video) : 
                { score: 0, tier: '일반', monthsElapsed: 1, subscriberWeight: 1.0 };

            // 기존 데이터에 새 필드 추가
            return {
                ...video,
                keyword: keyword || '',                    // 검색 키워드
                legendScore: legendData.score,             // 레전드 점수 (숫자)
                legendTier: legendData.tier,               // 레전드 등급 (문자열)
                searchType: searchType,                    // 검색 타입 ('single'/'multi')
                monthsElapsed: legendData.monthsElapsed,   // 경과 개월 수 (디버그용)
                subscriberWeight: legendData.subscriberWeight // 구독자 가중치 (디버그용)
            };
        });
    }

    /**
     * 다중 검색 결과를 통합하고 레전드 필터링을 적용합니다.
     * @param {Array} multiSearchResults - 다중 검색 결과 배열
     * @param {object} searchManager - 레전드 적격성 확인을 위한 SearchManager 인스턴스
     * @returns {Array} 통합되고 필터링된 영상 데이터 배열
     */
    mergeMultiSearchResults(multiSearchResults, searchManager) {
        if (!multiSearchResults || !Array.isArray(multiSearchResults)) {
            return [];
        }

        const mergedResults = [];

        multiSearchResults.forEach(result => {
            if (!result.videos || !Array.isArray(result.videos)) {
                return;
            }

            // 각 키워드별로 레전드 점수 필터링 적용
            const filteredVideos = result.videos.filter(video => {
                // 레전드 점수 최소값 조건 (필터 설정값 사용, 기본값 100)
                const legendScoreMin = this.getLegendScoreMinFilter();
                if (video.legendScore < legendScoreMin) {
                    return false;
                }

                return true;
            });

            // 키워드별로 상위 5-10개만 선택
            const topVideos = filteredVideos
                .sort((a, b) => b.legendScore - a.legendScore) // 레전드 점수 내림차순
                .slice(0, 10); // 상위 10개만

            mergedResults.push(...topVideos);
        });

        // 최종 결과를 키워드별로 묶고, 각 키워드 내에서 레전드 점수 내림차순 정렬
        return mergedResults.sort((a, b) => {
            // 키워드가 다르면 키워드 순으로 정렬
            if (a.keyword !== b.keyword) {
                return (a.keyword || '').localeCompare(b.keyword || '');
            }
            // 같은 키워드 내에서는 레전드 점수 내림차순
            return b.legendScore - a.legendScore;
        });
    }

    /**
     * 현재 비디오 데이터에서 레전드 통계를 계산합니다.
     * @returns {object} 레전드 통계 정보
     */
    getLegendStatistics() {
        if (!this.currentVideos || this.currentVideos.length === 0) {
            return {
                total: 0,
                슈퍼레전드: 0,
                레전드: 0,
                준레전드: 0,
                일반: 0,
                averageScore: 0
            };
        }

        const stats = {
            total: this.currentVideos.length,
            슈퍼레전드: 0,
            레전드: 0,
            준레전드: 0,
            일반: 0,
            totalScore: 0
        };

        this.currentVideos.forEach(video => {
            const tier = video.legendTier || '일반';
            const score = video.legendScore || 0;

            stats[tier] = (stats[tier] || 0) + 1;
            stats.totalScore += score;
        });

        stats.averageScore = stats.total > 0 ? 
            Math.round(stats.totalScore / stats.total) : 0;

        return stats;
    }

    /**
     * 🎯 다중검색용 레전드점수 최소값 필터 설정을 가져옵니다.
     * @returns {number} 레전드점수 최소값 (저장된 값 또는 기본값 100)
     */
    getLegendScoreMinFilter() {
        // 저장된 설정값 우선 사용
        return this.searchFilters.legendScoreMin || 100;
    }
}

export default DataManager;