/**
 * @fileoverview 애플리케이션 내의 모든 모달 컴포넌트를 관리합니다.
 * API 키 설정, 검색 필터, 도움말, 비디오 상세 정보 모달 등을 포함합니다.
 */

import DomUtils from '../utils/dom-utils.js';
import Formatters from '../utils/formatters.js';

class ModalComponents {
    /**
     * ModalComponents 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스.
     * @param {object} [dependencies.uiManager] - UI 관리자 인스턴스.
     * @param {object} [dependencies.searchManager] - 검색 관리자 인스턴스.
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;
        this.searchManager = dependencies.searchManager;
        this.youtubeApp = null;

        // DOM 요소 캐싱
        this.apiModal = DomUtils.getElementById('api-modal');
        this.filterModal = DomUtils.getElementById('filter-modal');
        this.apiKeyInput = DomUtils.getElementById('api-key-input');
        this.currentModeBadge = DomUtils.getElementById('current-mode');

        // 필터 요소들
        this.sortBySelect = DomUtils.getElementById('sort-by');
        this.durationSelect = DomUtils.getElementById('duration');
        this.minViewsInput = DomUtils.getElementById('min-views');
        this.minSubscribersInput = DomUtils.getElementById('min-subscribers');
        this.maxResultsInput = DomUtils.getElementById('max-results');
        this.koreanOnlyCheckbox = DomUtils.getElementById('korean-only');

        this.videoDetailModal = DomUtils.getElementById('video-detail-modal');
        this.videoDetailContent = DomUtils.getElementById('video-detail-content');

        this.customConfirmModal = DomUtils.getElementById('custom-confirm-modal');
        this.confirmMessage = DomUtils.getElementById('confirm-message');
        this.confirmOkBtn = DomUtils.getElementById('confirm-ok-btn');
        this.confirmCancelBtn = DomUtils.getElementById('confirm-cancel-btn');

        // 이벤트 리스너 초기화
        this._initializeEventListeners();
    }

    /**
     * 모든 이벤트 리스너를 초기화합니다.
     * @private
     */
    _initializeEventListeners() {
        // 전역 클릭 이벤트로 모든 모달 버튼 처리
        document.addEventListener('click', (e) => {
            // API 키 저장 버튼
            if (e.target.matches('#api-save-btn') || 
                e.target.matches('button[onclick*="saveApiKey"]') ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('저장'))) {
                e.preventDefault();
                this.saveApiKey();
            }
            
            // API 키 삭제 버튼
            if (e.target.matches('#api-delete-btn') || 
                e.target.matches('button[onclick*="clearApiKey"]') ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('삭제'))) {
                e.preventDefault();
                this.clearApiKey();
            }
            
            // 필터 적용 버튼
            if (e.target.matches('#filter-apply-btn') || 
                e.target.matches('button[onclick*="applyFilters"]') ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('적용'))) {
                e.preventDefault();
                if (this.searchManager) {
                    this.searchManager.applyFilters();
                }
            }
            
