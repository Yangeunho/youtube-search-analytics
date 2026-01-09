/**
 * @fileoverview 데이터 내보내기 기능을 제공합니다.
 * Excel, JSON 형태로 검색 결과를 내보낼 수 있습니다.
 */

import Formatters from '../utils/formatters.js';
import YouTubeCalculations from '../utils/calculations.js';

class DataExport {
    /**
     * DataExport 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스.
     * @param {object} dependencies.uiManager - UI 관리자 인스턴스.
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;
        
        // SheetJS 라이브러리 로드 확인
        this.isSheetJSLoaded = typeof XLSX !== 'undefined';
        if (!this.isSheetJSLoaded) {
            console.warn('SheetJS 라이브러리가 로드되지 않았습니다. Excel 내보내기가 작동하지 않을 수 있습니다.');
        }
    }

    /**
     * 검색 결과를 Excel 형태로 내보냅니다.
     * @param {Array} videos - 내보낼 비디오 배열 (기본값: 현재 비디오).
     * @param {string} filename - 파일명 (기본값: youtube_results.xlsx).
     */
    exportToExcel(videos = null, filename = 'youtube_results.xlsx') {
        try {
            if (!this.isSheetJSLoaded) {
                this.uiManager.showNotification('Excel 내보내기를 위해 SheetJS 라이브러리가 필요합니다.', 'error');
                return;
            }

            // 선택된 비디오 가져오기
            const selectedVideos = [];
            if (this.dataManager.selectedVideos && this.dataManager.selectedVideos.size > 0) {
                this.dataManager.currentVideos.forEach(video => {
                    if (this.dataManager.selectedVideos.has(video.id)) {
                        selectedVideos.push(video);
                    }
                });
            }
            
            // 선택 검증
            if (selectedVideos.length === 0) {
                this.uiManager.showNotification('동영상을 선택하세요.', 'warning');
                return;
            }
            
            const videosToExport = selectedVideos;

            // Excel 데이터 생성 - 요청된 순서대로
            const excelData = videosToExport.map((video, index) => {
                const snippet = video.snippet || {};
                const statistics = video.statistics || {};
                const contentDetails = video.contentDetails || {};
                const channelSnippet = video.channelSnippet || {};
                const channelStatistics = video.channelStatistics || {};

                // 🔧 떡상률/확산률 계산 로직 추가 (백업 계산)
                // 이미 계산된 값이 있으면 사용하고, 없으면 클라이언트에서 계산
                let videoAccelerationRate = 0;
                let channelAccelerationRate = 0;
                
                if (video.rawVideoAccelerationRate !== undefined) {
                    // 이미 계산된 값 사용 (새로운 프론트엔드 방식 또는 기존 백엔드 방식)
                    videoAccelerationRate = video.rawVideoAccelerationRate;
                } else {
                    // 계산된 값이 없는 경우 클라이언트에서 계산 (안전장치)
                    videoAccelerationRate = YouTubeCalculations.calculateDailyRate(
                        snippet.publishedAt,
                        statistics.viewCount,
                        channelStatistics.subscriberCount
                    );
                }
                
                if (video.rawChannelAccelerationRate !== undefined) {
                    // 이미 계산된 값 사용
                    channelAccelerationRate = video.rawChannelAccelerationRate;
                } else {
                    // 계산된 값이 없는 경우 클라이언트에서 계산 (안전장치)
                    channelAccelerationRate = YouTubeCalculations.calculateGrowthRatio(
                        statistics.viewCount,
                        channelStatistics.subscriberCount
                    );
                }

                // 썸네일 URL 추출 (가장 높은 품질)
                const thumbnails = snippet.thumbnails || {};
                let thumbnailUrl = '';
                if (thumbnails.maxres) {
                    thumbnailUrl = thumbnails.maxres.url;
                } else if (thumbnails.high) {
                    thumbnailUrl = thumbnails.high.url;
                } else if (thumbnails.medium) {
                    thumbnailUrl = thumbnails.medium.url;
                } else if (thumbnails.default) {
                    thumbnailUrl = thumbnails.default.url;
                }

                return {
                    '썸네일주소': thumbnailUrl,
                    '제목': snippet.title || '',
                    '게시일': Formatters.formatDateTime(snippet.publishedAt),
                    '조회수': parseInt(statistics.viewCount || 0),
                    '레전드점수': video.legendScore ? video.legendScore.toFixed(2) : videoAccelerationRate.toFixed(2),  // 🎯 레전드점수 사용 (fallback: 계산된 값)
                    '좋아요': parseInt(statistics.likeCount || 0),
                    '댓글수': parseInt(statistics.commentCount || 0),
                    '영상길이': Formatters.formatDuration(contentDetails.duration),
                    '채널명': snippet.channelTitle || '',
                    '구독자수': parseInt(channelStatistics.subscriberCount || 0),
                    '영상확산률': channelAccelerationRate.toFixed(2),  // 🔧 계산된 값 사용
                    '키워드': video.keyword || '',  // 🎯 키워드 컬럼 추가
                    '동영상주소': `https://www.youtube.com/watch?v=${video.id || ''}`
                };
            });

            // 워크북 생성
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // 컬럼 너비 설정 (13개 컬럼)
            const colWidths = [
                { wch: 60 }, // 썸네일주소
                { wch: 50 }, // 제목
                { wch: 20 }, // 게시일
                { wch: 15 }, // 조회수
                { wch: 15 }, // 레전드점수 (기존: 영상떡상률)
                { wch: 12 }, // 좋아요
                { wch: 12 }, // 댓글수
                { wch: 12 }, // 영상길이
                { wch: 20 }, // 채널명
                { wch: 15 }, // 구독자수
                { wch: 15 }, // 영상확산률
                { wch: 20 }, // 키워드 (신규 추가)
                { wch: 60 }  // 동영상주소
            ];
            ws['!cols'] = colWidths;

            // 워크시트를 워크북에 추가
            XLSX.utils.book_append_sheet(wb, ws, "YouTube 검색결과");

            // Excel 파일 다운로드
            XLSX.writeFile(wb, filename);
            
            this.uiManager.showNotification(`${videosToExport.length}개 항목이 Excel로 내보내졌습니다.`, 'success');

        } catch (error) {
            console.error('Excel 내보내기 오류:', error);
            this.uiManager.showNotification('Excel 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 🎯 공통 JSON 데이터 생성 함수 (AI 분석과 JSON 내보내기 공용)
     * @param {Array} selectedVideos - 선택된 비디오 배열
     * @returns {Array} 생성된 JSON 데이터 배열
     */
    generateJsonData(selectedVideos) {
        try {

            // JSON 데이터 생성 - AI 분석용 확장 데이터 포함
            const jsonData = selectedVideos.map((video, index) => {
                const snippet = video.snippet || {};
                const statistics = video.statistics || {};
                const contentDetails = video.contentDetails || {};
                const channelSnippet = video.channelSnippet || {};
                const channelStatistics = video.channelStatistics || {};

                // 🔧 떡상률/확산률 계산 로직 추가 (Excel과 동일)
                let videoAccelerationRate = 0;
                let channelAccelerationRate = 0;
                
                if (video.rawVideoAccelerationRate !== undefined) {
                    videoAccelerationRate = video.rawVideoAccelerationRate;
                } else {
                    videoAccelerationRate = YouTubeCalculations.calculateDailyRate(
                        snippet.publishedAt,
                        statistics.viewCount,
                        channelStatistics.subscriberCount
                    );
                }
                
                if (video.rawChannelAccelerationRate !== undefined) {
                    channelAccelerationRate = video.rawChannelAccelerationRate;
                } else {
                    channelAccelerationRate = YouTubeCalculations.calculateGrowthRatio(
                        statistics.viewCount,
                        channelStatistics.subscriberCount
                    );
                }

                // 썸네일 URL 추출 (가장 높은 품질)
                const thumbnails = snippet.thumbnails || {};
                let thumbnailUrl = '';
                if (thumbnails.maxres) {
                    thumbnailUrl = thumbnails.maxres.url;
                } else if (thumbnails.high) {
                    thumbnailUrl = thumbnails.high.url;
                } else if (thumbnails.medium) {
                    thumbnailUrl = thumbnails.medium.url;
                } else if (thumbnails.default) {
                    thumbnailUrl = thumbnails.default.url;
                }

                // AI 분석용 추가 지표 계산
                const viewCount = parseInt(statistics.viewCount || 0);
                const likeCount = parseInt(statistics.likeCount || 0);
                const commentCount = parseInt(statistics.commentCount || 0);
                const subscriberCount = parseInt(channelStatistics.subscriberCount || 0);
                const channelVideoCount = parseInt(channelStatistics.videoCount || 0);
                const channelViewCount = parseInt(channelStatistics.viewCount || 0);
                
                // 참여율 지표 계산
                const engagementRate = viewCount > 0 ? ((likeCount + commentCount) / viewCount * 100).toFixed(4) : '0.0000';
                const likeRate = viewCount > 0 ? (likeCount / viewCount * 100).toFixed(4) : '0.0000';
                const commentRate = viewCount > 0 ? (commentCount / viewCount * 100).toFixed(4) : '0.0000';
                
                // 채널 성장 지표 계산
                const subscriberGrowthPotential = subscriberCount > 0 ? (viewCount / subscriberCount).toFixed(2) : '0.00';
                const channelPerformanceRatio = channelVideoCount > 0 ? (channelViewCount / channelVideoCount).toFixed(2) : '0.00';
                const videoPerformanceIndex = channelViewCount > 0 && channelVideoCount > 0 ? (viewCount / (channelViewCount / channelVideoCount) * 100).toFixed(2) : '0.00';
                
                // 바이럴 점수 계산
                const viralityScore = (parseFloat(videoAccelerationRate) * parseFloat(channelAccelerationRate)).toFixed(4);
                const popularityIndex = Math.log10(viewCount + 1).toFixed(2);
                
                // 영상 길이 분석
                const durationSeconds = YouTubeCalculations.parseDurationToSeconds(contentDetails.duration || '');
                const durationCategory = durationSeconds < 60 ? 'short' : 
                                       durationSeconds < 240 ? 'medium' : 
                                       durationSeconds < 1200 ? 'long' : 'very_long';
                
                // 업로드 시점 분석
                const publishDate = new Date(snippet.publishedAt);
                const daysSincePublish = Math.floor((Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
                const publishDayOfWeek = publishDate.toLocaleDateString('ko-KR', { weekday: 'long' });
                const publishHour = publishDate.getHours();
                const publishTimeCategory = publishHour < 6 ? 'dawn' :
                                          publishHour < 12 ? 'morning' :
                                          publishHour < 18 ? 'afternoon' : 'evening';

                return {
                    // 기본 정보 (Excel과 동일 - 13개 컬럼)
                    썸네일주소: thumbnailUrl,
                    제목: snippet.title || '',
                    게시일: Formatters.formatDateTime(snippet.publishedAt),
                    조회수: viewCount,
                    레전드점수: video.legendScore ? video.legendScore.toFixed(2) : videoAccelerationRate.toFixed(2),  // 🎯 레전드점수 사용 (fallback: 계산된 값)
                    좋아요: likeCount,
                    댓글수: commentCount,
                    영상길이: Formatters.formatDuration(contentDetails.duration),
                    채널명: snippet.channelTitle || '',
                    구독자수: subscriberCount,
                    영상확산률: channelAccelerationRate.toFixed(2),
                    키워드: video.keyword || '',  // 🎯 키워드 컬럼 추가
                    동영상주소: `https://www.youtube.com/watch?v=${video.id || ''}`,
                    
                    // 🤖 AI 분석용 확장 데이터
                    aiAnalysisData: {
                        // 기본 메타데이터
                        metadata: {
                            videoId: video.id || '',
                            channelId: snippet.channelId || '',
                            categoryId: snippet.categoryId || '',
                            defaultLanguage: snippet.defaultLanguage || '',
                            tags: snippet.tags || [],
                            description: snippet.description || ''
                        },
                        
                        // 토픽 정보
                        topicInfo: {
                            categories: video.topicDetails?.topicCategories || [],
                            topicIds: video.topicDetails?.topicIds || [],
                            relevantTopics: video.topicDetails?.relevantTopicIds || []
                        },
                        
                        // 참여율 지표
                        engagementMetrics: {
                            totalEngagementRate: parseFloat(engagementRate),      // 총 참여율 (%)
                            likeRate: parseFloat(likeRate),                       // 좋아요율 (%)
                            commentRate: parseFloat(commentRate),                 // 댓글율 (%)
                            likeToCommentRatio: commentCount > 0 ? (likeCount / commentCount).toFixed(2) : '0.00',
                            engagementVelocity: daysSincePublish > 0 ? ((likeCount + commentCount) / daysSincePublish).toFixed(2) : '0.00'
                        },
                        
                        // 바이럴 점수
                        viralityMetrics: {
                            viralityScore: parseFloat(viralityScore),             // 바이럴 점수
                            popularityIndex: parseFloat(popularityIndex),         // 인기도 지수 (log scale)
                            momentumScore: (parseFloat(videoAccelerationRate) * parseFloat(engagementRate)).toFixed(4),
                            trendingPotential: viewCount > 0 && daysSincePublish > 0 ? (viewCount / daysSincePublish).toFixed(2) : '0.00'
                        },
                        
                        // 채널 성장 지표
                        channelGrowthMetrics: {
                            subscriberGrowthPotential: parseFloat(subscriberGrowthPotential),
                            channelVideoCount: channelVideoCount,
                            channelTotalViews: channelViewCount,
                            channelAverageViews: parseFloat(channelPerformanceRatio),
                            videoPerformanceIndex: parseFloat(videoPerformanceIndex),    // 채널 평균 대비 성과
                            channelInfluenceScore: subscriberCount > 0 ? Math.log10(subscriberCount + 1).toFixed(2) : '0.00'
                        },
                        
                        // 콘텐츠 분석
                        contentAnalysis: {
                            durationSeconds: durationSeconds,
                            durationCategory: durationCategory,
                            titleLength: snippet.title ? snippet.title.length : 0,
                            descriptionLength: snippet.description ? snippet.description.length : 0,
                            tagCount: snippet.tags ? snippet.tags.length : 0,
                            hasCustomThumbnail: thumbnails.maxres || thumbnails.high ? true : false,
                            languageDetected: snippet.defaultLanguage || 'unknown'
                        },
                        
                        // 시간적 분석
                        temporalAnalysis: {
                            daysSincePublish: daysSincePublish,
                            publishDayOfWeek: publishDayOfWeek,
                            publishHour: publishHour,
                            publishTimeCategory: publishTimeCategory,
                            publishTimestamp: publishDate.toISOString(),
                            isRecentUpload: daysSincePublish <= 7,
                            viewsPerDay: daysSincePublish > 0 ? (viewCount / daysSincePublish).toFixed(2) : '0.00'
                        },
                        
                        // 기술적 정보
                        technicalInfo: {
                            definition: contentDetails.definition || 'unknown',
                            caption: contentDetails.caption || 'unknown',
                            licensedContent: contentDetails.licensedContent || false,
                            projection: contentDetails.projection || 'rectangular',
                            uploadStatus: video.status?.uploadStatus || 'unknown',
                            privacyStatus: video.status?.privacyStatus || 'unknown',
                            embeddable: video.status?.embeddable !== false,
                            publicStatsViewable: video.status?.publicStatsViewable !== false
                        },
                        
                        // 🎯 레전드 헌팅 시스템 지표
                        legendHuntingMetrics: {
                            legendScore: video.legendScore || 0,  // 레전드 점수
                            legendTier: video.legendTier || '일반',  // 레전드 티어 (슈퍼레전드/레전드/준레전드/일반)
                            isLegendEligible: video.isLegendEligible || false,  // 레전드 자격 여부 (다중검색 필터링용)
                            subscriberWeight: video.subscriberWeight || 1.0,  // 구독자 가중치
                            monthsElapsed: video.monthsElapsed || 0,  // 업로드 후 경과 개월 수
                            legendRank: video.legendRank || 0,  // 레전드 순위 (키워드 내)
                            keywordContext: video.keyword || '',  // 키워드 컨텍스트
                            multiSearchFiltered: video.multiSearchFiltered || false  // 다중검색 필터링 적용 여부
                        },
                        
                        // AI 분석 종합 점수 (레전드 점수 통합)
                        comprehensiveScores: {
                            overallPerformanceScore: ((parseFloat(viralityScore) * 0.25) + 
                                                     (parseFloat(engagementRate) * 0.2) + 
                                                     (parseFloat(subscriberGrowthPotential) * 0.2) + 
                                                     (parseFloat(videoPerformanceIndex) * 0.15) +
                                                     ((video.legendScore || 0) * 0.2)).toFixed(4),  // 🎯 레전드점수 20% 반영
                            contentQualityScore: (parseFloat(engagementRate) * 0.4 + 
                                                parseFloat(likeRate) * 0.6).toFixed(4),
                            growthPotentialScore: (parseFloat(subscriberGrowthPotential) * 0.4 + 
                                                 parseFloat(videoAccelerationRate) * 0.3 +
                                                 ((video.legendScore || 0) * 0.3)).toFixed(4),  // 🎯 레전드점수 30% 반영
                            viralPotentialScore: parseFloat(viralityScore),
                            channelHealthScore: subscriberCount > 0 && channelVideoCount > 0 ? 
                                              Math.min(((subscriberCount / channelVideoCount) * 0.01), 100).toFixed(4) : '0.0000',
                            legendPerformanceScore: (video.legendScore || 0)  // 🎯 순수 레전드 성과 점수
                        }
                    }
                };
            });

            return jsonData;

        } catch (error) {
            console.error('JSON 데이터 생성 오류:', error);
            return [];
        }
    }

    /**
     * 검색 결과를 JSON 형태로 내보냅니다. (Excel과 같은 순서)
     * @param {Array} videos - 내보낼 비디오 배열 (기본값: 현재 비디오).
     * @param {string} filename - 파일명 (기본값: youtube_results.json).
     */
    exportToJson(videos = null, filename = 'youtube_results.json') {
        try {
            // 선택된 비디오 가져오기
            const selectedVideos = [];
            if (this.dataManager.selectedVideos && this.dataManager.selectedVideos.size > 0) {
                this.dataManager.currentVideos.forEach(video => {
                    if (this.dataManager.selectedVideos.has(video.id)) {
                        selectedVideos.push(video);
                    }
                });
            }
            
            // 선택 검증
            if (selectedVideos.length === 0) {
                this.uiManager.showNotification('동영상을 선택하세요.', 'warning');
                return;
            }
            
            const videosToExport = selectedVideos;

            // 🎯 공통 JSON 데이터 생성 함수 사용
            const jsonData = this.generateJsonData(videosToExport);
            
            if (jsonData.length === 0) {
                this.uiManager.showNotification('JSON 데이터 생성에 실패했습니다.', 'error');
                return;
            }

            // 메타데이터 포함한 완전한 JSON
            const exportData = {
                exportInfo: {
                    timestamp: new Date().toISOString(),
                    totalItems: videosToExport.length,
                    exportedBy: 'YouTube 검색 도구',
                    version: '1.0'
                },
                searchFilters: this.dataManager.searchFilters,
                apiMode: this.dataManager.isApiMode,
                videos: jsonData
            };

            const jsonContent = JSON.stringify(exportData, null, 2);
            this.downloadFile(jsonContent, filename, 'application/json');
            
            this.uiManager.showNotification(`${videosToExport.length}개 항목이 JSON으로 내보내졌습니다.`, 'success');

        } catch (error) {
            console.error('JSON 내보내기 오류:', error);
            this.uiManager.showNotification('JSON 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 🎯 선택된 비디오들의 JSON 데이터를 생성하여 반환합니다. (AI 분석용)
     * @returns {Array} 선택된 비디오들의 JSON 데이터 배열
     */
    generateSelectedVideosJsonData() {
        try {
            // 선택된 비디오 가져오기
            const selectedVideos = [];
            if (this.dataManager.selectedVideos && this.dataManager.selectedVideos.size > 0) {
                this.dataManager.currentVideos.forEach(video => {
                    if (this.dataManager.selectedVideos.has(video.id)) {
                        selectedVideos.push(video);
                    }
                });
            }
            
            if (selectedVideos.length === 0) {
                console.warn('선택된 비디오가 없습니다.');
                return [];
            }
            
            // 🎯 공통 JSON 데이터 생성 함수 사용
            return this.generateJsonData(selectedVideos);
            
        } catch (error) {
            console.error('선택된 비디오 JSON 데이터 생성 오류:', error);
            return [];
        }
    }

    /**
     * 선택된 비디오만 내보냅니다.
     * @param {string} format - 내보낼 형식 ('excel', 'json').
     */
    exportSelectedVideos(format) {
        const selectedVideoIds = this.dataManager.getSelectedVideoIds();
        
        if (selectedVideoIds.size === 0) {
            this.uiManager.showNotification('선택된 비디오가 없습니다.', 'warning');
            return;
        }

        const selectedVideos = this.dataManager.currentVideos.filter(video => 
            selectedVideoIds.has(video.id)
        );

        const timestamp = new Date().toISOString().split('T')[0];
        
        switch (format) {
            case 'excel':
                const excelFilename = `youtube_selected_${timestamp}.xlsx`;
                this.exportToExcel(selectedVideos, excelFilename);
                break;
            case 'json':
                const jsonFilename = `youtube_selected_${timestamp}.json`;
                this.exportToJson(selectedVideos, jsonFilename);
                break;
            default:
                this.uiManager.showNotification('지원하지 않는 형식입니다.', 'error');
        }
    }

    /**
     * 검색 통계를 내보냅니다.
     * @param {string} filename - 파일명 (기본값: youtube_statistics.json).
     */
    exportStatistics(filename = 'youtube_statistics.json') {
        try {
            const videos = this.dataManager.currentVideos;
            
            if (videos.length === 0) {
                this.uiManager.showNotification('통계를 생성할 데이터가 없습니다.', 'warning');
                return;
            }

            const stats = this.calculateStatistics(videos);
            
            const statisticsData = {
                generatedAt: new Date().toISOString(),
                totalVideos: videos.length,
                searchFilters: this.dataManager.searchFilters,
                statistics: stats
            };

            const jsonContent = JSON.stringify(statisticsData, null, 2);
            this.downloadFile(jsonContent, filename, 'application/json');
            
            this.uiManager.showNotification('통계가 JSON으로 내보내졌습니다.', 'success');

        } catch (error) {
            console.error('통계 내보내기 오류:', error);
            this.uiManager.showNotification('통계 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 비디오 데이터에서 통계를 계산합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 계산된 통계 객체.
     */
    calculateStatistics(videos) {
        const validVideos = videos.filter(video => video.statistics);
        
        if (validVideos.length === 0) {
            return { error: '통계를 계산할 수 있는 데이터가 없습니다.' };
        }

        const viewCounts = validVideos.map(v => parseInt(v.statistics.viewCount || 0));
        const likeCounts = validVideos.map(v => parseInt(v.statistics.likeCount || 0));
        const commentCounts = validVideos.map(v => parseInt(v.statistics.commentCount || 0));
        const videoAccelerationRates = validVideos.map(v => v.rawVideoAccelerationRate || 0);
        const channelAccelerationRates = validVideos.map(v => v.rawChannelAccelerationRate || 0);

        return {
            viewCount: {
                total: viewCounts.reduce((sum, count) => sum + count, 0),
                average: Math.round(viewCounts.reduce((sum, count) => sum + count, 0) / viewCounts.length),
                median: this.calculateMedian(viewCounts),
                min: Math.min(...viewCounts),
                max: Math.max(...viewCounts)
            },
            likeCount: {
                total: likeCounts.reduce((sum, count) => sum + count, 0),
                average: Math.round(likeCounts.reduce((sum, count) => sum + count, 0) / likeCounts.length),
                median: this.calculateMedian(likeCounts),
                min: Math.min(...likeCounts),
                max: Math.max(...likeCounts)
            },
            commentCount: {
                total: commentCounts.reduce((sum, count) => sum + count, 0),
                average: Math.round(commentCounts.reduce((sum, count) => sum + count, 0) / commentCounts.length),
                median: this.calculateMedian(commentCounts),
                min: Math.min(...commentCounts),
                max: Math.max(...commentCounts)
            },
            videoAccelerationRate: {
                average: videoAccelerationRates.reduce((sum, rate) => sum + rate, 0) / videoAccelerationRates.length,
                median: this.calculateMedian(videoAccelerationRates),
                min: Math.min(...videoAccelerationRates),
                max: Math.max(...videoAccelerationRates)
            },
            channelAccelerationRate: {
                average: channelAccelerationRates.reduce((sum, rate) => sum + rate, 0) / channelAccelerationRates.length,
                median: this.calculateMedian(channelAccelerationRates),
                min: Math.min(...channelAccelerationRates),
                max: Math.max(...channelAccelerationRates)
            },
            channels: {
                uniqueChannels: new Set(validVideos.map(v => v.snippet.channelId)).size,
                topChannels: this.getTopChannels(validVideos, 5)
            }
        };
    }

    /**
     * 배열의 중간값을 계산합니다.
     * @param {Array} numbers - 숫자 배열.
     * @returns {number} 중간값.
     */
    calculateMedian(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
        }
        
        return sorted[middle];
    }

    /**
     * 상위 채널을 가져옵니다.
     * @param {Array} videos - 비디오 배열.
     * @param {number} limit - 가져올 채널 수.
     * @returns {Array} 상위 채널 배열.
     */
    getTopChannels(videos, limit = 5) {
        const channelStats = {};
        
        videos.forEach(video => {
            const channelId = video.snippet.channelId;
            const channelTitle = video.snippet.channelTitle;
            
            if (!channelStats[channelId]) {
                channelStats[channelId] = {
                    channelTitle,
                    videoCount: 0,
                    totalViews: 0
                };
            }
            
            channelStats[channelId].videoCount++;
            channelStats[channelId].totalViews += parseInt(video.statistics.viewCount || 0);
        });

        return Object.values(channelStats)
            .sort((a, b) => b.videoCount - a.videoCount)
            .slice(0, limit);
    }

    /**
     * 파일을 다운로드합니다.
     * @param {string} content - 파일 내용.
     * @param {string} filename - 파일명.
     * @param {string} mimeType - MIME 타입.
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 메모리 정리
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * 백업 데이터를 생성합니다.
     * @param {string} filename - 파일명 (기본값: youtube_backup.json).
     */
    createBackup(filename = 'youtube_backup.json') {
        try {
            const backupData = {
                backupInfo: {
                    timestamp: new Date().toISOString(),
                    version: '1.0',
                    type: 'full_backup'
                },
                appSettings: {
                    isApiMode: this.dataManager.isApiMode,
                    searchFilters: this.dataManager.searchFilters,
                    // API 키는 보안상 백업하지 않음
                },
                currentSession: {
                    currentVideos: this.dataManager.currentVideos,
                    selectedVideos: Array.from(this.dataManager.selectedVideos),
                    currentPage: this.dataManager.currentPage,
                    nextPageToken: this.dataManager.nextPageToken,
                    prevPageToken: this.dataManager.prevPageToken
                }
            };

            const jsonContent = JSON.stringify(backupData, null, 2);
            this.downloadFile(jsonContent, filename, 'application/json');
            
            this.uiManager.showNotification('백업이 생성되었습니다.', 'success');

        } catch (error) {
            console.error('백업 생성 오류:', error);
            this.uiManager.showNotification('백업 생성 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 데이터를 클립보드에 복사합니다.
     * @param {string} format - 복사할 형식 ('json').
     */
    async copyToClipboard(format) {
        try {
            const videos = this.dataManager.currentVideos;
            
            if (videos.length === 0) {
                this.uiManager.showNotification('복사할 데이터가 없습니다.', 'warning');
                return;
            }

            let content = '';

            switch (format) {
                case 'json':
                    content = JSON.stringify(videos, null, 2);
                    break;
                default:
                    throw new Error('지원하지 않는 형식입니다.');
            }

            await navigator.clipboard.writeText(content);
            this.uiManager.showNotification(`${format.toUpperCase()} 형식으로 클립보드에 복사되었습니다.`, 'success');

        } catch (error) {
            console.error('클립보드 복사 오류:', error);
            this.uiManager.showNotification('클립보드 복사 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 내보내기 옵션을 검증합니다.
     * @param {object} options - 내보내기 옵션.
     * @returns {boolean} 유효한 옵션인지 여부.
     */
    validateExportOptions(options) {
        const validFormats = ['excel', 'json'];
        
        if (options.format && !validFormats.includes(options.format)) {
            this.uiManager.showNotification('지원하지 않는 형식입니다.', 'error');
            return false;
        }

        if (options.maxItems && (options.maxItems < 1 || options.maxItems > 10000)) {
            this.uiManager.showNotification('항목 수는 1-10000 사이여야 합니다.', 'error');
            return false;
        }

        return true;
    }

    /**
     * 대용량 데이터를 청크 단위로 내보냅니다.
     * @param {Array} videos - 비디오 배열.
     * @param {string} format - 내보낼 형식.
     * @param {number} chunkSize - 청크 크기.
     */
    exportInChunks(videos, format, chunkSize = 1000) {
        const chunks = [];
        
        for (let i = 0; i < videos.length; i += chunkSize) {
            chunks.push(videos.slice(i, i + chunkSize));
        }

        chunks.forEach((chunk, index) => {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `youtube_results_${timestamp}_part${index + 1}.${format === 'excel' ? 'xlsx' : 'json'}`;
            
            switch (format) {
                case 'excel':
                    this.exportToExcel(chunk, filename);
                    break;
                case 'json':
                    this.exportToJson(chunk, filename);
                    break;
            }
        });

        this.uiManager.showNotification(`데이터가 ${chunks.length}개 파일로 분할되어 내보내졌습니다.`, 'success');
    }

    /**
     * 내보내기 진행률을 표시합니다.
     * @param {number} current - 현재 진행 상황.
     * @param {number} total - 전체 작업량.
     */
    showExportProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        this.uiManager.showNotification(`내보내기 진행중... ${percentage}%`, 'info', 1000);
    }

    /**
     * 내보내기 이력을 저장합니다.
     * @param {string} format - 내보낸 형식.
     * @param {number} itemCount - 내보낸 항목 수.
     * @param {string} filename - 파일명.
     */
    saveExportHistory(format, itemCount, filename) {
        try {
            const history = JSON.parse(localStorage.getItem('youtube_export_history') || '[]');
            
            history.unshift({
                timestamp: new Date().toISOString(),
                format,
                itemCount,
                filename
            });

            // 최대 50개 이력만 보관
            if (history.length > 50) {
                history.splice(50);
            }

            localStorage.setItem('youtube_export_history', JSON.stringify(history));

        } catch (error) {
            console.error('내보내기 이력 저장 오류:', error);
        }
    }

    /**
     * 내보내기 이력을 가져옵니다.
     * @returns {Array} 내보내기 이력 배열.
     */
    getExportHistory() {
        try {
            return JSON.parse(localStorage.getItem('youtube_export_history') || '[]');
        } catch (error) {
            console.error('내보내기 이력 로드 오류:', error);
            return [];
        }
    }

    /**
     * 내보내기 이력을 지웁니다.
     */
    clearExportHistory() {
        try {
            localStorage.removeItem('youtube_export_history');
            this.uiManager.showNotification('내보내기 이력이 지워졌습니다.', 'info');
        } catch (error) {
            console.error('내보내기 이력 삭제 오류:', error);
            this.uiManager.showNotification('이력 삭제 중 오류가 발생했습니다.', 'error');
        }
    }
}

export default DataExport;