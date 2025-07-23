/**
 * @fileoverview 사용자 인터페이스의 드롭다운, 버튼 클릭, 키보드 단축키 등
 * 다양한 UI 컨트롤 및 상호작용 로직을 담당합니다.
 */

import DomUtils from '../utils/dom-utils.js';

class UiControls {
    /**
     * UiControls 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스. (선택 상태, 설정 저장 접근용)
     * @param {object} dependencies.uiManager - UI 관리자 인스턴스. (알림, 모달 닫기, UI 업데이트용)
     * @param {object} dependencies.searchManager - 검색 관리자 인스턴스. (검색 실행용)
     * @param {object} dependencies.modalComponents - 모달 컴포넌트 인스턴스. (모달 열기/닫기용)
     * @param {object} dependencies.toolsManager - 도구 관리자 인스턴스. (선택된 비디오 열기, 결과 지우기 등)
     * @param {object} dependencies.dataExport - 데이터 내보내기 인스턴스. (내보내기 기능용)
     * @param {object} dependencies.analysisManager - 분석 관리자 인스턴스. (분석 기능용)
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;
        this.searchManager = dependencies.searchManager;
        this.modalComponents = dependencies.modalComponents;
        this.toolsManager = dependencies.toolsManager;
        this.dataExport = dependencies.dataExport;
        this.analysisManager = dependencies.analysisManager;

        // 모든 의존성이 설정된 후 이벤트 리스너 초기화
        this._initializeEventListeners();
    }

    /**
     * DOM 이벤트 리스너를 초기화합니다.
     * 이 메서드는 UiControls 인스턴스 생성 시 한 번 호출되어야 합니다.
     * @private
     */
    _initializeEventListeners() {
        // 검색 버튼
        const searchButton = DomUtils.getElementById('search-button');
        if (searchButton) {
            searchButton.addEventListener('click', () => this.searchManager.performSearch());
        }

        // 검색 입력 필드 (Enter 키)
        const searchInput = DomUtils.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchManager.performSearch();
                }
            });
        }

        // ⭐ [수정 1] 필터 버튼 리스너를 원래의 단순한 코드로 복구합니다.
        // 필터 버튼
        const filterButton = DomUtils.getElementById('filter-btn');
        if (filterButton) {
            filterButton.addEventListener('click', () => this.modalComponents.openFilterModal());
        }

        // 필터 모달 내부의 초기화 버튼 (HTML의 onclick 대신 JavaScript 이벤트 리스너 사용)
        const resetFiltersBtn = DomUtils.getElementById('reset-filters-btn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                // 기존 onclick 코드 제거하고 여기서 처리
                if (this.uiManager?.resetFilters) {
                    this.uiManager.resetFilters();
                }
            });
        }

        // 필터 적용 버튼
        const applyFiltersBtn = DomUtils.getElementById('apply-filters-btn');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                if (this.uiManager?.applyFilters) {
                    this.uiManager.applyFilters();
                }
            });
        }

        // 슬라이더 입력 이벤트 (실시간 업데이트)
        const maxResultsSlider = DomUtils.getElementById('max-results');
        if (maxResultsSlider) {
            maxResultsSlider.addEventListener('input', (e) => {
                this.updateSliderDisplay(e.target.value);
            });
        }

        // '저장' 드롭다운 버튼 [ID 변경됨]
        const saveDropdownBtn = DomUtils.getElementById('save-dropdown-btn');
        if (saveDropdownBtn) {
            saveDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('save-dropdown'); // 드롭다운 메뉴 ID도 변경
            });
        }

        // '저장' 드롭다운 항목들
        const exportExcelBtn = DomUtils.getElementById('export-excel-btn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.dataExport.exportToExcel(this.dataManager.currentVideos, 'youtube_results.xlsx'));
        }
        const exportJsonBtn = DomUtils.getElementById('export-json-btn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.dataExport.exportToJson(this.dataManager.currentVideos, 'youtube_results.json'));
        }
        
        // AI 분석 버튼
        const exportAiAnalysisBtn = DomUtils.getElementById('export-ai-analysis-btn');
        if (exportAiAnalysisBtn) {
            exportAiAnalysisBtn.addEventListener('click', () => this.dataExport.exportForAIAnalysis());
        }

        // '분석' 드롭다운 버튼 [ID 변경됨]
        const analyzeDropdownBtn = DomUtils.getElementById('analyze-dropdown-btn');
        if (analyzeDropdownBtn) {
            analyzeDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('analyze-dropdown'); // 드롭다운 메뉴 ID도 변경
            });
        }
        // '분석' 드롭다운 항목들 [ID 변경됨]
        const analyzeBasicStatsBtn = DomUtils.getElementById('analyze-basic-stats-btn');
        if (analyzeBasicStatsBtn) {
            analyzeBasicStatsBtn.addEventListener('click', () => this.analysisManager.showBasicStats());
        }
        const analyzeTrendBtn = DomUtils.getElementById('analyze-trend-btn');
        if (analyzeTrendBtn) {
            analyzeTrendBtn.addEventListener('click', () => this.analysisManager.showTrendAnalysis());
        }
        const analyzeKeywordBtn = DomUtils.getElementById('analyze-keyword-btn'); // 새로운 ID
        if (analyzeKeywordBtn) {
            analyzeKeywordBtn.addEventListener('click', () => this.analysisManager.showKeywordAnalysis()); // 함수명 추정, 필요시 확인
        }
        const analyzeChannelComparisonBtn = DomUtils.getElementById('analyze-channel-comparison-btn'); // 새로운 ID
        if (analyzeChannelComparisonBtn) {
            analyzeChannelComparisonBtn.addEventListener('click', () => this.analysisManager.showChannelComparison()); // 함수명 추정, 필요시 확인
        }
        const analyzePredictionBtn = DomUtils.getElementById('analyze-prediction-btn'); // 새로운 ID
        if (analyzePredictionBtn) {
            analyzePredictionBtn.addEventListener('click', () => this.analysisManager.showPrediction()); // 함수명 추정, 필요시 확인
        }


        // '도구' 드롭다운 버튼 [ID 유지]
        const toolsDropdownBtn = DomUtils.getElementById('tools-dropdown-btn');
        if (toolsDropdownBtn) {
            toolsDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('tools-dropdown-menu'); // 드롭다운 메뉴 ID 유지
            });
        }
        // '도구' 드롭다운 항목들 [ID 변경됨]
        const openSelectedBtn = DomUtils.getElementById('open-selected-btn');
        if (openSelectedBtn) {
            openSelectedBtn.addEventListener('click', () => this.toolsManager.openSelectedVideos());
        }
        const showVideoDetailsBtn = DomUtils.getElementById('show-video-details-btn'); // 새로운 ID
        if (showVideoDetailsBtn) {
            showVideoDetailsBtn.addEventListener('click', () => this.modalComponents.openVideoDetailModal(this.dataManager.getSelectedVideoIds().values().next().value)); // 선택된 첫 비디오 ID 넘기기
        }
        const clearResultsBtn = DomUtils.getElementById('clear-results-btn');
        if (clearResultsBtn) {
            clearResultsBtn.addEventListener('click', () => this.toolsManager.clearSearchResults());
        }
        const refreshHomeBtn = DomUtils.getElementById('refresh-home-btn');
        if (refreshHomeBtn) {
            refreshHomeBtn.addEventListener('click', () => this.toolsManager.refreshYouTubeHome());
        }
        const showHelpModalBtn = DomUtils.getElementById('show-help-modal-btn'); // 새로운 ID
        if (showHelpModalBtn) {
            showHelpModalBtn.addEventListener('click', () => this.modalComponents.openHelpModal()); // 함수명 추정, 필요시 확인
        }
        const apiKeySettingsBtn = DomUtils.getElementById('api-key-settings-btn'); // 새로운 ID (API 키 설정)
        if (apiKeySettingsBtn) {
            apiKeySettingsBtn.addEventListener('click', () => this.modalComponents.openApiModal());
        }
        
        // API 모드 토글 버튼 (기존 유지)
        const apiModeToggleBtn = DomUtils.getElementById('api-mode-toggle-btn'); 
        if (apiModeToggleBtn) {
            apiModeToggleBtn.addEventListener('click', () => this.uiManager.toggleApiMode());
        }
        
        // '홈 새로고침' 버튼 (메인 섹션 우측 상단) [ID 변경됨]
        const refreshHomeButton = DomUtils.getElementById('refresh-home-button');
        if (refreshHomeButton) {
            refreshHomeButton.addEventListener('click', () => this.toolsManager.refreshYouTubeHome());
        }

        // 모든 모달 닫기 버튼에 이벤트 리스너 추가 
        const closeButtons = DomUtils.querySelectorAll('.close-button');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.uiManager.closeModal(modal);
                }
            });
        });

        // 전체 선택 체크박스
        const selectAllCheckbox = DomUtils.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        }

        // 페이지네이션 버튼
        const prevPageBtn = DomUtils.getElementById('prev-page-btn');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.searchManager.goToPrevPage());
        }
        const nextPageBtn = DomUtils.getElementById('next-page-btn');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.searchManager.goToNextPage());
        }

        // Esc 키로 모달/드롭다운 닫기
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.uiManager.closeAllModals();
                this.uiManager.closeAllDropdowns();
            }
        });

        // 문서 클릭 시 드롭다운 닫기
        document.addEventListener('click', (event) => {
            const dropdownMenus = DomUtils.querySelectorAll('.dropdown-menu.show');
            dropdownMenus.forEach(menu => {
                const parentDropdown = menu.closest('.dropdown');
                if (parentDropdown && !parentDropdown.contains(event.target)) {
                    this.uiManager.closeDropdown(menu.id);
                }
            });
        });

        // 모달 외부 클릭시 닫기
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && !e.target.closest('.modal-content')) {
                this.uiManager.closeModal(e.target);
            }
        });

        // 🔄 테이블 헤더 클릭 시 정렬 (정렬 기능 연결)
        const sortableHeaders = DomUtils.querySelectorAll('.results-table th.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const sortBy = e.currentTarget.dataset.sortBy;
                if (sortBy) {
                    this.uiManager.sortTable(sortBy);
                }
            });
        });

        // 홈 버튼
        const homeButton = DomUtils.getElementById('home-button');
        if (homeButton) {
            homeButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.uiManager.showYouTubeHome(); 
            });
        }

        // ⭐ 추가: "오늘의 인기 동영상" 제목 클릭 시 새로고침
        const homeHeaderTitle = document.querySelector('.home-header h2');
        if (homeHeaderTitle) {
            homeHeaderTitle.addEventListener('click', () => {
                this.toolsManager.refreshYouTubeHome();
            });
            // 클릭 가능한 스타일 추가
            homeHeaderTitle.style.cursor = 'pointer';
            homeHeaderTitle.style.userSelect = 'none';
        }

        // ⭐ [수정 2] 페이지 로드 시 '초기화 버튼'을 클릭하는 코드를 이 함수의 마지막에 추가합니다.
        requestAnimationFrame(() => {
            const resetFiltersBtn = DomUtils.getElementById('reset-filters-btn');
            if (resetFiltersBtn) {
                resetFiltersBtn.click();
            }
        });
    }

    /**
     * 슬라이더 값과 표시 텍스트를 동기화합니다.
     * @param {number|string} value - 설정할 슬라이더 값
     */
    updateSliderDisplay(value) {
        const slider = DomUtils.getElementById('max-results');
        // ✅ ID를 'max-results-input'으로 변경
        const displayInput = DomUtils.getElementById('max-results-input'); 
        
        if (slider && displayInput) {
            slider.value = value;
            // ✅ textContent가 아닌 value 속성을 변경
            displayInput.value = value; 
        } else {
            // 이 오류는 이제 발생하지 않아야 합니다.
            console.error('[UiControls.updateSliderDisplay] 슬라이더 또는 표시 요소를 찾을 수 없습니다.');
        }
    }

    /**
     * 특정 드롭다운 메뉴를 토글합니다.
     * 다른 열려있는 드롭다운은 닫습니다.
     * @param {string} dropdownId - 토글할 드롭다운 메뉴의 ID.
     */
    toggleDropdown(dropdownId) {
        // 모든 열려있는 드롭다운 메뉴 닫기 (현재 열려는 드롭다운이 아닌 경우)
        DomUtils.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (menu.id !== dropdownId) {
                this.uiManager.closeDropdown(menu.id);
            }
        });

        const dropdown = DomUtils.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.toggle('show');
            const parentDropdown = dropdown.closest('.dropdown');
            if (parentDropdown) {
                if (dropdown.classList.contains('show')) {
                    DomUtils.addClass(parentDropdown, 'active');
                } else {
                    DomUtils.removeClass(parentDropdown, 'active');
                }
            }
        } else {
            console.error(`[UiControls.toggleDropdown] Dropdown element with ID ${dropdownId} not found.`);
        }
    }


    /**
     * 모든 비디오 체크박스를 선택 또는 해제합니다.
     * @param {boolean} checked - 체크박스 상태 (true: 선택, false: 해제).
     */
    toggleSelectAll(checked) {
        const videoCheckboxes = DomUtils.querySelectorAll('.video-checkbox');
        videoCheckboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const videoId = checkbox.dataset.videoId;
            if (checked) {
                this.dataManager.addSelectedVideo(videoId);
            } else {
                this.dataManager.removeSelectedVideo(videoId);
            }
        });
        this.uiManager.updateResultActionsButtons(checked);
    }
}

export default UiControls;