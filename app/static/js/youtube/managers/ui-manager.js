/**
 * @fileoverview UI 상태 관리, 모달 제어, 알림 표시, 화면 전환 등
 * 사용자 인터페이스 전반을 관리하는 매니저입니다.
 */

import DomUtils from '../utils/dom-utils.js';

class UIManager {
    
    /**
     * UIManager 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스.
     * @param {object} dependencies.modalComponents - 모달 컴포넌트 인스턴스.
     * @param {object} dependencies.youtubeApp - YouTube 앱 인스턴스.
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.modalComponents = dependencies.modalComponents;
        this.youtubeApp = dependencies.youtubeApp;

        // DOM 요소 캐싱
        this.youtubeHome = DomUtils.getElementById('youtube-home');
        this.searchResults = DomUtils.getElementById('search-results');
        this.loadingOverlay = DomUtils.getElementById('loading-overlay');
        this.notificationContainer = DomUtils.getElementById('notification-container');
        this.apiModeBadge = DomUtils.getElementById('current-mode');
        this.resultsCount = DomUtils.getElementById('results-count');
        this.prevPageBtn = DomUtils.getElementById('prev-page-btn');
        this.nextPageBtn = DomUtils.getElementById('next-page-btn');
        
        this.notificationTimers = new Map();
        this.showNotification = this.showNotification.bind(this);

        // 🔄 테이블 정렬 상태 관리
        this.currentSortColumn = null;
        this.currentSortDirection = 'asc';
        
    }

    /**
     * 애플리케이션 설정을 로드합니다.
     */
    loadSettings() {
        this.dataManager.loadSettings();
        this.updateApiButton();
        
        // 🎯 저장된 필터 설정을 UI에 반영
        this.loadFiltersToUI();
    }

    /**
     * 🎯 저장된 필터 설정을 UI 입력창에 반영합니다.
     */
    loadFiltersToUI() {
        const filters = this.dataManager.searchFilters;
        
        // 레전드점수 최소값 설정 반영
        const legendScoreInput = document.getElementById('legend-score-input');
        if (legendScoreInput && filters.legendScoreMin !== undefined) {
            legendScoreInput.value = filters.legendScoreMin;
        }
    }

    /**
     * 현재 분석 모드를 동적으로 결정합니다 (체크박스 선택 기준)
     * @returns {string} 'all' 또는 'selected'
     */
    getCurrentAnalysisMode() {
        const selectedCount = this.dataManager.selectedVideos.size;
        return selectedCount > 0 ? 'selected' : 'all';
    }

    /**
     * 분석 범위 정보를 가져옵니다
     * @returns {object} 분석 범위 정보
     */
    getAnalysisScope() {
        const selectedCount = this.dataManager.selectedVideos.size;
        const totalCount = this.dataManager.currentVideos.length;
        const isSelectedMode = selectedCount > 0;
        
        return {
            mode: isSelectedMode ? 'selected' : 'all',
            selectedCount: selectedCount,
            totalCount: totalCount,
            scopeText: isSelectedMode ? `선택된 ${selectedCount}개` : `전체 ${totalCount}개`
        };
    }

    /**
     * YouTube 홈 화면을 표시합니다.
     */
    showYouTubeHome() {
        if (this.youtubeHome && this.searchResults) {
            DomUtils.addClass(this.youtubeHome, 'active');
            DomUtils.removeClass(this.searchResults, 'active');
            this.updateButtonStates(false); // 홈 화면 상태에 맞게 버튼 업데이트
        }
    }

    /**
     * YouTube 홈 화면을 숨깁니다.
     */
    hideYouTubeHome() {
        if (this.youtubeHome) {
            DomUtils.removeClass(this.youtubeHome, 'active');
        }
    }

    /**
     * 검색 결과 화면을 표시합니다.
     */
    showSearchResults() {
        if (this.searchResults && this.youtubeHome) {
            DomUtils.addClass(this.searchResults, 'active');
            DomUtils.removeClass(this.youtubeHome, 'active');
            this.updateButtonStates(true); // 검색 결과 상태에 맞게 버튼 업데이트
        }
    }

