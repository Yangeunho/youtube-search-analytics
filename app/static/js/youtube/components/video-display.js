/**
 * @fileoverview 완전 수정된 20개 동영상 표시 컴포넌트
 * - 실제 사진 즉시 표시
 * - "Waiting for API connection" 완전 제거
 * - 20개 동영상 지원
 */

import Formatters from '../utils/formatters.js';
import DomUtils from '../utils/dom-utils.js';

class VideoDisplay {
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;

        this.homeVideoGrid = DomUtils.getElementById('home-video-grid');
        this.resultsTableBody = DomUtils.getElementById('results-table-body');
        this.resultsCount = DomUtils.getElementById('results-count');

        // 캐시된 가상 데이터
        this._cachedMockVideos = null;
        
        // 디바운스된 리사이즈 핸들러
        this._debouncedResize = this._debounce(this.updateResponsiveGrid.bind(this), 100);
        window.addEventListener('resize', this._debouncedResize);
        
        // 초기 그리드 설정
        requestAnimationFrame(() => this.updateResponsiveGrid());
    }

    _debounce(func, wait) {
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
     * YouTube 홈 화면의 동영상을 로드합니다.
     */
    async loadYouTubeHome() {
        console.log('🔄 YouTube 홈 로딩 시작 (25개 동영상)');
        
        this.uiManager.showLoadingSpinner();
        this.uiManager.hideSearchResults();
        this.uiManager.showYouTubeHome();

        const { currentApiKey, isApiMode } = this.dataManager;
        
        console.log('📊 현재 상태:', { 
            hasApiKey: !!currentApiKey, 
            isApiMode, 
            apiKeyLength: currentApiKey?.length || 0 
        });

        try {
            let videos = [];
            
            if (currentApiKey && currentApiKey.trim().length > 0 && isApiMode) {
                console.log('🔑 API 모드로 실행 - 직접 YouTube API 호출');
                this.uiManager.showNotification('YouTube 인기 동영상을 불러오는 중...', 'info');
                
                try {
                    videos = await this._fetchYouTubeTrendingDirect(currentApiKey);
                    
                    if (videos && videos.length > 0) {
                        this.uiManager.showNotification(`YouTube 인기 동영상 ${videos.length}개를 성공적으로 로드했습니다!`, 'success', 3000);
                        console.log('✅ 직접 API 호출 성공:', videos.length + '개');
                    } else {
                        throw new Error('YouTube API에서 빈 데이터를 반환했습니다.');
                    }
                } catch (apiError) {
                    console.error('❌ 직접 API 호출 실패:', apiError);
                    this.uiManager.showNotification(`API 호출 실패: ${apiError.message}. 25개 실제 사진 데모로 전환합니다.`, 'warning', 5000);
                    videos = this._create20RealPhotoVideos();
                }
            } else {
                console.log('📸 20개 실제 사진 데모 모드로 실행');
                this.uiManager.showNotification('25개 실제 사진 데모 모드입니다. 아름다운 실제 사진을 표시합니다.', 'info', 3000);
                videos = this._create20RealPhotoVideos();
            }

            this.dataManager.currentVideos = videos;
            this.dataManager.clearSelectedVideos();
            this.displayHomeVideos(videos);

        } catch (error) {
            console.error('❌ 전체 로딩 중 오류:', error);
            this.uiManager.showNotification(`오류: ${error.message}`, 'error');
            
            const fallbackVideos = this._create20RealPhotoVideos();
            this.dataManager.currentVideos = fallbackVideos;
            this.displayHomeVideos(fallbackVideos);
        } finally {
            setTimeout(() => {
                this.uiManager.hideLoadingOverlay();
            }, 300);
        }
    }

    /**
     * 직접 YouTube Data API v3을 호출하여 인기 동영상을 가져옵니다.
     */
    async _fetchYouTubeTrendingDirect(apiKey) {
        console.log('🌐 직접 YouTube Data API v3 호출 시작');
        
        const baseUrl = 'https://www.googleapis.com/youtube/v3/videos';
        const params = new URLSearchParams({
            part: 'snippet,statistics,contentDetails',
            chart: 'mostPopular',
            regionCode: 'KR',
            maxResults: '25', /* API홈화면수량설정 */
            key: apiKey
        });
        
        const url = `${baseUrl}?${params.toString()}`;
        console.log('📡 API 요청 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 403) {
                    const errorData = await response.json().catch(() => ({}));
                    if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
                        throw new Error('YouTube API 할당량이 초과되었습니다. 내일 다시 시도해주세요.');
                    } else if (errorData.error?.errors?.[0]?.reason === 'keyInvalid') {
                        throw new Error('YouTube API 키가 유효하지 않습니다. API 키를 확인해주세요.');
                    } else {
                        throw new Error('YouTube API 액세스가 거부되었습니다. API 키 권한을 확인해주세요.');
                    }
                } else if (response.status === 400) {
                    throw new Error('YouTube API 요청이 잘못되었습니다. API 키를 확인해주세요.');
                } else {
                    throw new Error(`YouTube API 오류: ${response.status} ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            console.log('✅ YouTube API 응답 수신:', data.items?.length || 0, '개 동영상');
            
            if (!data.items || data.items.length === 0) {
                throw new Error('YouTube API에서 동영상 데이터를 찾을 수 없습니다.');
            }
            
            // 🎯 25개로 제한 (혹시 API가 더 많이 반환할 경우 대비)
            const limitedItems = data.items.slice(0, 25);
            console.log(`🔢 API 결과 제한: ${data.items.length}개 → ${limitedItems.length}개`);

            return limitedItems.map(item => ({
                id: item.id,
                snippet: item.snippet,
                statistics: item.statistics,
                contentDetails: item.contentDetails,
                isOffline: false
            }));
            
        } catch (error) {
            console.error('❌ YouTube API 직접 호출 실패:', error);
            throw error;
        }
    }

    /**
     * 📸 20개 실제 사진 기반 가상 동영상 생성
     */
    _create20RealPhotoVideos() {
        if (this._cachedMockVideos) {
            console.log('📦 캐시된 25개 실제 사진 동영상 사용');
            return this._cachedMockVideos;
        }

        console.log('📸 25개 실제 사진 기반 가상 동영상 생성 시작');
        
        const videoData = [
            { id: 'mock-01', title: '🌲 멋진 자연 풍경 - 4K 타임랩스', channel: '네이처채널', views: '125K 조회수', published: '1일 전', duration: '10:30', emoji: '🌲', color: '#27ae60' },
            { id: 'mock-02', title: '🎮 신나는 게임 리뷰 - 최신 AAA 게임', channel: '게임리뷰어', views: '234K 조회수', published: '2일 전', duration: '15:42', emoji: '🎮', color: '#3498db' },
            { id: 'mock-03', title: '🍳 5분 요리 레시피 - 간단한 파스타', channel: '쿠킹마스터', views: '356K 조회수', published: '3일 전', duration: '5:18', emoji: '🍳', color: '#e74c3c' },
            { id: 'mock-04', title: '🌃 도시의 야경 타임랩스 - 서울 스카이라인', channel: '시티라이프', views: '478K 조회수', published: '4일 전', duration: '8:25', emoji: '🌃', color: '#f39c12' },
            { id: 'mock-05', title: '🎒 즐거운 배낭 여행기 - 유럽 한 달 여행', channel: '트래블러', views: '567K 조회수', published: '5일 전', duration: '22:15', emoji: '🎒', color: '#9b59b6' },
            { id: 'mock-06', title: '💻 개발자 브이로그 - 코딩 루틴 공개', channel: '코딩라이프', views: '689K 조회수', published: '6일 전', duration: '18:33', emoji: '💻', color: '#1abc9c' },
            { id: 'mock-07', title: '🐕 반려동물 키우기 팁 - 강아지 훈련법', channel: '펫케어', views: '792K 조회수', published: '1주일 전', duration: '12:47', emoji: '🐕', color: '#e67e22' },
            { id: 'mock-08', title: '🏠 홈 인테리어 아이디어 - 작은 공간 활용법', channel: '홈데코', views: '834K 조회수', published: '1주일 전', duration: '16:52', emoji: '🏠', color: '#34495e' },
            { id: 'mock-09', title: '💪 운동 루틴 가이드 - 홈트레이닝 완전정복', channel: '피트니스코치', views: '945K 조회수', published: '2주일 전', duration: '25:11', emoji: '💪', color: '#e91e63' },
            { id: 'mock-10', title: '🎵 음악 제작 과정 - 비트 메이킹 튜토리얼', channel: '뮤직프로듀서', views: '1.2M 조회수', published: '2주일 전', duration: '31:28', emoji: '🎵', color: '#607d8b' },
            { id: 'mock-11', title: '📚 독서 습관 만들기 - 한 달에 10권 읽는 법', channel: '북리버', views: '423K 조회수', published: '3주일 전', duration: '14:22', emoji: '📚', color: '#8e44ad' },
            { id: 'mock-12', title: '🎨 디지털 아트 튜토리얼 - 프로크리에이트 사용법', channel: '아트스튜디오', views: '612K 조회수', published: '3주일 전', duration: '28:45', emoji: '🎨', color: '#ff6b6b' },
            { id: 'mock-13', title: '☕ 홈카페 마스터 - 완벽한 라떼 만들기', channel: '커피마니아', views: '738K 조회수', published: '4주일 전', duration: '11:15', emoji: '☕', color: '#d4a574' },
            { id: 'mock-14', title: '🚗 자동차 리뷰 - 2024 신형 전기차 비교', channel: '카리뷰어', views: '891K 조회수', published: '1개월 전', duration: '19:33', emoji: '🚗', color: '#3d3d3d' },
            { id: 'mock-15', title: '🎬 영화 리뷰 - 올해 최고의 액션 영화 TOP 10', channel: '무비크리틱', views: '1.5M 조회수', published: '1개월 전', duration: '24:18', emoji: '🎬', color: '#2c3e50' },
            { id: 'mock-16', title: '🌍 세계 여행 가이드 - 동남아시아 배낭여행 코스', channel: '글로벌트래블', views: '657K 조회수', published: '1개월 전', duration: '32:07', emoji: '🌍', color: '#16a085' },
            { id: 'mock-17', title: '💰 주식 투자 기초 - 초보자를 위한 완벽 가이드', channel: '머니마스터', views: '923K 조회수', published: '1개월 전', duration: '41:25', emoji: '💰', color: '#f39c12' },
            { id: 'mock-18', title: '🧘 명상과 요가 - 스트레스 해소를 위한 10분 루틴', channel: '마인드풀니스', views: '445K 조회수', published: '1개월 전', duration: '12:33', emoji: '🧘', color: '#9b59b6' },
            { id: 'mock-19', title: '🎯 비즈니스 성공 전략 - 스타트업 창업 가이드', channel: '비즈니스멘토', views: '778K 조회수', published: '2개월 전', duration: '35:42', emoji: '🎯', color: '#e74c3c' },
            { id: 'mock-20', title: '🔬 과학 실험 - 집에서 할 수 있는 신기한 실험 10가지', channel: '사이언스랩', views: '1.1M 조회수', published: '2개월 전', duration: '26:55', emoji: '🔬', color: '#34495e' },
            { id: 'mock-21', title: '🎸 기타 연주 입문 - 첫 곡 연주까지 완주하기', channel: '뮤직스쿨', views: '542K 조회수', published: '2개월 전', duration: '18:22', emoji: '🎸', color: '#8e44ad' },
            { id: 'mock-22', title: '🌺 플라워 아레인지먼트 - 봄 꽃다발 만들기', channel: '플라워디자인', views: '387K 조회수', published: '2개월 전', duration: '13:45', emoji: '🌺', color: '#e91e63' },
            { id: 'mock-23', title: '🧩 두뇌 트레이닝 - 논리 퍼즐 완전 정복', channel: '브레인게임', views: '623K 조회수', published: '3개월 전', duration: '21:33', emoji: '🧩', color: '#ff9800' },
            { id: 'mock-24', title: '🚀 우주 탐험 다큐 - 화성 이주 프로젝트', channel: '스페이스채널', views: '892K 조회수', published: '3개월 전', duration: '45:18', emoji: '🚀', color: '#2196f3' },
            { id: 'mock-25', title: '🍰 홈베이킹 마스터 - 생크림 케이크 만들기', channel: '베이킹스튜디오', views: '756K 조회수', published: '3개월 전', duration: '29:42', emoji: '🍰', color: '#ffb74d' }
        ];

        // 시간 기반 시드 생성 (30분마다 변경)
        const timeSeed = Math.floor(Date.now() / (1000 * 60 * 30));

        this._cachedMockVideos = videoData.map((video, index) => {
            const seed = timeSeed + index * 31; // 고유한 시드
            
            return {
                ...video,
                // 📸 실제 Picsum 사진 URL
                thumbnail: `https://picsum.photos/560/314?random=${seed}`,
                thumbnailFallback: `https://picsum.photos/560/314?random=${seed + 100}`,
                isOffline: true,
                videoNumber: index + 1
            };
        });

        // 🎯 25개로 제한 (20개 데이터를 25개로 확장하거나 제한)
        const limitedMockVideos = this._cachedMockVideos.slice(0, 25);
        console.log(`✅ 실제 사진 기반 가상 동영상 생성 완료: ${limitedMockVideos.length}개`);
        return limitedMockVideos;
    }

    /**
     * 홈 화면에 비디오 그리드를 표시합니다.
     */
    displayHomeVideos(videos) {
        if (!this.homeVideoGrid) {
            console.warn('⚠️ homeVideoGrid 요소가 존재하지 않습니다.');
            return;
        }

        if (!videos || videos.length === 0) {
            this.homeVideoGrid.innerHTML = '<p class="no-results-message">표시할 동영상이 없습니다.</p>';
            return;
        }

        console.log(`📸 ${videos.length}개 동영상 렌더링 시작`);

        const videosHtml = videos.map((video, index) => {
            const title = video.snippet?.title || video.title;
            const channel = video.snippet?.channelTitle || video.channel;
            const duration = video.duration || this._extractDurationFromContentDetails(video.contentDetails);
            const views = this._formatViewsFromStatistics(video.statistics) || video.views;
            const published = this._formatPublishedDate(video.snippet?.publishedAt) || video.published;

            if (video.isOffline) {
                // 📸 즉시 실제 사진 표시
                return `
                    <div class="video-card" 
                         data-video-id="${video.id}" 
                         data-type="home-video" 
                         onclick="window.youtubeApp.videoDisplay._openYouTubeVideo('${video.id}')">
                        <div class="thumbnail-container" style="position: relative;">
                            <img src="${video.thumbnail}" 
                                 alt="${title}" 
                                 class="thumbnail"
                                 style="width: 100%; height: 157px; object-fit: cover; border-radius: 8px;"
                                 loading="lazy"
                                 onerror="this.src = '${video.thumbnailFallback}'; this.onerror = null;">
                            
                            <span class="video-duration" 
                                  style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; z-index: 10;">
                                ${duration}
                            </span>
                        </div>
                        <div class="video-info">
                            <div class="video-title" title="${title}">${Formatters.truncateText(title, 60)}</div>
                            <div class="video-channel" title="${channel}">${channel}</div>
                            <div class="video-meta">
                                <span>${views}</span>
                                <span>• ${published}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // 실제 YouTube API 데이터
                const thumbnail = video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || '';
                return `
                    <div class="video-card" 
                         data-video-id="${video.id}" 
                         data-type="home-video" 
                         onclick="window.youtubeApp.videoDisplay._openYouTubeVideo('${video.id}')">
                        <div class="thumbnail-container" style="position: relative;">
                            <img src="${thumbnail}" 
                                 alt="${title}" 
                                 class="thumbnail"
                                 style="width: 100%; height: 157px; object-fit: cover; border-radius: 8px; opacity: 0; transition: opacity 0.3s ease;"
                                 loading="lazy"
                                 onload="this.style.opacity = '1';"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="thumbnail-fallback" 
                                 style="display: none; width: 100%; height: 157px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border-radius: 8px; position: absolute; top: 0; left: 0;">
                                <div style="text-align: center;">
                                    <div style="font-size: 32px; margin-bottom: 8px;">▶</div>
                                    <div>YouTube Video</div>
                                </div>
                            </div>
                            <span class="video-duration" 
                                  style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                                ${duration}
                            </span>
                        </div>
                        <div class="video-info">
                            <div class="video-title" title="${title}">${Formatters.truncateText(title, 60)}</div>
                            <div class="video-channel" title="${channel}">${channel}</div>
                            <div class="video-meta">
                                <span>${views}</span>
                                <span>• ${published}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        this.homeVideoGrid.innerHTML = videosHtml;
        
        requestAnimationFrame(() => {
            this.updateResponsiveGrid();
            console.log('✅ 동영상 그리드 렌더링 완료');
        });
    }

    /**
     * 검색 결과 테이블에 비디오를 표시합니다.
     * @param {Array} videos - 표시할 비디오 배열
     * @param {string} searchType - 검색 타입 ('single' 또는 'multi')
     */
    displaySearchResults(videos, searchType = 'single') {
        if (!this.resultsTableBody) {
            console.warn('resultsTableBody 요소가 존재하지 않습니다.');
            return;
        }

        if (videos.length === 0) {
            // 검색 타입에 따라 다른 메시지 표시
            const noResultsMessage = searchType === 'multi' ? 
                '레전드 검색 결과가 없습니다.' : 
                '검색 결과가 없습니다.';
                
            this.resultsTableBody.innerHTML = `<tr><td colspan="13" class="no-results-message">${noResultsMessage}</td></tr>`;
            this.uiManager.updateResultsCount(0);
            return;
        }

        const rowsHtml = videos.map(video => this._createTableRowHtml(video)).join('');
        this.resultsTableBody.innerHTML = rowsHtml;
        this.dataManager.clearSelectedVideos();
        this._attachCheckboxListeners();
        this.uiManager.updateResultsCount(videos.length);
    }

    /**
     * 검색 결과 테이블 행 HTML을 생성합니다.
     */
    _createTableRowHtml(video) {
        const videoId = video.id;
        const snippet = video.snippet || {};
        const statistics = video.statistics || {};
        const contentDetails = video.contentDetails || {};
        const channelSnippet = video.channelSnippet || {};
        const channelStatistics = video.channelStatistics || {};
        const isSelected = this.dataManager.selectedVideos.has(videoId) ? 'checked' : '';
        
        // 썸네일 URL
        let thumbnailUrl;
        if (video.isOffline) {
            thumbnailUrl = this._createSmallSVG(video.color || '#667eea', video.emoji || '📺', video.videoNumber || 1);
        } else {
            thumbnailUrl = snippet.thumbnails?.default?.url || this._createSmallSVG('#cccccc', '📺', 1);
        }
        
        const videoTitle = this._escapeHtml(snippet.title || video.title || '제목 없음');
        const videoUploadDate = snippet.publishedAt ? Formatters.formatDateTime(snippet.publishedAt) : video.published || '날짜 미상';
        const viewCount = Formatters.formatNumber(statistics.viewCount || 0) || video.views || '0';
        // 레전드 점수 (떡상률 대신)
        const legendScore = typeof video.legendScore === 'number' ? 
            Formatters.formatNumber(video.legendScore) : '0';
        const legendTier = video.legendTier || '일반';
        const likeCount = Formatters.formatNumber(statistics.likeCount || 0) || '0';
        const commentCount = Formatters.formatNumber(statistics.commentCount || 0) || '0';
        const videoDuration = contentDetails.duration ? Formatters.formatDuration(contentDetails.duration) : video.duration || 'N/A';
        const channelTitle = this._escapeHtml(snippet.channelTitle || video.channel || '알 수 없는 채널');
        const subscriberCount = Formatters.formatNumber(channelStatistics.subscriberCount || 0) || '0';
        const channelAccelerationRate = (typeof video.rawChannelAccelerationRate === 'number' && !isNaN(video.rawChannelAccelerationRate))
            ? video.rawChannelAccelerationRate.toFixed(2)
            : 'N/A';
        
        // 키워드 필드 추가
        const keyword = video.keyword || '';

        // ✅ <br> 제거 - CSS 자동 줄바꿈 사용
        const uploadDateFormatted = videoUploadDate;
        
        return `
            <tr data-video-id="${videoId}" data-type="search-result">
            <td><input type="checkbox" class="video-checkbox" data-video-id="${videoId}" ${isSelected}></td>
            <td><img src="${thumbnailUrl}" alt="Thumbnail" class="video-thumbnail-small" onclick="window.youtubeApp.modalComponents.openVideoDetailModal('${videoId}')"></td>
            <td class="video-title-cell" title="${videoTitle}"><a href="#" onclick="event.preventDefault(); window.youtubeApp.videoDisplay._openYouTubeVideo('${videoId}')">${Formatters.truncateText(videoTitle, 50)}</a></td>
            <td>${uploadDateFormatted}</td>
            <td>${viewCount}</td>
            <td title="${legendTier}">${legendScore}</td>
            <td>${likeCount}</td>
            <td>${commentCount}</td>
            <td>${videoDuration}</td>
            <td title="${channelTitle}"><a href="https://www.youtube.com/channel/${snippet.channelId}" target="_blank" rel="noopener noreferrer">${Formatters.truncateText(channelTitle, 30)}</a></td>
            <td>${subscriberCount}</td>
            <td>${channelAccelerationRate}</td>
            <td>${keyword}</td>
        </tr>
        `;
    }

    /**
     * 테이블용 작은 SVG 생성
     */
    _createSmallSVG(color, emoji, number) {
        const uniqueId = `small_${number}_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`;
        
        const svg = `
            <svg width="60" height="45" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${color};stop-opacity:0.9" />
                        <stop offset="100%" style="stop-color:${color};stop-opacity:0.6" />
                    </linearGradient>
                </defs>
                <rect width="60" height="45" fill="url(#${uniqueId})" rx="4" ry="4" />
                <circle cx="30" cy="22" r="12" fill="rgba(255,255,255,0.3)"/>
                <polygon points="26,18 26,26 34,22" fill="white"/>
                <text x="30" y="12" font-family="Arial,sans-serif" font-size="8" fill="white" text-anchor="middle">${emoji}</text>
            </svg>
        `;
        
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    }

    /**
     * 유틸리티 메서드들
     */
    _extractDurationFromContentDetails(contentDetails) {
        if (!contentDetails?.duration) return 'N/A';
        return Formatters.formatDuration(contentDetails.duration);
    }

    _formatViewsFromStatistics(statistics) {
        if (!statistics?.viewCount) return null;
        return Formatters.formatNumber(statistics.viewCount) + ' 조회수';
    }

    _formatPublishedDate(publishedAt) {
        if (!publishedAt) return null;
        return Formatters.formatRelativeTime(publishedAt);
    }

    _openYouTubeVideo(videoId) {
        if (videoId.startsWith('mock-')) {
            this.uiManager.showNotification('데모용 가상 동영상은 YouTube에서 열 수 없습니다.', 'info');
            return;
        }
        DomUtils.openVideo(videoId);
    }

    _attachCheckboxListeners() {
        if (this.resultsTableBody) {
            DomUtils.querySelectorAll('.video-checkbox', this.resultsTableBody).forEach(checkbox => {
                checkbox.onchange = (event) => {
                    const videoId = event.target.dataset.videoId;
                    if (event.target.checked) {
                        this.dataManager.addSelectedVideo(videoId);
                    } else {
                        this.dataManager.removeSelectedVideo(videoId);
                    }
                    this.uiManager.updateResultActionsButtons(this.dataManager.selectedVideos.size > 0);
                    // 분석 버튼 상태도 업데이트
                    this.uiManager.updateAnalysisButtonStates();
                    // AI 분석 버튼 상태도 업데이트
                    this.uiManager.updateAiAnalyzeButtonState();
                };
            });
            
            const selectAllCheckbox = DomUtils.getElementById('select-all-checkbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = this.dataManager.currentVideos.length > 0 && 
                                            this.dataManager.selectedVideos.size === this.dataManager.currentVideos.length;
                
                // 전체 선택/해제 이벤트 리스너 추가
                selectAllCheckbox.onchange = (event) => {
                    const isChecked = event.target.checked;
                    const checkboxes = this.resultsTableBody.querySelectorAll('.video-checkbox');
                    
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = isChecked;
                        const videoId = checkbox.dataset.videoId;
                        
                        if (isChecked) {
                            this.dataManager.addSelectedVideo(videoId);
                        } else {
                            this.dataManager.removeSelectedVideo(videoId);
                        }
                    });
                    
                    this.uiManager.updateResultActionsButtons(this.dataManager.selectedVideos.size > 0);
                    this.uiManager.updateAnalysisButtonStates();
                    // AI 분석 버튼 상태도 업데이트
                    this.uiManager.updateAiAnalyzeButtonState();
                };
            }
        }
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateResponsiveGrid() {
        if (!this.homeVideoGrid) return;

        const containerWidth = this.homeVideoGrid.clientWidth || 1200;
        const cardMinWidth = 280;
        const gap = 20;
        const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
        
        this.homeVideoGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    }
}

export default VideoDisplay;