            // 필터 초기화 버튼
            if (e.target.matches('#filter-reset-btn') || 
                e.target.matches('button[onclick*="resetFilters"]') ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('초기화'))) {
                e.preventDefault();
                if (this.searchManager) {
                    this.searchManager.resetFilters();
                }
            }
        });

        // API 모달 열릴 때마다 추가 이벤트 연결
        if (this.apiModal) {
            const apiObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (this.apiModal.classList.contains('show')) {
                            setTimeout(() => this._connectApiModalButtons(), 100);
                        }
                    }
                });
            });
            apiObserver.observe(this.apiModal, { attributes: true });
        }

        // 필터 모달 열릴 때마다 추가 이벤트 연결
        if (this.filterModal) {
            const filterObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (this.filterModal.classList.contains('show')) {
                            setTimeout(() => this._connectFilterModalButtons(), 100);
                        }
                    }
                });
            });
            filterObserver.observe(this.filterModal, { attributes: true });
        }
        
    }

    /**
     * API 모달 버튼들의 이벤트를 강제로 연결합니다.
     * @private
     */
    _connectApiModalButtons() {
        if (!this.apiModal) return;

        // 저장 버튼 찾기
        const saveButtons = this.apiModal.querySelectorAll('button');
        saveButtons.forEach(btn => {
            if (btn.textContent.includes('저장') || btn.textContent.includes('적용')) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.saveApiKey();
                };
            }
            if (btn.textContent.includes('삭제')) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.clearApiKey();
                };
            }
        });

        console.log('✅ API 모달 버튼 이벤트 연결 완료');
    }

    /**
     * 필터 모달 버튼들의 이벤트를 강제로 연결합니다.
     * @private
     */
    _connectFilterModalButtons() {
        if (!this.filterModal) return;

        const buttons = this.filterModal.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.textContent.includes('적용')) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    console.log('필터 적용 버튼 클릭');
                    if (this.searchManager) {
                        this.searchManager.applyFilters();
                    }
                };
            }
             // if (btn.textContent.includes('초기화')) {
             //     btn.onclick = (e) => {
             //         e.preventDefault();
             //         console.log('필터 초기화 버튼 클릭');
             //         if (this.searchManager) {
             //             this.searchManager.resetFilters();
             //         }
             //     };
             // }
        });

        console.log('✅ 필터 모달 버튼 이벤트 연결 완료');
    }

    /**
     * API 키 설정 모달을 엽니다.
     */
    openApiModal() {
        if (!this.apiModal || !this.apiKeyInput) {
            console.error('API 모달 또는 입력 필드를 찾을 수 없습니다.');
            return;
        }

        // 현재 저장된 API 키를 입력 필드에 표시 (보안상 마스킹)
        const currentKey = this.dataManager.getApiKey();
        if (currentKey) {
            const maskedKey = this._maskApiKey(currentKey);
            this.apiKeyInput.placeholder = `현재 키: ${maskedKey}`;
            this.apiKeyInput.value = '';
        } else {
            this.apiKeyInput.placeholder = '여기에 API 키를 입력하세요...';
            this.apiKeyInput.value = '';
        }

        if (this.uiManager) {
            this.uiManager.openModal(this.apiModal);
        }

        // 모달이 열린 후 버튼 이벤트 연결
        setTimeout(() => this._connectApiModalButtons(), 200);

        console.log('API 모달이 열렸습니다.');
    }

    /**
     * API 키를 마스킹합니다.
     * @param {string} apiKey - 마스킹할 API 키
     * @returns {string} 마스킹된 API 키
     * @private
     */
    _maskApiKey(apiKey) {
        if (!apiKey || apiKey.length < 8) {
            return '****-****';
        }
        
        const start = apiKey.substring(0, 4);
        const end = apiKey.substring(apiKey.length - 4);
        const middle = '*'.repeat(Math.max(4, apiKey.length - 8));
        
        return `${start}${middle}${end}`;
    }

    /**
     * 입력된 API 키를 저장하고 적용합니다.
     */
    saveApiKey() {
        console.log('API 키 저장 시도 중...');
        
        if (!this.apiKeyInput) {
            console.error('API 키 입력 필드를 찾을 수 없습니다.');
            if (this.uiManager) {
                this.uiManager.showNotification('API 키 입력 필드 오류', 'error');
            }
            return;
        }
        
        const newKey = this.apiKeyInput.value.trim();
        if (!newKey) {
            if (!this.dataManager.getApiKey()) {
                if (this.uiManager) {
                    this.uiManager.showNotification('API 키를 입력해주세요.', 'warning');
                }
                return;
            } else {
                if (this.uiManager) {
                    this.uiManager.showNotification('기존 API 키가 유지됩니다.', 'success');
                    this.uiManager.closeModal(this.apiModal);
                }
                return;
            }
        }

        // API 키 형식 검증
        if (!this._validateApiKeyFormat(newKey)) {
            if (this.uiManager) {
                this.uiManager.showNotification('올바르지 않은 API 키 형식입니다. YouTube Data API v3 키를 입력해주세요.', 'error');
            }
            return;
        }

        // API 키 저장
        this.dataManager.setApiKey(newKey);
        this.dataManager.isApiMode = true;
        
        if (this.uiManager) {
            this.uiManager.updateApiButton();
            this.uiManager.showNotification('API 키가 안전하게 저장되고 적용되었습니다.', 'success');
            this.uiManager.closeModal(this.apiModal);
        }

        // 입력 필드 초기화
        this.apiKeyInput.value = '';
        
        console.log('API 키 저장 완료');
    }

    /**
     * API 키 형식을 검증합니다.
     * @param {string} apiKey - 검증할 API 키
     * @returns {boolean} 유효성 여부
     * @private
     */
    _validateApiKeyFormat(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // YouTube Data API 키 형식: AIza로 시작하는 39자리
        const apiKeyPattern = /^AIza[0-9A-Za-z-_]{35}$/;
        return apiKeyPattern.test(apiKey);
    }

    /**
     * API 키를 삭제합니다.
     */
    clearApiKey() {
        console.log('API 키 삭제 시도 중...');
        
        // 확인 모달 표시
        this.openConfirmModal(
            'API 키 삭제',
            '정말로 API 키를 삭제하시겠습니까? 삭제하면 데모 모드로 전환됩니다.',
            () => {
                this.dataManager.clearApiKey();
                
                if (this.apiKeyInput) {
                    this.apiKeyInput.value = '';
                    this.apiKeyInput.placeholder = '여기에 API 키를 입력하세요...';
                }
                
                if (this.uiManager) {
                    this.uiManager.updateApiButton();
                    this.uiManager.showNotification('API 키가 안전하게 삭제되었습니다.', 'info');
                }
                
                console.log('API 키 삭제 완료');
            }
        );
    }

    /**
     * 필터 모달을 엽니다.
     */
    openFilterModal() {
        if (!this.filterModal) return;

        const filters = this.dataManager.searchFilters;

        // 현재 필터 값들을 UI에 반영
        if (this.sortBySelect) this.sortBySelect.value = filters.sortBy;
        if (this.durationSelect) this.durationSelect.value = filters.duration;
        if (this.minViewsInput) this.minViewsInput.value = filters.minViews;
        if (this.minSubscribersInput) this.minSubscribersInput.value = filters.minSubscribers;
        if (this.maxResultsInput) this.maxResultsInput.value = filters.maxResults;
        if (this.koreanOnlyCheckbox) this.koreanOnlyCheckbox.checked = filters.koreanOnly;

        if (this.uiManager) {
            this.uiManager.openModal(this.filterModal);
        }

        // 모달이 열린 후 버튼 이벤트 연결
        setTimeout(() => this._connectFilterModalButtons(), 200);
    }

    /**
     * 필터 모달을 닫습니다.
     */
    closeFilterModal() {
        if (this.filterModal && this.uiManager) {
            this.uiManager.closeModal(this.filterModal);
        }
    }

    /**
     * API 모달을 닫습니다.
     */
    closeApiModal() {
        if (this.apiModal && this.uiManager) {
            this.uiManager.closeModal(this.apiModal);
        }
    }

    /**
     * 비디오 상세 정보 모달을 열고 내용을 표시합니다.
     * @param {string} videoId - 상세 정보를 표시할 비디오의 ID.
     */
    openVideoDetailModal(videoId) {
        const video = this.dataManager.currentVideos.find(v => v.id === videoId);
        if (!video) {
            if (this.uiManager) {
                this.uiManager.showNotification('비디오 정보를 찾을 수 없습니다.', 'error');
            }
            return;
        }

        if (!this.videoDetailModal || !this.videoDetailContent) return;

        this.videoDetailContent.innerHTML = this._generateVideoDetailHtml(video);
        if (this.uiManager) {
            this.uiManager.openModal(this.videoDetailModal);
        }
    }

    /**
     * 비디오 상세 모달을 닫습니다.
     */
    closeVideoDetailModal() {
        if (this.videoDetailModal && this.uiManager) {
            this.uiManager.closeModal(this.videoDetailModal);
        }
    }

    /**
     * 비디오 상세 정보를 위한 HTML 콘텐츠를 생성합니다.
     * @param {object} video - 비디오 데이터 객체.
     * @returns {string} 생성된 HTML 문자열.
     * @private
     */
    _generateVideoDetailHtml(video) {
        const { id: videoId, snippet, statistics, contentDetails, channelSnippet, channelStatistics } = video;

        const viewCount = statistics?.viewCount ? Formatters.formatNumber(statistics.viewCount) : 'N/A';
        const likeCount = statistics?.likeCount ? Formatters.formatNumber(statistics.likeCount) : 'N/A';
        const commentCount = statistics?.commentCount ? Formatters.formatNumber(statistics.commentCount) : 'N/A';
        const duration = contentDetails?.duration ? Formatters.formatDuration(contentDetails.duration) : 'N/A';

        const channelTitle = snippet.channelTitle;
        const channelPublishedAt = channelSnippet?.publishedAt ? Formatters.formatDateTime(channelSnippet.publishedAt) : 'N/A';
        const subscriberCount = channelStatistics?.subscriberCount ? Formatters.formatNumber(channelStatistics.subscriberCount) : 'N/A';

        const videoAccelerationRate = (typeof video.rawVideoAccelerationRate === 'number' && !isNaN(video.rawVideoAccelerationRate))
            ? video.rawVideoAccelerationRate.toFixed(2)
            : '0.00';
        const channelAccelerationRate = (typeof video.rawChannelAccelerationRate === 'number' && !isNaN(video.rawChannelAccelerationRate))
            ? video.rawChannelAccelerationRate.toFixed(2)
            : '0.00';

        const safeTitle = this._escapeHtml(snippet.title);
        const safeDescription = this._escapeHtml(snippet.description || '설명 없음');

        return `
            <div>
                <!-- 썸네일과 제목 영역 -->
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || ''}" alt="${safeTitle}" style="width: 100%; max-width: 600px; height: auto; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <h3 style="margin: 10px 0;">${safeTitle}</h3>
                    
                    <!-- 버튼들을 제목 바로 아래 배치 -->
                    <div style="margin: 15px 0; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.open('https://www.youtube.com/watch?v=${videoId}', '_blank')" style="background: #ff6b6b; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500; transition: background 0.3s;">
                            🎬 비디오 열기
                        </button>
                        <button onclick="window.youtubeApp.modalComponents.copyVideoLink('${videoId}')" style="background: #4ECDC4; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500; transition: background 0.3s;">
                            📋 링크 복사
                        </button>
                    </div>
                </div>

                <!-- 정보들을 2열로 배치 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                    <!-- 좌측 열: 비디오 정보 -->
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h4 style="margin-top: 0; color: #333; border-bottom: 2px solid #dee2e6; padding-bottom: 8px; margin-bottom: 15px;">📹 비디오 정보</h4>
                        <div style="display: grid; gap: 8px;">
                            <p style="margin: 0; font-size: 0.9em;"><strong>게시일:</strong> <span style="color: #666;">${Formatters.formatDateTime(snippet.publishedAt)}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>조회수:</strong> <span style="color: #666;">${viewCount}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>좋아요:</strong> <span style="color: #666;">${likeCount}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>댓글 수:</strong> <span style="color: #666;">${commentCount}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>길이:</strong> <span style="color: #666;">${duration}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>떡상률:</strong> <span style="color: #e74c3c; font-weight: 600;">${videoAccelerationRate}</span></p>
                        </div>
                    </div>

                    <!-- 우측 열: 채널 정보 -->
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h4 style="margin-top: 0; color: #333; border-bottom: 2px solid #dee2e6; padding-bottom: 8px; margin-bottom: 15px;">📺 채널 정보</h4>
                        <div style="display: grid; gap: 8px;">
                            <p style="margin: 0; font-size: 0.9em;"><strong>채널명:</strong> <a href="https://www.youtube.com/channel/${snippet.channelId}" target="_blank" style="color: #007bff; text-decoration: none;">${this._escapeHtml(channelTitle)}</a></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>구독자 수:</strong> <span style="color: #666;">${subscriberCount}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>채널 개설:</strong> <span style="color: #666;">${channelPublishedAt}</span></p>
                            <p style="margin: 0; font-size: 0.9em;"><strong>확산률:</strong> <span style="color: #28a745; font-weight: 600;">${channelAccelerationRate}</span></p>
                        </div>
                    </div>
                </div>

                <!-- 설명 영역 (전체 너비) -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <h4 style="margin-top: 0; color: #333; border-bottom: 2px solid #dee2e6; padding-bottom: 8px; margin-bottom: 15px;">📝 설명</h4>
                    <p style="color: #666; font-size: 0.9em; line-height: 1.5; margin: 0; max-height: 120px; overflow-y: auto; white-space: pre-line;">
                        ${Formatters.truncateText(safeDescription, 500)}
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * HTML 이스케이프 함수
     * @param {string} text - 이스케이프할 텍스트
     * @returns {string} 이스케이프된 텍스트
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 사용자 정의 확인 모달을 엽니다.
     * @param {string} title - 모달 제목.
     * @param {string} message - 모달 메시지.
     * @param {function} onConfirm - '예' 버튼 클릭 시 실행될 콜백 함수.
     */
    openConfirmModal(title, message, onConfirm) {
        if (this.confirmMessage) {
            DomUtils.setTextContent(this.confirmMessage, message);
        }
    
        // 직접 DOM 조작으로 모달 열기
        const modal = document.getElementById('custom-confirm-modal');
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    
        // 버튼 스타일 및 이벤트 설정
        setTimeout(() => {
            const confirmBtn = document.getElementById('confirm-ok-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            const closeBtn = document.querySelector('#custom-confirm-modal .close-button');
            
            // 확인/취소 버튼 스타일
            [confirmBtn, cancelBtn].forEach(btn => {
                if (btn) {
                    btn.style.zIndex = '99999';
                    btn.style.position = 'relative';
                    btn.style.pointerEvents = 'auto';
                }
            });
            
            // 닫기 버튼 스타일
            if (closeBtn) {
                closeBtn.style.position = 'absolute';
                closeBtn.style.top = '10px';
                closeBtn.style.right = '15px';
                closeBtn.style.zIndex = '99999';
                closeBtn.style.pointerEvents = 'auto';
            }
            
            // 확인 버튼 이벤트
            if (confirmBtn) {
                confirmBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onConfirm();
                    const modal = document.getElementById('custom-confirm-modal');
                    if (modal) {
                        modal.classList.remove('show');
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                };
            }
            
            // 취소 버튼 이벤트
            if (cancelBtn) {
                cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const modal = document.getElementById('custom-confirm-modal');
                    if (modal) {
                        modal.classList.remove('show');
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                };
            }
            
            // 닫기 버튼 이벤트
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const modal = document.getElementById('custom-confirm-modal');
                    if (modal) {
                        modal.classList.remove('show');
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                };
            }
        }, 100);
    }

    /**
     * 비디오 링크 복사 및 토스트 메시지 표시
     * @param {string} videoId - 복사할 비디오의 ID
     */
    copyVideoLink(videoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        navigator.clipboard.writeText(videoUrl).then(() => {
            if (this.uiManager && this.uiManager.showNotification) {
                this.uiManager.showNotification('클립보드에 복사되었습니다', 'success');
            } else if (window.showNotification) {
                window.showNotification('클립보드에 복사되었습니다', 'success');
            }
        }).catch(() => {
            if (this.uiManager && this.uiManager.showNotification) {
                this.uiManager.showNotification('복사 실패', 'error');
            } else if (window.showNotification) {
                window.showNotification('복사 실패', 'error');
            }
        });
    }

    /**
     * 의존성 설정 (나중에 앱에서 호출)
     * @param {object} uiManager - UI 관리자 인스턴스
     * @param {object} searchManager - 검색 관리자 인스턴스
     */
    setDependencies(uiManager, searchManager) {
        this.uiManager = uiManager;
        this.searchManager = searchManager;
        console.log('ModalComponents: 의존성 설정 완료');
    }
}

export default ModalComponents;