    /**
     * 검색 결과 화면을 숨깁니다.
     */
    hideSearchResults() {
        if (this.searchResults) {
            DomUtils.removeClass(this.searchResults, 'active');
        }
    }

    /**
     * 로딩 오버레이를 표시합니다.
     */
    showLoadingOverlay() {
        if (this.loadingOverlay) {
            DomUtils.addClass(this.loadingOverlay, 'show');
        }
    }

    /**
     * 로딩 오버레이를 숨깁니다.
     */
    hideLoadingOverlay() {
        if (this.loadingOverlay) {
            DomUtils.removeClass(this.loadingOverlay, 'show');
        }
    }

    /**
     * 로딩 스피너를 표시합니다. (loadingOverlay와 동일)
     */
    showLoadingSpinner() {
        this.showLoadingOverlay();
    }

    /**
     * 로딩 스피너를 숨깁니다. (loadingOverlay와 동일)
     */
    hideLoadingSpinner() {
        this.hideLoadingOverlay();
    }

    /**
     * 알림을 표시합니다.
     * @param {string} message - 알림 메시지.
     * @param {string} type - 알림 타입 ('success', 'error', 'warning', 'info').
     * @param {number} duration - 자동 사라지는 시간 (밀리초). 0이면 자동으로 사라지지 않음.
     */
    showNotification(message, type = 'info', duration = 4000) {
        if (!this.notificationContainer) {
            console.warn('알림 컨테이너를 찾을 수 없습니다.');
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        const notificationId = Date.now() + Math.random();
        notification.dataset.id = notificationId;

        this.notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);

        if (duration > 0) {
            const timer = setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
            this.notificationTimers.set(notificationId, timer);
        }

        notification.addEventListener('click', () => {
            this.removeNotification(notification);
        });
    }

