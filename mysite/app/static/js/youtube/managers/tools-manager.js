/**
 * @fileoverview YouTube 검색 도구의 다양한 유틸리티 및 도구 기능을 관리하는 매니저입니다.
 * 비디오 열기, 결과 지우기, API 키 관리, 홈 화면 새로고침 등을 포함합니다.
 */

import DomUtils from '../utils/dom-utils.js';

class ToolsManager {
    /**
     * ToolsManager 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스. (currentVideos, selectedVideos, API 키 접근 및 설정 저장용)
     * @param {object} dependencies.uiManager - UI 관리자 인스턴스. (알림, 모달, 화면 전환, 버튼 상태 업데이트용)
     * @param {object} dependencies.videoDisplay - 비디오 표시 컴포넌트 인스턴스. (홈 화면 로드용)
     * @param {object} dependencies.modalComponents - 모달 컴포넌트 인스턴스. (확인 모달 열기용)
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;
        this.videoDisplay = dependencies.videoDisplay;
        this.modalComponents = dependencies.modalComponents; // 모달 컴포넌트 추가
    }

    /**
     * 현재 선택된 모든 비디오를 새 탭에서 엽니다.
     * @returns {void}
     */
    openSelectedVideos() {
        const selectedVideoIds = this.dataManager.getSelectedVideoIds();
        if (selectedVideoIds.size === 0) {
            this.uiManager.showNotification('선택된 비디오가 없습니다.', 'warning');
            return;
        }

        selectedVideoIds.forEach(videoId => {
            DomUtils.openVideo(videoId);
        });
        this.uiManager.showNotification(`${selectedVideoIds.size}개의 비디오를 새 탭에서 엽니다.`, 'info');
    }

    /**
     * 선택된 비디오가 하나일 경우, 해당 비디오의 채널로 이동합니다.
     * @returns {void}
     */
    goToChannel() {
        const selectedVideoIds = this.dataManager.getSelectedVideoIds();
        if (selectedVideoIds.size !== 1) {
            this.uiManager.showNotification('채널로 이동하려면 하나의 비디오만 선택해주세요.', 'warning');
            return;
        }

        const videoId = selectedVideoIds.values().next().value; // Set에서 첫 번째 값 가져오기
        const video = this.dataManager.currentVideos.find(v => v.id === videoId);

        if (video && video.snippet && video.snippet.channelId) {
            window.open(`https://www.youtube.com/channel/${video.snippet.channelId}`, '_blank');
            this.uiManager.showNotification(`${video.snippet.channelTitle} 채널로 이동합니다.`, 'info');
        } else {
            this.uiManager.showNotification('채널 정보를 찾을 수 없습니다.', 'error');
        }
    }


    /**
     * 현재 검색 결과와 선택된 비디오 목록을 지웁니다.
     * @returns {void}
     */
    clearSearchResults() {
        this.dataManager.currentVideos = [];
        this.dataManager.clearSelectedVideos();
        this.dataManager.setPaginationTokens(null, null); // 페이지네이션 토큰 초기화
        this.dataManager.setCurrentPage(1); // 현재 페이지 초기화
        this.videoDisplay.displaySearchResults([]); // UI에서 결과 지움
        this.uiManager.showNotification('검색 결과가 지워졌습니다.', 'info');
        this.uiManager.updateResultActionsButtons(false); // 버튼 비활성화
        this.uiManager.updatePaginationControls(1, false); // 페이지네이션 버튼 비활성화
    }

    /**
     * API 키 초기화 확인 모달을 띄웁니다.
     */
    clearApiKeyConfirm() {
        const title = 'API 키 초기화';
        const message = '정말로 API 키를 초기화하시겠습니까? 초기화하면 데모 모드로 전환됩니다.';
        this.modalComponents.openConfirmModal(title, message, () => this.clearApiKey());
    }

    /**
     * API 키를 초기화하고 데모 모드로 전환합니다.
     * @returns {void}
     */
    clearApiKey() {
        this.uiManager.closeModal(DomUtils.getElementById('custom-confirm-modal'));

        this.dataManager.currentApiKey = '';
        this.dataManager.isApiMode = false;

        // API 키 입력 필드 UI 업데이트
        const apiKeyInput = DomUtils.getElementById('api-key-input');
        if (apiKeyInput) apiKeyInput.value = '';

        this.uiManager.updateApiButton(); // API 상태 버튼 UI 업데이트
        this.dataManager.saveSettings(); // 설정 저장
        this.uiManager.showNotification('API 키가 삭제되었습니다. 데모 모드로 전환됩니다.', 'info');
    }

    /**
     * YouTube 홈 화면을 새로고침합니다.
     * @returns {void}
     */
    refreshYouTubeHome() {
        this.uiManager.showNotification('홈 화면을 새로고침합니다...', 'info');
        this.videoDisplay.loadYouTubeHome(); // VideoDisplay를 통해 홈 화면 로드
        this.uiManager.showNotification('홈 화면이 새로고침되었습니다.', 'success');
    }

    /**
     * 디버그 정보를 콘솔에 출력합니다.
     * @returns {void}
     */
    debugInfo() {
        console.log('=== YouTube 검색 도구 디버그 정보 ===');
        console.log('현재 비디오 수:', this.dataManager.currentVideos.length);
        console.log('선택된 비디오 수:', this.dataManager.selectedVideos.size);
        console.log('API 모드:', this.dataManager.isApiMode);
        console.log('API 키 설정됨:', !!this.dataManager.currentApiKey);
        console.log('검색 필터:', this.dataManager.searchFilters);
        console.log('현재 페이지:', this.dataManager.currentPage);
        console.log('다음 페이지 토큰:', this.dataManager.nextPageToken);
        console.log('이전 페이지 토큰:', this.dataManager.prevPageToken);

        const currentVideoTitles = this.dataManager.currentVideos.map(v => v.snippet?.title || v.id);
        console.log('현재 비디오 제목 (최대 10개):', currentVideoTitles.slice(0, 10));

        this.uiManager.showNotification('디버그 정보가 콘솔에 출력되었습니다.', 'info');
    }
}

export default ToolsManager;