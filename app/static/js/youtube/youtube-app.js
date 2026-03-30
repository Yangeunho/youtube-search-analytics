// YouTube 검색 도구 - 메인 JavaScript 파일

// managers/ 디렉토리의 모듈 임포트
import DataManager from './managers/data-manager.js';
import UIManager from './managers/ui-manager.js';
import SearchManager from './managers/search-manager.js';
import ToolsManager from './managers/tools-manager.js';
import AnalysisManager from './managers/analysis-manager.js';

// components/ 디렉토리의 모듈 임포트
import VideoDisplay from './components/video-display.js';
import ModalComponents from './components/modal-components.js';
import UiControls from './components/ui-controls.js';

// data/ 디렉토리의 모듈 임포트
import DataExport from './data/data-export.js';

// utils/ 디렉토리의 모듈 임포트 (이 파일들은 직접 여기서 인스턴스화되거나 사용되지 않지만, 경로 명시)
import ApiHelpers from './utils/api-helpers.js';
import DomUtils from './utils/dom-utils.js';
import Formatters from './utils/formatters.js';
import YouTubeCalculations from './utils/calculations.js';


class YouTubeApp {
    constructor() {
        // 모든 매니저들을 인스턴스화하고 의존성 주입
        this.dataManager = new DataManager();
        
        this.uiManager = new UIManager({
            dataManager: this.dataManager,
            modalComponents: null, // 나중에 주입
            youtubeApp: this // UIManager가 YouTubeApp 인스턴스에 접근할 수 있도록
        });
        this.modalComponents = new ModalComponents({
            dataManager: this.dataManager,
            uiManager: this.uiManager,
            searchManager: null // 나중에 주입
        });
        this.searchManager = new SearchManager({
            dataManager: this.dataManager,
            uiManager: this.uiManager,
            videoDisplay: null // 나중에 주입
        });
        this.videoDisplay = new VideoDisplay({ 
            dataManager: this.dataManager,
            uiManager: this.uiManager
        });
        this.toolsManager = new ToolsManager({
            dataManager: this.dataManager,
            uiManager: this.uiManager,
            videoDisplay: this.videoDisplay, 
            modalComponents: this.modalComponents
        });
        this.dataExport = new DataExport({
            dataManager: this.dataManager,
            uiManager: this.uiManager
        });
        this.analysisManager = new AnalysisManager({
            dataManager: this.dataManager,
            uiManager: this.uiManager
        });
        this.uiControls = new UiControls({ 
            dataManager: this.dataManager,
            uiManager: this.uiManager,
            searchManager: this.searchManager,
            modalComponents: this.modalComponents,
            toolsManager: this.toolsManager,
            dataExport: this.dataExport,
            analysisManager: this.analysisManager
        });

        // 순환 참조 해결 및 모든 인스턴스 주입 완료
        this.uiManager.modalComponents = this.modalComponents;
        this.uiManager.youtubeApp = this; 

        this.modalComponents.youtubeApp = this; 
        this.modalComponents.searchManager = this.searchManager; 

        this.searchManager.videoDisplay = this.videoDisplay; 

        this.init();
    }

    init() {
        console.log('YouTube App 초기화 중...'); 
        this.dataManager.loadSettings(); 
        this.uiManager.loadSettings(); 
        this.videoDisplay.loadYouTubeHome(); 
        this.uiManager.updateApiButton(); 
        this.bindGlobalListeners();
        this.uiManager.updateButtonStates(false); // 🆕 추가: 앱 로드 시 초기 버튼 상태를 '홈 화면' 기준으로 설정
    }

    // 전역 이벤트 리스너 (모달 닫기 등)
    bindGlobalListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.uiManager.closeModal(e.target);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.uiManager.closeAllModals();
                this.uiManager.closeAllDropdowns();
            }
        });

        // 분석 드롭다운 열릴 때 상태 업데이트
        document.addEventListener('click', (e) => {
            if (e.target.matches('#analyze-dropdown-btn') || e.target.closest('#analyze-dropdown-btn')) {
                setTimeout(() => {
                    if (this.uiManager) {
                        this.uiManager.updateAnalysisButtonStates();
                    }
                }, 100);
            }
        });

        // 분석 모드 변경 이벤트 리스너
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[name="analysis-mode"]')) {
                const mode = e.target.value;
                if (this.uiManager) {
                    this.uiManager.setAnalysisMode(mode);
                }
            }
        });

        // AI 분석 버튼 클릭 이벤트 리스너
        document.addEventListener('click', (e) => {
            if (e.target.matches('#ai-analyze-btn') || e.target.closest('#ai-analyze-btn')) {
                e.preventDefault();
                if (this.uiManager && !e.target.classList.contains('disabled')) {
                    this.uiManager.handleAiAnalyzeClick();
                }
            }
        });

        // 🌍 국가/카테고리 변경 시 인기 동영상 자동 재로딩
        const trendingCountry = document.getElementById('trending-country');
        const trendingCategory = document.getElementById('trending-category');
        if (trendingCountry) {
            trendingCountry.addEventListener('change', () => this.videoDisplay.loadYouTubeHome());
        }
        if (trendingCategory) {
            trendingCategory.addEventListener('change', () => this.videoDisplay.loadYouTubeHome());
        }
    }
}

// 전역 변수로 설정 (HTML에서 접근할 수 있도록)
window.youtubeApp = null;

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.youtubeApp = new YouTubeApp();
    console.log('YouTube App이 초기화되었습니다.'); 
});