    /**
     * 특정 알림을 제거합니다.
     * @param {HTMLElement} notification - 제거할 알림 요소.
     */
    removeNotification(notification) {
        if (!notification || !notification.parentNode) return;

        const notificationId = notification.dataset.id;
        if (notificationId && this.notificationTimers.has(+notificationId)) {
            clearTimeout(this.notificationTimers.get(+notificationId));
            this.notificationTimers.delete(+notificationId);
        }

        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * 현재 표시된 알림을 숨깁니다.
     */
    hideNotification() {
        if (this.notificationContainer) {
            const notifications = this.notificationContainer.querySelectorAll('.notification');
            notifications.forEach(notification => {
                this.removeNotification(notification);
            });
        }
    }

    /**
     * API 모드 버튼의 상태를 업데이트합니다.
     * API 키의 존재 여부와 isApiMode 값에 따라 버튼의 표시를 변경합니다.
     */
    updateApiButton() {
        if (!this.apiModeBadge) return;

        DomUtils.removeClass(this.apiModeBadge, 'demo');
        DomUtils.removeClass(this.apiModeBadge, 'api');
        
        const parentButton = DomUtils.getElementById('api-mode-toggle-btn');
        if (parentButton) {
            DomUtils.removeClass(parentButton, 'demo');
            DomUtils.removeClass(parentButton, 'api');
        }

        if (this.dataManager.currentApiKey && this.dataManager.isApiMode) {
            this.apiModeBadge.innerHTML = '🔑 API';
            DomUtils.addClass(this.apiModeBadge, 'api');
            if (parentButton) DomUtils.addClass(parentButton, 'api');
        } else {
            this.apiModeBadge.innerHTML = '🎮 DEMO';
            DomUtils.addClass(this.apiModeBadge, 'demo');
            if (parentButton) DomUtils.addClass(parentButton, 'demo');
        }
    }

    /**
     * (기존 API 모드 토글 버튼) -> 이제 항상 API 키 모달을 엽니다.
     * 이 버튼을 클릭하면 API 키 설정 모달이 열립니다.
     */
    toggleApiMode() {
        this.modalComponents.openApiModal();
    }

    /**
     * 모달을 엽니다.
     * @param {HTMLElement} modal - 열 모달 요소.
     */
    openModal(modal) {
        if (modal) {
            DomUtils.addClass(modal, 'show');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * 모달을 닫습니다.
     * @param {HTMLElement} modal - 닫을 모달 요소.
     */
    closeModal(modal) {
        if (modal) {
            DomUtils.removeClass(modal, 'show');
            document.body.style.overflow = '';
        }
    }

    /**
     * 모든 모달을 닫습니다.
     */
    closeAllModals() {
        const modals = DomUtils.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            this.closeModal(modal);
        });
    }

    /**
     * 드롭다운을 닫습니다.
     * @param {string} dropdownId - 닫을 드롭다운의 ID.
     */
    closeDropdown(dropdownId) {
        const dropdown = DomUtils.getElementById(dropdownId);
        if (dropdown) {
            DomUtils.removeClass(dropdown, 'show');
            const parentDropdown = dropdown.closest('.dropdown');
            if (parentDropdown) {
                DomUtils.removeClass(parentDropdown, 'active');
            }
        }
    }

    /**
     * 모든 드롭다운을 닫습니다.
     */
    closeAllDropdowns() {
        const dropdowns = DomUtils.querySelectorAll('.dropdown-menu.show');
        dropdowns.forEach(dropdown => {
            this.closeDropdown(dropdown.id);
        });
    }

    /**
     * 검색 결과 액션 버튼들의 상태를 업데이트합니다.
     * @param {boolean} hasSelection - 선택된 비디오가 있는지 여부.
     */
    updateResultActionsButtons(hasSelection) {
        const openSelectedBtn = DomUtils.getElementById('open-selected-btn');
        const goToChannelBtn = DomUtils.getElementById('go-to-channel-btn');

        if (openSelectedBtn) {
            openSelectedBtn.style.opacity = hasSelection ? '1' : '0.5';
            openSelectedBtn.style.pointerEvents = hasSelection ? 'auto' : 'none';
        }

        if (goToChannelBtn) {
            goToChannelBtn.style.opacity = hasSelection ? '1' : '0.5';
            goToChannelBtn.style.pointerEvents = hasSelection ? 'auto' : 'none';
        }
        
    }

    /**
     * 페이지네이션 컨트롤을 업데이트합니다.
     * @param {number} currentPage - 현재 페이지 번호.
     * @param {boolean} hasNextPage - 다음 페이지가 있는지 여부.
     */
    updatePaginationControls(currentPage, hasNextPage) {
        if (this.prevPageBtn) {
            this.prevPageBtn.disabled = currentPage <= 1;
        }

        if (this.nextPageBtn) {
            this.nextPageBtn.disabled = !hasNextPage;
        }
    }

    /**
     * 결과 개수를 업데이트합니다.
     * @param {number} count - 결과 개수.
     */
    updateResultsCount(count) {
        if (this.resultsCount) {
            this.resultsCount.textContent = `검색 결과: ${count}개`;
        }
    }

    /**
     * 🔄 테이블을 정렬합니다.
     * @param {string} sortBy - 정렬 기준 컬럼.
     */
    sortTable(sortBy) {
        if (!this.dataManager.currentVideos || this.dataManager.currentVideos.length === 0) {
            console.warn('정렬할 데이터가 없습니다.');
            return;
        }

        // 같은 컬럼을 다시 클릭하면 정렬 방향 반전
        if (this.currentSortColumn === sortBy) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = sortBy;
            this.currentSortDirection = 'asc';
        }

        console.log(`📊 테이블 정렬: ${sortBy} (${this.currentSortDirection})`);

        // 데이터 정렬
        const sortedVideos = [...this.dataManager.currentVideos].sort((a, b) => {
            const valueA = this.getSortValue(a, sortBy);
            const valueB = this.getSortValue(b, sortBy);
            
            let comparison = 0;
            
            // 타입별 비교
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                comparison = valueA - valueB;
            } else if (valueA instanceof Date && valueB instanceof Date) {
                comparison = valueA.getTime() - valueB.getTime();
            } else {
                // 문자열 비교 (대소문자 구분 없음)
                const strA = String(valueA).toLowerCase();
                const strB = String(valueB).toLowerCase();
                comparison = strA.localeCompare(strB);
            }
            
            // 내림차순이면 결과 반전
            return this.currentSortDirection === 'desc' ? -comparison : comparison;
        });

        // 정렬된 데이터로 업데이트
        this.dataManager.currentVideos = sortedVideos;
        
        // 테이블 다시 렌더링
        this.youtubeApp.videoDisplay.displaySearchResults(sortedVideos);
        
        // 정렬 표시 업데이트
        this.updateSortHeaders(sortBy, this.currentSortDirection);
        
        this.showNotification(`${this.getSortColumnName(sortBy)} 기준으로 ${this.currentSortDirection === 'asc' ? '오름차순' : '내림차순'} 정렬되었습니다.`, 'info', 2000);
    }

    /**
     * 🔄 정렬용 값을 추출합니다.
     * @param {object} video - 비디오 객체.
     * @param {string} column - 정렬할 컬럼.
     * @returns {any} 정렬용 값.
     */
    getSortValue(video, column) {
        const snippet = video.snippet || {};
        const statistics = video.statistics || {};
        const contentDetails = video.contentDetails || {};
        const channelSnippet = video.channelSnippet || {};
        const channelStatistics = video.channelStatistics || {};

        switch (column) {
            case 'title':
                return snippet.title || video.title || '';
                
            case 'date':
                if (snippet.publishedAt) {
                    return new Date(snippet.publishedAt);
                } else if (video.published) {
                    return this.parseRelativeDate(video.published);
                }
                return new Date(0);
                
            case 'views':
                return parseInt(statistics.viewCount || 0, 10);
                
            case 'videoAccelerationRate':
                return parseFloat(video.rawVideoAccelerationRate || 0);
                
            case 'legendScore':
                return parseFloat(video.legendScore || 0);
                
            case 'likes':
                return parseInt(statistics.likeCount || 0, 10);
                
            case 'comments':
                return parseInt(statistics.commentCount || 0, 10);
                
            case 'duration':
                if (contentDetails.duration) {
                    return this.parseDurationToSeconds(contentDetails.duration);
                } else if (video.duration) {
                    return this.parseTimeToSeconds(video.duration);
                }
                return 0;
                
            case 'channel':
                return snippet.channelTitle || video.channel || '';
                
            case 'channelDate':
                if (channelSnippet.publishedAt) {
                    return new Date(channelSnippet.publishedAt);
                }
                return new Date(0);
                
            case 'subscribers':
                return parseInt(channelStatistics.subscriberCount || 0, 10);
                
            case 'channelAccelerationRate':
                return parseFloat(video.rawChannelAccelerationRate || 0);
                
            case 'keyword':
                return video.keyword || '';
                
            default:
                console.warn(`알 수 없는 정렬 컬럼: ${column}`);
                return '';
        }
    }

    /**
     * 🔄 상대적 시간 문자열을 Date 객체로 변환합니다.
     * @param {string} relativeTime - "1일 전", "2주일 전" 등의 문자열.
     * @returns {Date} Date 객체.
     */
    parseRelativeDate(relativeTime) {
        const now = new Date();
        
        if (relativeTime.includes('방금')) return now;
        if (relativeTime.includes('초')) {
            const seconds = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - seconds * 1000);
        }
        if (relativeTime.includes('분')) {
            const minutes = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - minutes * 60 * 1000);
        }
        if (relativeTime.includes('시간')) {
            const hours = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - hours * 60 * 60 * 1000);
        }
        if (relativeTime.includes('일')) {
            const days = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        }
        if (relativeTime.includes('주')) {
            const weeks = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
        }
        if (relativeTime.includes('개월')) {
            const months = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
        }
        if (relativeTime.includes('년')) {
            const years = parseInt(relativeTime.match(/\d+/)?.[0] || 0);
            return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
        }
        
        return new Date(0);
    }

    /**
     * 🔄 ISO 8601 기간을 초로 변환합니다.
     * @param {string} duration - ISO 8601 기간 (예: PT1H2M3S).
     * @returns {number} 총 초.
     */
    parseDurationToSeconds(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || 0, 10);
        const minutes = parseInt(match[2] || 0, 10);
        const seconds = parseInt(match[3] || 0, 10);

        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * 🔄 시간 문자열을 초로 변환합니다.
     * @param {string} timeString - 시간 문자열 (예: "10:30", "1:02:03").
     * @returns {number} 총 초.
     */
    parseTimeToSeconds(timeString) {
        const parts = timeString.split(':').map(part => parseInt(part, 10));
        
        if (parts.length === 2) {
            // MM:SS 형식
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            // HH:MM:SS 형식
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        
        return 0;
    }

    /**
     * 🔄 정렬 컬럼의 한국어 이름을 반환합니다.
     * @param {string} column - 컬럼명.
     * @returns {string} 한국어 컬럼명.
     */
    getSortColumnName(column) {
        const columnNames = {
            'title': '제목',
            'date': '업로드일',
            'views': '조회수',
            'videoAccelerationRate': '영상떡상률',
            'legendScore': '레전드점수',
            'likes': '좋아요',
            'comments': '댓글',
            'duration': '길이',
            'channel': '채널',
            'channelDate': '채널개설일',
            'subscribers': '구독자수',
            'channelAccelerationRate': '채널성장률',
            'keyword': '키워드'
        };
        
        return columnNames[column] || column;
    }

    /**
     * 🔄 테이블 헤더의 정렬 표시를 업데이트합니다.
     * @param {string} sortBy - 현재 정렬 기준.
     * @param {string} direction - 정렬 방향 ('asc' 또는 'desc').
     */
    updateSortHeaders(sortBy, direction) {
        // 모든 정렬 표시 제거
        const allHeaders = DomUtils.querySelectorAll('.results-table th.sortable');
        allHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            // 기존 정렬 표시 제거
            const existingIndicator = header.querySelector('.sort-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
        });

        // 현재 정렬된 헤더에 표시 추가
        const currentHeader = DomUtils.querySelector(`[data-sort-by="${sortBy}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sort-${direction}`);
            
            // 정렬 방향 표시 추가
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.textContent = direction === 'asc' ? ' ▲' : ' ▼';
            indicator.style.marginLeft = '4px';
            indicator.style.fontSize = '0.8em';
            indicator.style.color = '#007bff';
            
            currentHeader.appendChild(indicator);
        }
    }

    /**
     * 🔄 [수정된 함수] UI 버튼 상태를 업데이트합니다. (활성화/비활성화)
     * @param {boolean} isSearchResultsVisible - 검색 결과 화면이 보이는지 여부.
     */
    updateButtonStates(isSearchResultsVisible) {
        // 항상 활성화되어야 하는 버튼들의 ID 목록
        // 'filter-btn'을 이 목록에 추가하여 항상 활성화되도록 합니다.
        const alwaysEnabledIds = ['refresh-home-btn', 'api-key-settings-btn', 'filter-btn'];

        // 상태를 변경할 모든 메뉴 아이템과 필터 버튼을 한 번에 선택
        const itemsToControl = DomUtils.querySelectorAll('#filter-btn, .dropdown-item');

        itemsToControl.forEach(item => {
            if (!item) return;

            const isAlwaysEnabled = alwaysEnabledIds.includes(item.id);
            // 비활성화 되어야 하는 조건: 검색 결과가 없고(false) 예외 항목이 아닐 때
            const shouldBeDisabled = !isSearchResultsVisible && !isAlwaysEnabled;

            if (item.tagName === 'BUTTON') {
                item.disabled = shouldBeDisabled;
            } else if (item.tagName === 'A') {
                if (shouldBeDisabled) {
                    DomUtils.addClass(item, 'disabled-link');
                } else {
                    DomUtils.removeClass(item, 'disabled-link');
                }
            }
        });
        
        // AI 분석 메뉴 상태 업데이트 (선택된 동영상이 있을 때만 활성화)
        this.updateAiAnalyzeButtonState();
    }

    /**
     * AI 분석 메뉴 상태를 업데이트합니다.
     * 검색 결과창일 때만 활성화됩니다.
     */
    updateAiAnalyzeButtonState() {
        const aiAnalyzeBtn = DomUtils.getElementById('ai-analyze-btn');
        if (!aiAnalyzeBtn) return;

        // 검색 결과창인지 확인
        const isSearchResultsVisible = this.searchResults && this.searchResults.classList.contains('active');
        
        // 검색 결과창일 때만 활성화
        if (isSearchResultsVisible) {
            DomUtils.removeClass(aiAnalyzeBtn, 'disabled');
        } else {
            DomUtils.addClass(aiAnalyzeBtn, 'disabled');
        }
    }

    /**
     * AI 분석 버튼 클릭 이벤트를 처리합니다.
     */
    handleAiAnalyzeClick() {
        console.log('🤖 AI 분석 버튼 클릭됨');
        
        // 선택된 동영상 확인
        if (!this.dataManager.selectedVideos || this.dataManager.selectedVideos.size === 0) {
            this.showNotification('동영상을 선택하세요', 'warning', 3000);
            return;
        }

        const selectedCount = this.dataManager.selectedVideos.size;
        console.log(`📊 선택된 동영상 수: ${selectedCount}개`);

        // 🎯 data-export.js의 공통 JSON 데이터 생성 함수 사용
        let selectedVideoData;
        try {
            if (this.youtubeApp && this.youtubeApp.dataExport) {
                selectedVideoData = this.youtubeApp.dataExport.generateSelectedVideosJsonData();
            } else {
                console.warn('⚠️ dataExport 인스턴스를 찾을 수 없어 fallback 방식 사용');
                selectedVideoData = this.collectSelectedVideoData();
            }
        } catch (error) {
            console.error('❌ 공통 JSON 데이터 생성 실패, fallback 방식 사용:', error);
            selectedVideoData = this.collectSelectedVideoData();
        }
        
        if (!selectedVideoData || selectedVideoData.length === 0) {
            this.showNotification('선택된 동영상 데이터를 가져올 수 없습니다', 'error', 3000);
            return;
        }

        // 분석 시작 메시지 표시
        this.showNotification(`${selectedCount}개의 동영상을 분석합니다 (레전드 헌팅 데이터 포함)`, 'info', 2000);

        // localStorage에 데이터 저장 (JSON 내보내기와 동일한 구조 사용)
        try {
            const aiAnalysisData = {
                videos: selectedVideoData,
                count: selectedCount,
                timestamp: new Date().toISOString(),
                source: 'youtube-search-tool-legend-hunting',
                legendHuntingEnabled: true,  // 🎯 레전드 헌팅 활성화 플래그
                dataVersion: '2.0'  // 🎯 레전드 헌팅 데이터 포함 버전
            };
            
            localStorage.setItem('youtubeSearchResults', JSON.stringify(aiAnalysisData));
            console.log('✅ AI 분석 데이터 localStorage에 저장됨 (레전드 헌팅 데이터 포함):', aiAnalysisData);

            // analyzer.html로 이동
            setTimeout(() => {
                window.open('https://tipmaster.co.kr/youtube-analyzer/', '_blank');
            }, 500);

        } catch (error) {
            console.error('❌ AI 분석 데이터 저장 실패:', error);
            this.showNotification('데이터 저장에 실패했습니다', 'error', 3000);
        }
    }

    /**
     * 🔄 선택된 동영상들의 데이터를 수집합니다. (DEPRECATED: fallback용으로만 사용)
     * 🎯 레전드 헌팅 이후: data-export.js의 generateSelectedVideosJsonData() 사용 권장
     * @returns {Array} 선택된 동영상 데이터 배열
     */
    collectSelectedVideoData() {
        const selectedData = [];
        
        if (!this.dataManager.selectedVideos || !this.dataManager.currentVideos) {
            return selectedData;
        }

        // 선택된 동영상 ID들로 필터링
        this.dataManager.selectedVideos.forEach(videoId => {
            const videoData = this.dataManager.currentVideos.find(video => 
                video.id === videoId || 
                (video.id && video.id.videoId === videoId) ||
                (video.snippet && video.snippet.resourceId && video.snippet.resourceId.videoId === videoId)
            );
            
            if (videoData) {
                selectedData.push(videoData);
            }
        });

        console.log(`📋 수집된 선택 동영상 데이터: ${selectedData.length}개`);
        return selectedData;
    }

    /**
     * 슬라이더 값을 업데이트합니다.
     * @param {number} value - 슬라이더 값
     */
    updateSliderValue(value) {
        // 새로운 기능: 입력창도 연동
        const inputElement = DomUtils.getElementById('max-results-input');
        if (inputElement) {
            inputElement.value = value;
        }
    }

    /**
     * 입력창 값에 따라 슬라이더를 업데이트합니다.
     * @param {number} value - 입력창 값
     */
    updateSliderFromInput(value) {
        // 입력값 범위 체크
        if (value < 10) value = 10;
        if (value > 100) value = 100;
        
        const sliderElement = DomUtils.getElementById('max-results');
        const inputElement = DomUtils.getElementById('max-results-input');
        
        if (sliderElement) {
            sliderElement.value = value;
        }
        if (inputElement) {
            inputElement.value = value;
        }
        
        // 기존 updateSliderValue 함수 호출하여 일관성 유지
        this.updateSliderValue(value);
    }

    /**
     * 필터를 초기화합니다.
     */
    resetFilters() {
        console.log('🔄 필터 초기화 시작');
        
        // 슬라이더 값 초기화
        const maxResultsSlider = document.getElementById('max-results');
        
        if (maxResultsSlider) {
            // 1단계: 슬라이더 값 설정
            maxResultsSlider.value = 50;
            console.log('1단계: 슬라이더 값 50으로 설정됨');
            
            // 2단계: updateSliderValue 함수 호출
            this.updateSliderValue(50);
            console.log('2단계: updateSliderValue(50) 호출됨');
            
            // 3단계: 강제로 input 이벤트 발생
            const event = new Event('input', { bubbles: true });
            maxResultsSlider.dispatchEvent(event);
            console.log('3단계: input 이벤트 강제 발생');
            
        } else {
            console.error('❌ max-results 슬라이더를 찾을 수 없습니다!');
        }
        
        // 입력창도 초기화
        const maxResultsInput = document.getElementById('max-results-input');
        if (maxResultsInput) {
            maxResultsInput.value = 50;
            console.log('입력창도 50으로 초기화됨');
        }

        // 다른 필터 요소들도 초기화
        const sortBySelect = document.getElementById('sort-by');
        const durationSelect = document.getElementById('duration');
        const minViewsInput = document.getElementById('min-views');
        const maxSubscribersInput = document.getElementById('max-subscribers');
        const minSubscribersInput = document.getElementById('min-subscribers');
        const koreanOnlyCheckbox = document.getElementById('korean-only');
        
        if (sortBySelect) sortBySelect.value = 'relevance';
        if (durationSelect) durationSelect.value = 'any';
        if (minViewsInput) minViewsInput.value = '';
        if (maxSubscribersInput) maxSubscribersInput.value = '';
        if (minSubscribersInput) minSubscribersInput.value = '';
        if (koreanOnlyCheckbox) koreanOnlyCheckbox.checked = true;
        
        // 🎯 레전드점수 최소값 필터도 초기화
        const legendScoreInput = document.getElementById('legend-score-input');
        if (legendScoreInput) legendScoreInput.value = 100;
        
        this.showNotification('필터가 초기화되었습니다.', 'info', 2000);
        console.log('✅ 필터 초기화 완료');
    }

}

export default UIManager;