/**
 * @fileoverview 검색 결과 분석 기능을 제공합니다.
 * 기본 통계, 트렌드 분석, 스팸 채널 분석 등을 수행합니다.
 */

import Formatters from '../utils/formatters.js';
import DomUtils from '../utils/dom-utils.js';

/**
 * ISO 8601 duration을 초로 변환하는 헬퍼 함수
 */
const parseDurationHelper = (duration) => {
    if (!duration) return 0;
    
    const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!matches) return 0;
    
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);
    
    return hours * 3600 + minutes * 60 + seconds;
};

class AnalysisManager {
    /**
     * AnalysisManager 클래스의 생성자.
     * @param {object} dependencies - 의존성 객체.
     * @param {object} dependencies.dataManager - 데이터 관리자 인스턴스.
     * @param {object} dependencies.uiManager - UI 관리자 인스턴스.
     */
    constructor(dependencies) {
        this.dataManager = dependencies.dataManager;
        this.uiManager = dependencies.uiManager;

        // 모달 요소들
        this.basicStatsModal = DomUtils.getElementById('basic-stats-modal');
        this.basicStatsContent = DomUtils.getElementById('basic-stats-content');
        this.spamAnalysisModal = DomUtils.getElementById('spam-analysis-modal');
        this.spamAnalysisContent = DomUtils.getElementById('spam-analysis-content');
    }

    /**
     * 분석 대상 데이터를 결정합니다 (체크박스 선택 기준)
     * @returns {Array} 분석할 비디오 배열
     */
    getAnalysisTarget() {
        if (this.dataManager.selectedVideos.size > 0) {
            return this.dataManager.currentVideos.filter(video => 
                this.dataManager.selectedVideos.has(video.id)
            );
        }
        return this.dataManager.currentVideos;
    }

    /**
     * 분석 범위 정보를 가져옵니다 (체크박스 선택 기준)
     * @returns {object} 분석 범위 정보
     */
    getAnalysisScope() {
        const total = this.dataManager.currentVideos.length;
        const selected = this.dataManager.selectedVideos.size;
        
        return {
            isSelectedMode: selected > 0,
            selectedCount: selected,
            totalCount: total,
            scopeText: selected > 0 ? `선택된 ${selected}개` : `전체 ${total}개`
        };
    }

    /**
     * 기본 통계를 보여줍니다.
     */
    showBasicStats() {
        const videos = this.getAnalysisTarget();
        const scope = this.getAnalysisScope();
        
        if (videos.length === 0) {
            const message = scope.isSelectedMode ? 
                '선택된 비디오가 없습니다. 먼저 분석할 비디오를 선택해주세요.' :
                '분석할 데이터가 없습니다.';
            this.uiManager.showNotification(message, 'warning');
            return;
        }

        const stats = this.calculateBasicStatistics(videos);
        const html = this.generateBasicStatsHtml(stats, scope);
        
        if (this.basicStatsContent) {
            this.basicStatsContent.innerHTML = html;
        }
        
        if (this.basicStatsModal) {
            this.uiManager.openModal(this.basicStatsModal);
        }
    }

    /**
     * 기본 통계를 계산합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 계산된 통계 객체.
     */
    calculateBasicStatistics(videos) {
        const validVideos = videos.filter(video => 
            video.statistics && video.snippet && video.contentDetails
        );

        if (validVideos.length === 0) {
            return { error: '분석할 수 있는 데이터가 없습니다.' };
        }

        // 조회수 통계
        const viewCounts = validVideos.map(v => parseInt(v.statistics.viewCount || 0));
        const likeCounts = validVideos.map(v => parseInt(v.statistics.likeCount || 0));
        const commentCounts = validVideos.map(v => parseInt(v.statistics.commentCount || 0));

        // 기간별 분석
        const dateAnalysis = this.analyzeDateDistribution(validVideos);
        
        // 채널 분석
        const channelAnalysis = this.analyzeChannels(validVideos);
        
        // 길이 분석
        const durationAnalysis = this.analyzeDuration(validVideos);

        // 인기도 분석
        const popularityAnalysis = this.analyzePopularity(validVideos);

        return {
            overview: {
                totalVideos: validVideos.length,
                totalChannels: channelAnalysis.uniqueChannels,
                dateRange: dateAnalysis.range,
                avgViewsPerVideo: Math.round(viewCounts.reduce((sum, count) => sum + count, 0) / viewCounts.length)
            },
            viewStats: {
                total: viewCounts.reduce((sum, count) => sum + count, 0),
                average: Math.round(viewCounts.reduce((sum, count) => sum + count, 0) / viewCounts.length),
                median: this.calculateMedian(viewCounts),
                min: Math.min(...viewCounts),
                max: Math.max(...viewCounts),
                distribution: this.calculateDistribution(viewCounts)
            },
            engagementStats: {
                totalLikes: likeCounts.reduce((sum, count) => sum + count, 0),
                totalComments: commentCounts.reduce((sum, count) => sum + count, 0),
                avgLikeRate: this.calculateAverageEngagementRate(validVideos, 'likeCount'),
                avgCommentRate: this.calculateAverageEngagementRate(validVideos, 'commentCount'),
                topEngaged: this.getTopEngagedVideos(validVideos, 5)
            },
            channelStats: channelAnalysis,
            dateStats: dateAnalysis,
            durationStats: durationAnalysis,
            popularityStats: popularityAnalysis
        };
    }

    /**
     * 기본 통계 HTML을 생성합니다.
     * @param {object} stats - 통계 객체.
     * @returns {string} 생성된 HTML 문자열.
     */
    generateBasicStatsHtml(stats, scope = null) {
        if (stats.error) {
            return `<div class="error-message">${stats.error}</div>`;
        }

        const scopeHeader = scope ? `
            <div class="analysis-scope-header" style="background: ${scope.isSelectedMode ? '#e3f2fd' : '#f5f5f5'}; padding: 10px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid ${scope.isSelectedMode ? '#2196f3' : '#757575'};">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.1em;">${scope.isSelectedMode ? '✅' : '📊'}</span>
                    <strong>분석 범위: ${scope.scopeText}</strong>
                    ${scope.isSelectedMode ? '<span style="color: #1976d2; font-size: 0.9em;">(선택 모드)</span>' : ''}
                </div>
            </div>
        ` : '';

        return `
            <div class="analysis-container">
                ${scopeHeader}
                <div class="stats-overview">
                    <h4>📊 전체 개요</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${stats.overview.totalVideos}</strong>
                            <span>총 비디오</span>
                        </div>
                        <div class="stat-item">
                            <strong>${stats.overview.totalChannels}</strong>
                            <span>고유 채널</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.overview.avgViewsPerVideo)}</strong>
                            <span>평균 조회수</span>
                        </div>
                        <div class="stat-item">
                            <strong>${stats.overview.dateRange}</strong>
                            <span>날짜 범위</span>
                        </div>
                    </div>
                </div>

                <div class="stats-section">
                    <h4>👀 조회수 분석</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.viewStats.total)}</strong>
                            <span>총 조회수</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.viewStats.average)}</strong>
                            <span>평균</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.viewStats.median)}</strong>
                            <span>중간값</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.viewStats.max)}</strong>
                            <span>최대값</span>
                        </div>
                    </div>
                    <div class="distribution-info">
                        <p><strong>분포:</strong> ${this.formatDistribution(stats.viewStats.distribution)}</p>
                    </div>
                </div>

                <div class="stats-section">
                    <h4>💬 참여도 분석</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.engagementStats.totalLikes)}</strong>
                            <span>총 좋아요</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(stats.engagementStats.totalComments)}</strong>
                            <span>총 댓글</span>
                        </div>
                        <div class="stat-item">
                            <strong>${(stats.engagementStats.avgLikeRate * 100).toFixed(2)}%</strong>
                            <span>평균 좋아요율</span>
                        </div>
                        <div class="stat-item">
                            <strong>${(stats.engagementStats.avgCommentRate * 100).toFixed(2)}%</strong>
                            <span>평균 댓글율</span>
                        </div>
                    </div>
                </div>

                <div class="stats-section">
                    <h4>📺 채널 분석</h4>
                    <p><strong>고유 채널 수:</strong> ${stats.channelStats.uniqueChannels}개</p>
                    <p><strong>상위 활발한 채널:</strong></p>
                    <ul>
                        ${stats.channelStats.topChannels.map(channel => 
                            `<li>${channel.channelTitle} (${channel.videoCount}개 비디오, ${Formatters.formatNumber(channel.totalViews)} 조회수)</li>`
                        ).join('')}
                    </ul>
                </div>

                <div class="stats-section">
                    <h4>📅 날짜 분석</h4>
                    <p><strong>기간:</strong> ${stats.dateStats.range}</p>
                    <p><strong>월별 분포:</strong></p>
                    <div class="month-distribution">
                        ${Object.entries(stats.dateStats.monthlyDistribution)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .slice(0, 6)
                            .map(([month, count]) => 
                                `<div class="month-item">${month}: ${count}개</div>`
                            ).join('')}
                    </div>
                </div>

                <div class="stats-section">
                    <h4>⏱️ 길이 분석</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${stats.durationStats.average}</strong>
                            <span>평균 길이</span>
                        </div>
                        <div class="stat-item">
                            <strong>${stats.durationStats.shortest}</strong>
                            <span>최단</span>
                        </div>
                        <div class="stat-item">
                            <strong>${stats.durationStats.longest}</strong>
                            <span>최장</span>
                        </div>
                    </div>
                    <div class="duration-categories">
                        <p><strong>길이별 분포:</strong></p>
                        ${Object.entries(stats.durationStats.categories)
                            .map(([category, count]) => 
                                `<div>${category}: ${count}개 (${((count / stats.overview.totalVideos) * 100).toFixed(1)}%)</div>`
                            ).join('')}
                    </div>
                </div>

                <div class="stats-section">
                    <h4>🔥 인기도 분석</h4>
                    <p><strong>최고 인기 비디오:</strong></p>
                    <ol>
                        ${stats.popularityStats.topVideos.map(video => 
                            `<li>
                                <strong>${Formatters.truncateText(video.title, 50)}</strong><br>
                                <small>${video.channelTitle} - ${Formatters.formatNumber(video.viewCount)} 조회수</small>
                            </li>`
                        ).join('')}
                    </ol>
                </div>
            </div>
        `;
    }

    /**
     * 트렌드 분석을 수행합니다.
     */
    showTrendAnalysis() {
        const videos = this.getAnalysisTarget();
        const scope = this.getAnalysisScope();
        
        if (videos.length === 0) {
            const message = scope.isSelectedMode ? 
                '선택된 비디오가 없습니다.' : '분석할 데이터가 없습니다.';
            this.uiManager.showNotification(message, 'warning');
            return;
        }

        const trendData = this.analyzeTrends(videos);
        const html = this.generateTrendAnalysisHtml(trendData);
        
        // 기본 통계 모달을 재사용
        if (this.basicStatsContent) {
            this.basicStatsContent.innerHTML = html;
        }
        
        if (this.basicStatsModal) {
            this.uiManager.openModal(this.basicStatsModal);
        }
    }

    /**
     * 트렌드를 분석합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 트렌드 분석 결과.
     */
    analyzeTrends(videos) {
        const validVideos = videos.filter(video => 
            video.statistics && video.snippet && video.snippet.publishedAt
        );

        // 시간별 트렌드
        const timeBasedTrends = this.analyzeTimeBasedTrends(validVideos);
        
        // 키워드 트렌드
        const keywordTrends = this.analyzeKeywordTrends(validVideos);
        
        // 성장률 분석
        const growthAnalysis = this.analyzeGrowthRates(validVideos);

        return {
            timeTrends: timeBasedTrends,
            keywordTrends: keywordTrends,
            growthAnalysis: growthAnalysis,
            recommendations: this.generateRecommendations(validVideos)
        };
    }

    /**
     * 스팸 채널을 분석합니다.
     */
    analyzeSpamChannels() {
        const videos = this.getAnalysisTarget();
        const scope = this.getAnalysisScope();
        
        if (videos.length === 0) {
            const message = scope.isSelectedMode ? 
                '선택된 비디오가 없습니다.' : '분석할 데이터가 없습니다.';
            this.uiManager.showNotification(message, 'warning');
            return;
        }

        const spamAnalysis = this.detectSpamChannels(videos);
        const html = this.generateSpamAnalysisHtml(spamAnalysis);
        
        if (this.spamAnalysisContent) {
            this.spamAnalysisContent.innerHTML = html;
        }
        
        if (this.spamAnalysisModal) {
            this.uiManager.openModal(this.spamAnalysisModal);
        }
    }

    /**
     * 스팸 채널을 감지합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 스팸 분석 결과.
     */
    detectSpamChannels(videos) {
        const channelGroups = this.groupVideosByChannel(videos);
        const suspiciousChannels = [];
        const healthyChannels = [];

        Object.entries(channelGroups).forEach(([channelId, channelData]) => {
            const suspicionScore = this.calculateSuspicionScore(channelData);
            
            if (suspicionScore > 0.6) {
                suspiciousChannels.push({
                    ...channelData,
                    suspicionScore: suspicionScore,
                    reasons: this.getSuspicionReasons(channelData)
                });
            } else {
                healthyChannels.push({
                    ...channelData,
                    suspicionScore: suspicionScore
                });
            }
        });

        return {
            suspiciousChannels: suspiciousChannels.sort((a, b) => b.suspicionScore - a.suspicionScore),
            healthyChannels: healthyChannels.sort((a, b) => b.avgViews - a.avgViews),
            totalChannels: Object.keys(channelGroups).length,
            suspiciousRatio: suspiciousChannels.length / Object.keys(channelGroups).length
        };
    }

    /**
     * 채널별로 비디오를 그룹화합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 채널별 그룹화된 데이터.
     */
    groupVideosByChannel(videos) {
        const groups = {};

        videos.forEach(video => {
            const channelId = video.snippet?.channelId;
            if (!channelId) return;

            if (!groups[channelId]) {
                groups[channelId] = {
                    channelId: channelId,
                    channelTitle: video.snippet.channelTitle,
                    videos: [],
                    totalViews: 0,
                    totalLikes: 0,
                    totalComments: 0,
                    avgViews: 0,
                    subscriberCount: parseInt(video.channelStatistics?.subscriberCount || 0)
                };
            }

            groups[channelId].videos.push(video);
            groups[channelId].totalViews += parseInt(video.statistics?.viewCount || 0);
            groups[channelId].totalLikes += parseInt(video.statistics?.likeCount || 0);
            groups[channelId].totalComments += parseInt(video.statistics?.commentCount || 0);
        });

        // 평균 계산
        Object.values(groups).forEach(group => {
            group.avgViews = Math.round(group.totalViews / group.videos.length);
        });

        return groups;
    }

    /**
     * 채널의 의심도 점수를 계산합니다.
     * @param {object} channelData - 채널 데이터.
     * @returns {number} 의심도 점수 (0-1).
     */
    calculateSuspicionScore(channelData) {
        let score = 0;
        const factors = [];

        // 1. 조회수 대비 구독자 수 비율이 이상한 경우
        if (channelData.subscriberCount > 0) {
            const viewToSubscriberRatio = channelData.totalViews / channelData.subscriberCount;
            if (viewToSubscriberRatio < 0.1 || viewToSubscriberRatio > 1000) {
                score += 0.3;
                factors.push('비정상적인 조회수/구독자 비율');
            }
        }

        // 2. 참여도가 비정상적으로 낮은 경우
        const engagementRate = (channelData.totalLikes + channelData.totalComments) / channelData.totalViews;
        if (engagementRate < 0.001) {
            score += 0.2;
            factors.push('낮은 참여도');
        }

        // 3. 제목 패턴이 의심스러운 경우
        const titles = channelData.videos.map(v => v.snippet?.title || '');
        const suspiciousTitleScore = this.analyzeTitlePatterns(titles);
        score += suspiciousTitleScore * 0.3;
        if (suspiciousTitleScore > 0.5) {
            factors.push('의심스러운 제목 패턴');
        }

        // 4. 업로드 패턴이 의심스러운 경우
        const uploadPattern = this.analyzeUploadPattern(channelData.videos);
        if (uploadPattern.isSuspicious) {
            score += 0.2;
            factors.push('비정상적인 업로드 패턴');
        }

        channelData.suspicionFactors = factors;
        return Math.min(score, 1);
    }

    /**
     * 제목 패턴을 분석합니다.
     * @param {Array} titles - 제목 배열.
     * @returns {number} 의심도 점수 (0-1).
     */
    analyzeTitlePatterns(titles) {
        let suspicionScore = 0;

        // 동일한 제목이 많은 경우
        const uniqueTitles = new Set(titles);
        if (uniqueTitles.size / titles.length < 0.5) {
            suspicionScore += 0.4;
        }

        // 과도한 대문자 사용
        const upperCaseRatio = titles.reduce((sum, title) => {
            const upperCount = (title.match(/[A-Z]/g) || []).length;
            return sum + (upperCount / title.length);
        }, 0) / titles.length;

        if (upperCaseRatio > 0.3) {
            suspicionScore += 0.2;
        }

        // 특수문자 과다 사용
        const specialCharRatio = titles.reduce((sum, title) => {
            const specialCount = (title.match(/[!@#$%^&*()]/g) || []).length;
            return sum + (specialCount / title.length);
        }, 0) / titles.length;

        if (specialCharRatio > 0.1) {
            suspicionScore += 0.3;
        }

        return Math.min(suspicionScore, 1);
    }

    /**
     * 업로드 패턴을 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 업로드 패턴 분석 결과.
     */
    analyzeUploadPattern(videos) {
        const dates = videos.map(v => new Date(v.snippet?.publishedAt))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a - b);

        if (dates.length < 2) {
            return { isSuspicious: false };
        }

        // 업로드 간격 계산
        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
            const interval = dates[i] - dates[i - 1];
            intervals.push(interval / (1000 * 60 * 60 * 24)); // 일 단위
        }

        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        
        // 매우 짧은 간격으로 대량 업로드하는 경우 의심
        const shortIntervals = intervals.filter(interval => interval < 0.1).length; // 2.4시간 미만
        const suspiciousRatio = shortIntervals / intervals.length;

        return {
            isSuspicious: suspiciousRatio > 0.7 || (avgInterval < 0.1 && videos.length > 10),
            avgInterval: avgInterval,
            shortIntervalRatio: suspiciousRatio
        };
    }

    /**
     * 의심 이유를 가져옵니다.
     * @param {object} channelData - 채널 데이터.
     * @returns {Array} 의심 이유 배열.
     */
    getSuspicionReasons(channelData) {
        return channelData.suspicionFactors || [];
    }

    /**
     * 스팸 분석 HTML을 생성합니다.
     * @param {object} analysis - 스팸 분석 결과.
     * @returns {string} 생성된 HTML 문자열.
     */
    generateSpamAnalysisHtml(analysis) {
        return `
            <div class="spam-analysis-container">
                <div class="analysis-overview">
                    <h4>🛡️ 스팸 채널 분석 결과</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${analysis.totalChannels}</strong>
                            <span>총 채널 수</span>
                        </div>
                        <div class="stat-item">
                            <strong>${analysis.suspiciousChannels.length}</strong>
                            <span>의심스러운 채널</span>
                        </div>
                        <div class="stat-item">
                            <strong>${(analysis.suspiciousRatio * 100).toFixed(1)}%</strong>
                            <span>의심 비율</span>
                        </div>
                        <div class="stat-item">
                            <strong>${analysis.healthyChannels.length}</strong>
                            <span>정상 채널</span>
                        </div>
                    </div>
                </div>

                ${analysis.suspiciousChannels.length > 0 ? `
                <div class="suspicious-channels-section">
                    <h4>⚠️ 의심스러운 채널</h4>
                    <div class="channel-list">
                        ${analysis.suspiciousChannels.slice(0, 10).map(channel => `
                            <div class="channel-item suspicious">
                                <div class="channel-header">
                                    <strong>${this._escapeHtml(channel.channelTitle)}</strong>
                                    <span class="suspicion-score" style="color: #d32f2f;">
                                        위험도: ${(channel.suspicionScore * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div class="channel-stats">
                                    <span>비디오: ${channel.videos.length}개</span>
                                    <span>평균 조회수: ${Formatters.formatNumber(channel.avgViews)}</span>
                                    <span>구독자: ${Formatters.formatNumber(channel.subscriberCount)}</span>
                                </div>
                                <div class="suspicion-reasons">
                                    <strong>의심 이유:</strong>
                                    <ul>
                                        ${channel.reasons.map(reason => `<li>${reason}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="healthy-channels-section">
                    <h4>✅ 정상 채널 (상위 5개)</h4>
                    <div class="channel-list">
                        ${analysis.healthyChannels.slice(0, 5).map(channel => `
                            <div class="channel-item healthy">
                                <div class="channel-header">
                                    <strong>${this._escapeHtml(channel.channelTitle)}</strong>
                                    <span class="suspicion-score" style="color: #2e7d32;">
                                        신뢰도: ${((1 - channel.suspicionScore) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div class="channel-stats">
                                    <span>비디오: ${channel.videos.length}개</span>
                                    <span>평균 조회수: ${Formatters.formatNumber(channel.avgViews)}</span>
                                    <span>구독자: ${Formatters.formatNumber(channel.subscriberCount)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="analysis-recommendations">
                    <h4>💡 권장 사항</h4>
                    <ul>
                        ${analysis.suspiciousChannels.length > 0 ? 
                            '<li>의심스러운 채널의 콘텐츠를 주의깊게 검토하세요.</li>' : 
                            '<li>모든 채널이 정상으로 보입니다.</li>'
                        }
                        <li>높은 참여도와 안정적인 업로드 패턴을 가진 채널을 우선시하세요.</li>
                        <li>구독자 수 대비 조회수 비율이 적절한 채널을 선택하세요.</li>
                        <li>정기적으로 채널 분석을 수행하여 품질을 유지하세요.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * 날짜 분포를 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 날짜 분석 결과.
     */
    analyzeDateDistribution(videos) {
        const dates = videos.map(v => new Date(v.snippet?.publishedAt))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a - b);

        if (dates.length === 0) {
            return { range: 'N/A', monthlyDistribution: {} };
        }

        const monthlyDistribution = {};
        dates.forEach(date => {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyDistribution[monthKey] = (monthlyDistribution[monthKey] || 0) + 1;
        });

        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        const range = `${Formatters.formatDate(startDate.toISOString())} ~ ${Formatters.formatDate(endDate.toISOString())}`;

        return {
            range: range,
            monthlyDistribution: monthlyDistribution,
            totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
        };
    }

    /**
     * 채널을 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 채널 분석 결과.
     */
    analyzeChannels(videos) {
        const channelStats = {};
        
        videos.forEach(video => {
            const channelId = video.snippet?.channelId;
            const channelTitle = video.snippet?.channelTitle;
            
            if (!channelStats[channelId]) {
                channelStats[channelId] = {
                    channelTitle: channelTitle,
                    videoCount: 0,
                    totalViews: 0
                };
            }
            
            channelStats[channelId].videoCount++;
            channelStats[channelId].totalViews += parseInt(video.statistics?.viewCount || 0);
        });

        const topChannels = Object.values(channelStats)
            .sort((a, b) => b.videoCount - a.videoCount)
            .slice(0, 5);

        return {
            uniqueChannels: Object.keys(channelStats).length,
            topChannels: topChannels
        };
    }

    /**
     * 길이를 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 길이 분석 결과.
     */
    analyzeDuration(videos) {
        const durations = videos
            .filter(v => v.contentDetails?.duration)
            .map(v => parseDurationHelper(v.contentDetails.duration));

        if (durations.length === 0) {
            return { average: 'N/A', shortest: 'N/A', longest: 'N/A', categories: {} };
        }

        const avgSeconds = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
        const shortest = Math.min(...durations);
        const longest = Math.max(...durations);

        // 카테고리별 분류
        const categories = {
            '짧음 (4분 미만)': durations.filter(d => d < 240).length,
            '중간 (4-20분)': durations.filter(d => d >= 240 && d <= 1200).length,
            '김 (20분 초과)': durations.filter(d => d > 1200).length
        };

        return {
            average: this.formatSeconds(avgSeconds),
            shortest: this.formatSeconds(shortest),
            longest: this.formatSeconds(longest),
            categories: categories
        };
    }

    /**
     * 인기도를 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 인기도 분석 결과.
     */
    analyzePopularity(videos) {
        const topVideos = videos
            .filter(v => v.statistics?.viewCount)
            .sort((a, b) => parseInt(b.statistics.viewCount) - parseInt(a.statistics.viewCount))
            .slice(0, 5)
            .map(v => ({
                title: v.snippet?.title,
                channelTitle: v.snippet?.channelTitle,
                viewCount: parseInt(v.statistics.viewCount)
            }));

        return {
            topVideos: topVideos
        };
    }

    /**
     * 시간 기반 트렌드를 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 시간 기반 트렌드 결과.
     */
    analyzeTimeBasedTrends(videos) {
        // 월별 업로드 트렌드
        const monthlyUploads = {};
        const monthlyViews = {};

        videos.forEach(video => {
            const date = new Date(video.snippet?.publishedAt);
            if (isNaN(date.getTime())) return;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyUploads[monthKey] = (monthlyUploads[monthKey] || 0) + 1;
            monthlyViews[monthKey] = (monthlyViews[monthKey] || 0) + parseInt(video.statistics?.viewCount || 0);
        });

        return {
            monthlyUploads: monthlyUploads,
            monthlyViews: monthlyViews,
            trend: this.calculateTrend(Object.values(monthlyUploads))
        };
    }

    /**
     * 키워드 트렌드를 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 키워드 트렌드 결과.
     */
    analyzeKeywordTrends(videos) {
        const keywords = {};
        
        videos.forEach(video => {
            const title = video.snippet?.title || '';
            const words = title.toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 2)
                .slice(0, 10); // 첫 10개 단어만

            words.forEach(word => {
                keywords[word] = (keywords[word] || 0) + 1;
            });
        });

        const topKeywords = Object.entries(keywords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        return {
            topKeywords: topKeywords,
            totalUniqueKeywords: Object.keys(keywords).length
        };
    }

    /**
     * 성장률을 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 성장률 분석 결과.
     */
    analyzeGrowthRates(videos) {
        const growthRates = videos
            .filter(v => v.snippet?.publishedAt && v.statistics?.viewCount)
            .map(v => ({
                title: v.snippet.title,
                rate: Formatters.formatVideoAccelerationRate(v.snippet.publishedAt, v.statistics.viewCount)
            }))
            .filter(v => v.rate !== 'N/A')
            .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));

        return {
            topGrowthVideos: growthRates.slice(0, 5),
            averageGrowthRate: growthRates.length > 0 ? 
                (growthRates.reduce((sum, v) => sum + parseFloat(v.rate), 0) / growthRates.length).toFixed(2) : 
                'N/A'
        };
    }

    /**
     * 권장 사항을 생성합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {Array} 권장 사항 배열.
     */
    generateRecommendations(videos) {
        const recommendations = [];
        
        // 여기에 다양한 분석 결과를 바탕으로 한 권장 사항 로직 추가
        recommendations.push('높은 참여도를 가진 콘텐츠에 집중하세요.');
        recommendations.push('일관된 업로드 스케줄을 유지하세요.');
        recommendations.push('인기 키워드를 활용한 제목 최적화를 고려하세요.');
        
        return recommendations;
    }

    /**
     * 트렌드 분석 HTML을 생성합니다.
     * @param {object} trendData - 트렌드 데이터.
     * @returns {string} 생성된 HTML 문자열.
     */
    generateTrendAnalysisHtml(trendData) {
        return `
            <div class="trend-analysis-container">
                <h4>📈 트렌드 분석</h4>
                
                <div class="trend-section">
                    <h5>📊 키워드 트렌드</h5>
                    <div class="keyword-trends">
                        ${trendData.keywordTrends.topKeywords.map(([keyword, count]) => 
                            `<span class="keyword-tag">${keyword} (${count})</span>`
                        ).join('')}
                    </div>
                </div>

                <div class="trend-section">
                    <h5>🚀 성장률 분석</h5>
                    <p><strong>평균 성장률:</strong> ${trendData.growthAnalysis.averageGrowthRate} 조회수/일</p>
                    <div class="top-growth-videos">
                        <strong>빠른 성장 비디오:</strong>
                        <ol>
                            ${trendData.growthAnalysis.topGrowthVideos.map(video => 
                                `<li>${Formatters.truncateText(video.title, 50)} (${video.rate} 조회수/일)</li>`
                            ).join('')}
                        </ol>
                    </div>
                </div>

                <div class="trend-section">
                    <h5>💡 권장 사항</h5>
                    <ul>
                        ${trendData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * 키워드 분석을 보여줍니다.
     */
    showKeywordAnalysis() {
        const videos = this.getAnalysisTarget();
        const scope = this.getAnalysisScope();
        
        if (videos.length === 0) {
            const message = scope.isSelectedMode ? 
                '선택된 비디오가 없습니다.' : '분석할 데이터가 없습니다.';
            this.uiManager.showNotification(message, 'warning');
            return;
        }

        const keywordData = this.analyzeKeywords(videos);
        const html = this.generateKeywordAnalysisHtml(keywordData);
        
        if (this.basicStatsContent) {
            this.basicStatsContent.innerHTML = html;
        }
        
        if (this.basicStatsModal) {
            this.uiManager.openModal(this.basicStatsModal);
        }
    }

    /**
     * 키워드를 분석합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 키워드 분석 결과.
     */
    analyzeKeywords(videos) {
        const keywords = {};
        const titleLengths = [];
        const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
        
        videos.forEach(video => {
            const title = video.snippet?.title || '';
            const description = video.snippet?.description || '';
            titleLengths.push(title.length);
            
            // 제목에서 키워드 추출
            const titleWords = title.toLowerCase()
                .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '') // 특수문자 제거, 한글 포함
                .split(/\s+/)
                .filter(word => word.length > 1 && !commonWords.has(word));

            titleWords.forEach(word => {
                keywords[word] = (keywords[word] || 0) + 1;
            });
        });

        // 상위 키워드 추출
        const topKeywords = Object.entries(keywords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);

        // 키워드 카테고리 분석
        const categories = this.categorizeKeywords(topKeywords);
        
        // 제목 길이 분석
        const avgTitleLength = titleLengths.reduce((sum, len) => sum + len, 0) / titleLengths.length;
        
        return {
            topKeywords: topKeywords,
            totalUniqueKeywords: Object.keys(keywords).length,
            categories: categories,
            titleStats: {
                averageLength: Math.round(avgTitleLength),
                shortest: Math.min(...titleLengths),
                longest: Math.max(...titleLengths)
            },
            keywordDensity: this.calculateKeywordDensity(topKeywords, videos.length)
        };
    }

    /**
     * 키워드를 카테고리별로 분류합니다.
     * @param {Array} keywords - 키워드 배열.
     * @returns {object} 카테고리별 키워드.
     */
    categorizeKeywords(keywords) {
        const categories = {
            entertainment: [],
            technology: [],
            education: [],
            gaming: [],
            music: [],
            lifestyle: [],
            other: []
        };

        const categoryKeywords = {
            entertainment: ['funny', 'comedy', 'movie', 'film', 'entertainment', 'fun', 'humor', '재미', '웃긴', '영화'],
            technology: ['tech', 'technology', 'computer', 'software', 'app', 'digital', '기술', '컴퓨터', '앱'],
            education: ['tutorial', 'learn', 'education', 'study', 'how', 'guide', '배우기', '공부', '교육', '강의'],
            gaming: ['game', 'gaming', 'play', 'gameplay', 'gamer', '게임', '플레이'],
            music: ['music', 'song', 'audio', 'sound', 'beat', '음악', '노래', '사운드'],
            lifestyle: ['life', 'lifestyle', 'daily', 'vlog', 'beauty', 'fashion', '일상', '라이프', '뷰티']
        };

        keywords.forEach(([keyword, count]) => {
            let categorized = false;
            
            for (const [category, categoryWords] of Object.entries(categoryKeywords)) {
                if (categoryWords.some(word => keyword.includes(word) || word.includes(keyword))) {
                    categories[category].push([keyword, count]);
                    categorized = true;
                    break;
                }
            }
            
            if (!categorized) {
                categories.other.push([keyword, count]);
            }
        });

        return categories;
    }

    /**
     * 키워드 밀도를 계산합니다.
     * @param {Array} keywords - 키워드 배열.
     * @param {number} totalVideos - 총 비디오 수.
     * @returns {Array} 키워드 밀도 배열.
     */
    calculateKeywordDensity(keywords, totalVideos) {
        return keywords.slice(0, 10).map(([keyword, count]) => ({
            keyword: keyword,
            count: count,
            density: ((count / totalVideos) * 100).toFixed(1)
        }));
    }

    /**
     * 키워드 분석 HTML을 생성합니다.
     * @param {object} data - 키워드 분석 데이터.
     * @returns {string} 생성된 HTML 문자열.
     */
    generateKeywordAnalysisHtml(data) {
        return `
            <div class="keyword-analysis-container">
                <h4>🔍 키워드 분석</h4>
                
                <div class="stats-overview">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${data.totalUniqueKeywords}</strong>
                            <span>총 고유 키워드</span>
                        </div>
                        <div class="stat-item">
                            <strong>${data.titleStats.averageLength}</strong>
                            <span>평균 제목 길이</span>
                        </div>
                        <div class="stat-item">
                            <strong>${data.titleStats.longest}</strong>
                            <span>최장 제목 길이</span>
                        </div>
                        <div class="stat-item">
                            <strong>${data.titleStats.shortest}</strong>
                            <span>최단 제목 길이</span>
                        </div>
                    </div>
                </div>

                <div class="keyword-section">
                    <h5>🏆 상위 키워드</h5>
                    <div class="keyword-grid">
                        ${data.topKeywords.slice(0, 15).map(([keyword, count], index) => `
                            <div class="keyword-item rank-${Math.min(index + 1, 3)}">
                                <span class="keyword-text">${keyword}</span>
                                <span class="keyword-count">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="keyword-section">
                    <h5>📊 키워드 밀도</h5>
                    <div class="density-list">
                        ${data.keywordDensity.map(item => `
                            <div class="density-item">
                                <span class="density-keyword">${item.keyword}</span>
                                <span class="density-bar">
                                    <div class="density-fill" style="width: ${Math.min(item.density * 2, 100)}%"></div>
                                </span>
                                <span class="density-value">${item.density}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="keyword-section">
                    <h5>📂 카테고리별 키워드</h5>
                    <div class="category-grid">
                        ${Object.entries(data.categories)
                            .filter(([, keywords]) => keywords.length > 0)
                            .map(([category, keywords]) => `
                                <div class="category-item">
                                    <h6>${this.getCategoryName(category)}</h6>
                                    <div class="category-keywords">
                                        ${keywords.slice(0, 5).map(([keyword, count]) => 
                                            `<span class="category-keyword">${keyword} (${count})</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            `).join('')}
                    </div>
                </div>

                <div class="keyword-section">
                    <h5>💡 키워드 인사이트</h5>
                    <div class="insights-list">
                        ${this.generateKeywordInsights(data).map(insight => 
                            `<div class="insight-item">💡 ${insight}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 카테고리 이름을 한국어로 변환합니다.
     * @param {string} category - 카테고리 영문명.
     * @returns {string} 한국어 카테고리명.
     */
    getCategoryName(category) {
        const names = {
            entertainment: '🎭 엔터테인먼트',
            technology: '💻 기술',
            education: '📚 교육',
            gaming: '🎮 게임',
            music: '🎵 음악',
            lifestyle: '✨ 라이프스타일',
            other: '📌 기타'
        };
        return names[category] || category;
    }

    /**
     * 키워드 인사이트를 생성합니다.
     * @param {object} data - 키워드 분석 데이터.
     * @returns {Array} 인사이트 배열.
     */
    generateKeywordInsights(data) {
        const insights = [];
        
        if (data.topKeywords.length > 0) {
            const topKeyword = data.topKeywords[0];
            insights.push(`가장 인기있는 키워드는 "${topKeyword[0]}"입니다 (${topKeyword[1]}회 등장)`);
        }
        
        if (data.titleStats.averageLength > 50) {
            insights.push('제목이 평균적으로 긴 편입니다. 더 간결한 제목을 고려해보세요.');
        } else if (data.titleStats.averageLength < 30) {
            insights.push('제목이 평균적으로 짧은 편입니다. 더 설명적인 제목을 고려해보세요.');
        }
        
        const categoryCount = Object.values(data.categories).filter(cat => cat.length > 0).length;
        if (categoryCount > 4) {
            insights.push('다양한 카테고리의 콘텐츠가 포함되어 있어 타겟 오디언스가 분산될 수 있습니다.');
        }
        
        if (data.totalUniqueKeywords < 20) {
            insights.push('키워드 다양성이 부족합니다. 더 다양한 키워드 사용을 권장합니다.');
        }
        
        return insights;
    }

    /**
     * 채널 비교 분석을 보여줍니다.
     */
    showChannelComparison() {
        const videos = this.getAnalysisTarget();
        const scope = this.getAnalysisScope();
        
        if (videos.length === 0) {
            const message = scope.isSelectedMode ? 
                '선택된 비디오가 없습니다.' : '분석할 데이터가 없습니다.';
            this.uiManager.showNotification(message, 'warning');
            return;
        }

        const comparisonData = this.analyzeChannelComparison(videos);
        const html = this.generateChannelComparisonHtml(comparisonData);
        
        if (this.basicStatsContent) {
            this.basicStatsContent.innerHTML = html;
        }
        
        if (this.basicStatsModal) {
            this.uiManager.openModal(this.basicStatsModal);
        }
    }

    /**
     * 채널 비교를 분석합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 채널 비교 분석 결과.
     */
    analyzeChannelComparison(videos) {
        const channelGroups = this.groupVideosByChannel(videos);
        const channelStats = [];

        Object.values(channelGroups).forEach(channel => {
            const avgViews = channel.totalViews / channel.videos.length;
            const avgLikes = channel.totalLikes / channel.videos.length;
            const avgComments = channel.totalComments / channel.videos.length;
            const engagementRate = (channel.totalLikes + channel.totalComments) / channel.totalViews;
            
            // 업로드 일관성 계산
            const consistency = this.calculateUploadConsistency(channel.videos);
            
            // 성장률 계산
            const growthRate = this.calculateChannelGrowthRate(channel.videos);

            channelStats.push({
                ...channel,
                avgViews: Math.round(avgViews),
                avgLikes: Math.round(avgLikes),
                avgComments: Math.round(avgComments),
                engagementRate: engagementRate,
                consistency: consistency,
                growthRate: growthRate,
                performanceScore: this.calculatePerformanceScore(avgViews, engagementRate, consistency)
            });
        });

        // 성과별로 정렬
        channelStats.sort((a, b) => b.performanceScore - a.performanceScore);

        return {
            channels: channelStats,
            totalChannels: channelStats.length,
            topPerformer: channelStats[0],
            averageStats: this.calculateAverageChannelStats(channelStats)
        };
    }

    /**
     * 업로드 일관성을 계산합니다.
     * @param {Array} videos - 채널의 비디오 배열.
     * @returns {number} 일관성 점수 (0-1).
     */
    calculateUploadConsistency(videos) {
        if (videos.length < 2) return 0;

        const dates = videos.map(v => new Date(v.snippet?.publishedAt))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a - b);

        if (dates.length < 2) return 0;

        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
            const interval = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24); // 일 단위
            intervals.push(interval);
        }

        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const standardDeviation = Math.sqrt(variance);
        
        // 표준편차가 작을수록 일관성이 높음
        const consistencyScore = Math.max(0, 1 - (standardDeviation / avgInterval));
        return Math.min(consistencyScore, 1);
    }

    /**
     * 채널 성장률을 계산합니다.
     * @param {Array} videos - 채널의 비디오 배열.
     * @returns {number} 성장률.
     */
    calculateChannelGrowthRate(videos) {
        const sortedVideos = videos
            .filter(v => v.snippet?.publishedAt && v.statistics?.viewCount)
            .sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));

        if (sortedVideos.length < 2) return 0;

        const firstHalf = sortedVideos.slice(0, Math.floor(sortedVideos.length / 2));
        const secondHalf = sortedVideos.slice(Math.floor(sortedVideos.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum, v) => sum + parseInt(v.statistics.viewCount), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, v) => sum + parseInt(v.statistics.viewCount), 0) / secondHalf.length;

        return ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    }

    /**
     * 성과 점수를 계산합니다.
     * @param {number} avgViews - 평균 조회수.
     * @param {number} engagementRate - 참여도.
     * @param {number} consistency - 일관성.
     * @returns {number} 성과 점수.
     */
    calculatePerformanceScore(avgViews, engagementRate, consistency) {
        const viewScore = Math.log10(avgViews + 1) / 10; // 로그 스케일로 정규화
        const engagementScore = Math.min(engagementRate * 1000, 1); // 참여도 정규화
        const consistencyScore = consistency;
        
        return (viewScore * 0.5 + engagementScore * 0.3 + consistencyScore * 0.2) * 100;
    }

    /**
     * 평균 채널 통계를 계산합니다.
     * @param {Array} channelStats - 채널 통계 배열.
     * @returns {object} 평균 통계.
     */
    calculateAverageChannelStats(channelStats) {
        if (channelStats.length === 0) return {};

        const avgViews = channelStats.reduce((sum, ch) => sum + ch.avgViews, 0) / channelStats.length;
        const avgEngagement = channelStats.reduce((sum, ch) => sum + ch.engagementRate, 0) / channelStats.length;
        const avgConsistency = channelStats.reduce((sum, ch) => sum + ch.consistency, 0) / channelStats.length;

        return {
            avgViews: Math.round(avgViews),
            avgEngagement: avgEngagement,
            avgConsistency: avgConsistency
        };
    }

    /**
     * 채널 비교 HTML을 생성합니다.
     * @param {object} data - 채널 비교 데이터.
     * @returns {string} 생성된 HTML 문자열.
     */
    generateChannelComparisonHtml(data) {
        return `
            <div class="channel-comparison-container">
                <h4>📊 채널 비교 분석</h4>
                
                <div class="stats-overview">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>${data.totalChannels}</strong>
                            <span>분석된 채널</span>
                        </div>
                        <div class="stat-item">
                            <strong>${Formatters.formatNumber(data.averageStats.avgViews)}</strong>
                            <span>평균 조회수</span>
                        </div>
                        <div class="stat-item">
                            <strong>${(data.averageStats.avgEngagement * 100).toFixed(2)}%</strong>
                            <span>평균 참여도</span>
                        </div>
                        <div class="stat-item">
                            <strong>${(data.averageStats.avgConsistency * 100).toFixed(0)}%</strong>
                            <span>평균 일관성</span>
                        </div>
                    </div>
                </div>

                ${data.topPerformer ? `
                <div class="top-performer-section">
                    <h5>🏆 최고 성과 채널</h5>
                    <div class="top-performer-card">
                        <h6>${this._escapeHtml(data.topPerformer.channelTitle)}</h6>
                        <div class="performer-stats">
                            <div class="stat-item">
                                <strong>${Formatters.formatNumber(data.topPerformer.avgViews)}</strong>
                                <span>평균 조회수</span>
                            </div>
                            <div class="stat-item">
                                <strong>${(data.topPerformer.engagementRate * 100).toFixed(2)}%</strong>
                                <span>참여도</span>
                            </div>
                            <div class="stat-item">
                                <strong>${data.topPerformer.performanceScore.toFixed(1)}</strong>
                                <span>성과 점수</span>
                            </div>
                            <div class="stat-item">
                                <strong>${data.topPerformer.videos.length}</strong>
                                <span>비디오 수</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="channel-ranking-section">
                    <h5>📈 채널 성과 순위</h5>
                    <div class="channel-ranking-list">
                        ${data.channels.slice(0, 10).map((channel, index) => `
                            <div class="ranking-item ${index === 0 ? 'top-rank' : ''}">
                                <div class="rank-number">${index + 1}</div>
                                <div class="channel-info">
                                    <h6>${this._escapeHtml(channel.channelTitle)}</h6>
                                    <div class="channel-metrics">
                                        <span>📹 ${channel.videos.length}개</span>
                                        <span>👀 ${Formatters.formatNumber(channel.avgViews)}</span>
                                        <span>💬 ${(channel.engagementRate * 100).toFixed(2)}%</span>
                                        <span>📊 ${channel.performanceScore.toFixed(1)}점</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="comparison-insights-section">
                    <h5>💡 비교 인사이트</h5>
                    <div class="insights-list">
                        ${this.generateChannelInsights(data).map(insight => 
                            `<div class="insight-item">💡 ${insight}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 채널 인사이트를 생성합니다.
     * @param {object} data - 채널 비교 데이터.
     * @returns {Array} 인사이트 배열.
     */
    generateChannelInsights(data) {
        const insights = [];
        
        if (data.topPerformer) {
            insights.push(`${data.topPerformer.channelTitle}이(가) 가장 높은 성과를 보이고 있습니다.`);
        }
        
        const highEngagementChannels = data.channels.filter(ch => ch.engagementRate > data.averageStats.avgEngagement * 1.5);
        if (highEngagementChannels.length > 0) {
            insights.push(`${highEngagementChannels.length}개 채널이 평균보다 50% 이상 높은 참여도를 보입니다.`);
        }
        
        const consistentChannels = data.channels.filter(ch => ch.consistency > 0.7);
        if (consistentChannels.length > 0) {
            insights.push(`${consistentChannels.length}개 채널이 일관된 업로드 패턴을 유지하고 있습니다.`);
        }
        
        if (data.channels.length > 5) {
            const top20Percent = Math.ceil(data.channels.length * 0.2);
            const topChannels = data.channels.slice(0, top20Percent);
            const avgTopViews = topChannels.reduce((sum, ch) => sum + ch.avgViews, 0) / topChannels.length;
            const avgAllViews = data.averageStats.avgViews;
            const performance = ((avgTopViews - avgAllViews) / avgAllViews * 100).toFixed(0);
            insights.push(`상위 20% 채널의 평균 조회수가 전체 평균보다 ${performance}% 높습니다.`);
        }
        
        return insights;
    }

    /**
     * 기본 예측 분석을 보여줍니다.
     */
    showPrediction() {
        const videos = this.getAnalysisTarget();
        const scope = this.getAnalysisScope();
        
        if (videos.length === 0) {
            const message = scope.isSelectedMode ? 
                '선택된 비디오가 없습니다.' : '분석할 데이터가 없습니다.';
            this.uiManager.showNotification(message, 'warning');
            return;
        }

        const predictionData = this.analyzePredictions(videos);
        const html = this.generatePredictionHtml(predictionData);
        
        if (this.basicStatsContent) {
            this.basicStatsContent.innerHTML = html;
        }
        
        if (this.basicStatsModal) {
            this.uiManager.openModal(this.basicStatsModal);
        }
    }

    /**
     * 예측을 분석합니다.
     * @param {Array} videos - 분석할 비디오 배열.
     * @returns {object} 예측 분석 결과.
     */
    analyzePredictions(videos) {
        const validVideos = videos.filter(v => 
            v.statistics?.viewCount && 
            v.snippet?.publishedAt && 
            !isNaN(new Date(v.snippet.publishedAt).getTime())
        );

        if (validVideos.length < 3) {
            return { error: '예측을 위해서는 최소 3개 이상의 유효한 비디오가 필요합니다.' };
        }

        // 조회수 예측
        const viewsPrediction = this.predictViewsGrowth(validVideos);
        
        // 인기도 지속성 예측
        const popularityPrediction = this.predictPopularityPersistence(validVideos);
        
        // 채널 성장 예측
        const channelGrowthPrediction = this.predictChannelGrowth(validVideos);
        
        // 트렌드 예측
        const trendPrediction = this.predictTrends(validVideos);

        return {
            viewsPrediction: viewsPrediction,
            popularityPrediction: popularityPrediction,
            channelGrowthPrediction: channelGrowthPrediction,
            trendPrediction: trendPrediction,
            confidence: this.calculatePredictionConfidence(validVideos),
            recommendations: this.generatePredictionRecommendations(validVideos)
        };
    }

    /**
     * 조회수 증가를 예측합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 조회수 예측 결과.
     */
    predictViewsGrowth(videos) {
        // 업로드 시간과 조회수의 관계를 분석
        const dataPoints = videos.map(video => {
            const publishDate = new Date(video.snippet.publishedAt);
            const daysSinceUpload = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
            const views = parseInt(video.statistics.viewCount);
            
            return {
                x: daysSinceUpload,
                y: views,
                video: video
            };
        }).filter(point => point.x > 0 && point.y > 0);

        if (dataPoints.length < 3) {
            return { error: '예측을 위한 데이터가 부족합니다.' };
        }

        // 단순 선형 회귀를 사용한 예측
        const { slope, intercept, rSquared } = this.calculateLinearRegression(dataPoints);
        
        // 7일, 30일, 90일 후 예상 조회수
        const predictions = [7, 30, 90].map(days => {
            const avgCurrentDays = dataPoints.reduce((sum, p) => sum + p.x, 0) / dataPoints.length;
            const predictedViews = slope * (avgCurrentDays + days) + intercept;
            
            return {
                days: days,
                predictedViews: Math.max(0, Math.round(predictedViews)),
                confidence: Math.min(rSquared * 100, 95) // 최대 95% 신뢰도
            };
        });

        return {
            currentTrend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
            predictions: predictions,
            accuracy: rSquared,
            trendStrength: Math.abs(slope)
        };
    }

    /**
     * 단순 선형 회귀를 계산합니다.
     * @param {Array} dataPoints - 데이터 포인트 배열.
     * @returns {object} 회귀 분석 결과.
     */
    calculateLinearRegression(dataPoints) {
        const n = dataPoints.length;
        const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0);
        const sumXY = dataPoints.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumXX = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0);
        const sumYY = dataPoints.reduce((sum, p) => sum + p.y * p.y, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // R-squared 계산
        const yMean = sumY / n;
        const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
        const ssResidual = dataPoints.reduce((sum, p) => {
            const predicted = slope * p.x + intercept;
            return sum + Math.pow(p.y - predicted, 2);
        }, 0);
        const rSquared = 1 - (ssResidual / ssTotal);

        return {
            slope: slope,
            intercept: intercept,
            rSquared: Math.max(0, rSquared)
        };
    }

    /**
     * 인기도 지속성을 예측합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 인기도 지속성 예측 결과.
     */
    predictPopularityPersistence(videos) {
        // 최근 비디오들의 성과 분석
        const sortedVideos = videos
            .sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))
            .slice(0, 10); // 최근 10개 비디오

        const recentViews = sortedVideos.map(v => parseInt(v.statistics.viewCount));
        const avgRecentViews = recentViews.reduce((sum, views) => sum + views, 0) / recentViews.length;
        
        // 전체 평균과 비교
        const allViews = videos.map(v => parseInt(v.statistics.viewCount));
        const avgAllViews = allViews.reduce((sum, views) => sum + views, 0) / allViews.length;
        
        const persistenceScore = avgRecentViews / avgAllViews;
        
        let persistenceLevel;
        let prediction;
        
        if (persistenceScore > 1.2) {
            persistenceLevel = 'high';
            prediction = '인기도가 상승 추세를 보이고 있어 지속적인 성장이 예상됩니다.';
        } else if (persistenceScore > 0.8) {
            persistenceLevel = 'stable';
            prediction = '안정적인 인기도를 유지하고 있습니다.';
        } else {
            persistenceLevel = 'declining';
            prediction = '인기도가 하락 추세를 보이고 있어 전략 변경이 필요할 수 있습니다.';
        }

        return {
            persistenceScore: persistenceScore,
            level: persistenceLevel,
            prediction: prediction,
            recentPerformance: avgRecentViews,
            overallPerformance: avgAllViews
        };
    }

    /**
     * 채널 성장을 예측합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 채널 성장 예측 결과.
     */
    predictChannelGrowth(videos) {
        const channelGroups = this.groupVideosByChannel(videos);
        const channelPredictions = [];

        Object.values(channelGroups).forEach(channel => {
            const sortedVideos = channel.videos
                .sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));
            
            if (sortedVideos.length < 3) return;

            const viewsOverTime = sortedVideos.map((video, index) => ({
                x: index,
                y: parseInt(video.statistics.viewCount),
                date: new Date(video.snippet.publishedAt)
            }));

            const regression = this.calculateLinearRegression(viewsOverTime);
            const growthRate = regression.slope;
            
            let growthCategory;
            if (growthRate > 1000) growthCategory = 'high';
            else if (growthRate > 0) growthCategory = 'moderate';
            else growthCategory = 'declining';

            channelPredictions.push({
                channelTitle: channel.channelTitle,
                growthRate: growthRate,
                category: growthCategory,
                confidence: regression.rSquared,
                videoCount: channel.videos.length
            });
        });

        channelPredictions.sort((a, b) => b.growthRate - a.growthRate);

        return {
            channels: channelPredictions,
            topGrowthChannel: channelPredictions[0],
            averageGrowthRate: channelPredictions.length > 0 ? 
                channelPredictions.reduce((sum, ch) => sum + ch.growthRate, 0) / channelPredictions.length : 0
        };
    }

    /**
     * 트렌드를 예측합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 트렌드 예측 결과.
     */
    predictTrends(videos) {
        // 키워드 트렌드 분석
        const keywordTrends = this.analyzeKeywordTrends(videos);
        
        // 업로드 시간 패턴 분석
        const timePatterns = this.analyzeTimePatterns(videos);
        
        // 길이 트렌드 분석
        const lengthTrends = this.analyzeLengthTrends(videos);

        return {
            emergingKeywords: keywordTrends.topKeywords.slice(0, 5),
            optimalUploadTime: timePatterns.bestTime,
            lengthTrend: lengthTrends.trend,
            seasonalPatterns: timePatterns.seasonal
        };
    }

    /**
     * 시간 패턴을 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 시간 패턴 분석 결과.
     */
    analyzeTimePatterns(videos) {
        const hourCounts = {};
        const monthCounts = {};

        videos.forEach(video => {
            const date = new Date(video.snippet.publishedAt);
            if (isNaN(date.getTime())) return;

            const hour = date.getHours();
            const month = date.getMonth();

            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            monthCounts[month] = (monthCounts[month] || 0) + 1;
        });

        const bestHour = Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)[0];

        const bestMonth = Object.entries(monthCounts)
            .sort(([,a], [,b]) => b - a)[0];

        return {
            bestTime: bestHour ? `${bestHour[0]}시` : 'N/A',
            seasonal: bestMonth ? this.getMonthName(parseInt(bestMonth[0])) : 'N/A',
            hourDistribution: hourCounts,
            monthDistribution: monthCounts
        };
    }

    /**
     * 길이 트렌드를 분석합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {object} 길이 트렌드 분석 결과.
     */
    analyzeLengthTrends(videos) {
        const validVideos = videos.filter(v => v.contentDetails?.duration);
        
        if (validVideos.length < 3) {
            return { trend: 'insufficient_data' };
        }

        const sortedVideos = validVideos
            .sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));

        const durations = sortedVideos.map(v => parseDurationHelper(v.contentDetails.duration));
        
        const firstHalfAvg = durations.slice(0, Math.floor(durations.length / 2))
            .reduce((sum, d) => sum + d, 0) / Math.floor(durations.length / 2);
        
        const secondHalfAvg = durations.slice(Math.floor(durations.length / 2))
            .reduce((sum, d) => sum + d, 0) / (durations.length - Math.floor(durations.length / 2));

        let trend;
        if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'increasing';
        else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'decreasing';
        else trend = 'stable';

        return {
            trend: trend,
            currentAvg: Math.round(secondHalfAvg),
            previousAvg: Math.round(firstHalfAvg),
            change: ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(1)
        };
    }

    /**
     * 월 이름을 가져옵니다.
     * @param {number} monthIndex - 월 인덱스 (0-11).
     * @returns {string} 월 이름.
     */
    getMonthName(monthIndex) {
        const months = [
            '1월', '2월', '3월', '4월', '5월', '6월',
            '7월', '8월', '9월', '10월', '11월', '12월'
        ];
        return months[monthIndex] || 'N/A';
    }

    /**
     * 예측 신뢰도를 계산합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {number} 신뢰도 (0-100).
     */
    calculatePredictionConfidence(videos) {
        let confidence = 0;

        // 데이터 크기에 따른 신뢰도
        if (videos.length >= 50) confidence += 40;
        else if (videos.length >= 20) confidence += 30;
        else if (videos.length >= 10) confidence += 20;
        else confidence += 10;

        // 데이터 일관성에 따른 신뢰도
        const viewCounts = videos.map(v => parseInt(v.statistics?.viewCount || 0));
        const coefficient = this.calculateCoefficientOfVariation(viewCounts);
        
        if (coefficient < 0.5) confidence += 30;
        else if (coefficient < 1.0) confidence += 20;
        else if (coefficient < 2.0) confidence += 10;

        // 시간 범위에 따른 신뢰도
        const dates = videos.map(v => new Date(v.snippet?.publishedAt))
            .filter(date => !isNaN(date.getTime()));
        
        if (dates.length > 0) {
            const timeRange = Math.max(...dates) - Math.min(...dates);
            const dayRange = timeRange / (1000 * 60 * 60 * 24);
            
            if (dayRange >= 365) confidence += 30;
            else if (dayRange >= 180) confidence += 20;
            else if (dayRange >= 90) confidence += 10;
        }

        return Math.min(confidence, 95);
    }

    /**
     * 변동계수를 계산합니다.
     * @param {Array} values - 값 배열.
     * @returns {number} 변동계수.
     */
    calculateCoefficientOfVariation(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        
        return mean > 0 ? standardDeviation / mean : 0;
    }

    /**
     * 예측 권장사항을 생성합니다.
     * @param {Array} videos - 비디오 배열.
     * @returns {Array} 권장사항 배열.
     */
    generatePredictionRecommendations(videos) {
        const recommendations = [];
        
        const avgViews = videos.reduce((sum, v) => sum + parseInt(v.statistics?.viewCount || 0), 0) / videos.length;
        
        if (avgViews < 1000) {
            recommendations.push('조회수가 낮은 편입니다. SEO 최적화와 썸네일 개선을 고려해보세요.');
        }
        
        const recentVideos = videos
            .sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))
            .slice(0, 5);
        
        const recentAvg = recentVideos.reduce((sum, v) => sum + parseInt(v.statistics?.viewCount || 0), 0) / recentVideos.length;
        
        if (recentAvg > avgViews * 1.2) {
            recommendations.push('최근 성과가 좋습니다. 현재 전략을 유지하고 확장하세요.');
        } else if (recentAvg < avgViews * 0.8) {
            recommendations.push('최근 성과가 하락했습니다. 콘텐츠 전략을 재검토해보세요.');
        }
        
        recommendations.push('일관된 업로드 스케줄을 유지하면 예측 정확도가 향상됩니다.');
        recommendations.push('다양한 콘텐츠 실험을 통해 최적의 포맷을 찾아보세요.');
        
        return recommendations;
    }

    /**
     * 예측 HTML을 생성합니다.
     * @param {object} data - 예측 데이터.
     * @returns {string} 생성된 HTML 문자열.
     */
    generatePredictionHtml(data) {
        if (data.error) {
            return `<div class="prediction-container">
                <h4>🔮 예측 분석</h4>
                <div class="error-message">${data.error}</div>
            </div>`;
        }

        return `
            <div class="prediction-container">
                <h4>🔮 예측 분석</h4>
                
                <div class="prediction-confidence">
                    <div class="confidence-meter">
                        <span class="confidence-label">예측 신뢰도:</span>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${data.confidence}%"></div>
                        </div>
                        <span class="confidence-value">${data.confidence.toFixed(0)}%</span>
                    </div>
                </div>

                <div class="prediction-section">
                    <h5>📈 조회수 예측</h5>
                    <div class="prediction-grid">
                        ${data.viewsPrediction.predictions.map(pred => `
                            <div class="prediction-item">
                                <strong>${pred.days}일 후</strong>
                                <span>${Formatters.formatNumber(pred.predictedViews)} 조회수</span>
                                <small>${pred.confidence.toFixed(0)}% 신뢰도</small>
                            </div>
                        `).join('')}
                    </div>
                    <p><strong>현재 트렌드:</strong> 
                        ${this.getTrendEmoji(data.viewsPrediction.currentTrend)} 
                        ${this.getTrendDescription(data.viewsPrediction.currentTrend)}
                    </p>
                </div>

                <div class="prediction-section">
                    <h5>🌟 인기도 지속성</h5>
                    <div class="popularity-prediction">
                        <div class="popularity-score">
                            <span class="score-label">지속성 점수:</span>
                            <span class="score-value ${data.popularityPrediction.level}">
                                ${(data.popularityPrediction.persistenceScore * 100).toFixed(0)}%
                            </span>
                        </div>
                        <p class="popularity-description">${data.popularityPrediction.prediction}</p>
                    </div>
                </div>

                ${data.channelGrowthPrediction.topGrowthChannel ? `
                <div class="prediction-section">
                    <h5>🚀 채널 성장 예측</h5>
                    <div class="top-growth-channel">
                        <h6>최고 성장 채널: ${this._escapeHtml(data.channelGrowthPrediction.topGrowthChannel.channelTitle)}</h6>
                        <div class="growth-stats">
                            <span>성장률: ${data.channelGrowthPrediction.topGrowthChannel.growthRate.toFixed(0)} 조회수/비디오</span>
                            <span>카테고리: ${this.getGrowthCategoryName(data.channelGrowthPrediction.topGrowthChannel.category)}</span>
                        </div>
                    </div>
                    <p><strong>전체 평균 성장률:</strong> ${data.channelGrowthPrediction.averageGrowthRate.toFixed(0)} 조회수/비디오</p>
                </div>
                ` : ''}

                <div class="prediction-section">
                    <h5>📊 트렌드 예측</h5>
                    <div class="trend-predictions">
                        <div class="trend-item">
                            <strong>인기 키워드:</strong>
                            <div class="keyword-list">
                                ${data.trendPrediction.emergingKeywords.map(([keyword, count]) => 
                                    `<span class="keyword-tag">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="trend-item">
                            <strong>최적 업로드 시간:</strong> ${data.trendPrediction.optimalUploadTime}
                        </div>
                        <div class="trend-item">
                            <strong>비디오 길이 트렌드:</strong> ${this.getLengthTrendDescription(data.trendPrediction.lengthTrend)}
                        </div>
                    </div>
                </div>

                <div class="prediction-section">
                    <h5>💡 예측 기반 권장사항</h5>
                    <div class="recommendations-list">
                        ${data.recommendations.map(rec => 
                            `<div class="recommendation-item">💡 ${rec}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 트렌드 이모지를 가져옵니다.
     * @param {string} trend - 트렌드 타입.
     * @returns {string} 이모지.
     */
    getTrendEmoji(trend) {
        const emojis = {
            increasing: '📈',
            decreasing: '📉',
            stable: '➡️'
        };
        return emojis[trend] || '❓';
    }

    /**
     * 트렌드 설명을 가져옵니다.
     * @param {string} trend - 트렌드 타입.
     * @returns {string} 트렌드 설명.
     */
    getTrendDescription(trend) {
        const descriptions = {
            increasing: '상승세',
            decreasing: '하락세',
            stable: '안정세'
        };
        return descriptions[trend] || '알 수 없음';
    }

    /**
     * 성장 카테고리 이름을 가져옵니다.
     * @param {string} category - 성장 카테고리.
     * @returns {string} 카테고리 이름.
     */
    getGrowthCategoryName(category) {
        const names = {
            high: '🔥 고성장',
            moderate: '📈 보통성장',
            declining: '📉 하락'
        };
        return names[category] || category;
    }

    /**
     * 길이 트렌드 설명을 가져옵니다.
     * @param {object} lengthTrend - 길이 트렌드 객체.
     * @returns {string} 길이 트렌드 설명.
     */
    getLengthTrendDescription(lengthTrend) {
        if (lengthTrend.trend === 'insufficient_data') {
            return '데이터 부족';
        }
        
        const trendNames = {
            increasing: '길어지는 추세',
            decreasing: '짧아지는 추세',
            stable: '안정적'
        };
        
        const trendName = trendNames[lengthTrend.trend] || '알 수 없음';
        return `${trendName} (${lengthTrend.change}% 변화)`;
    }

    /**
     * 중간값을 계산합니다.
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
     * 분포를 계산합니다.
     * @param {Array} numbers - 숫자 배열.
     * @returns {object} 분포 객체.
     */
    calculateDistribution(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const q1 = this.calculatePercentile(sorted, 25);
        const q3 = this.calculatePercentile(sorted, 75);
        
        return {
            q1: q1,
            q3: q3,
            iqr: q3 - q1
        };
    }

    /**
     * 백분위수를 계산합니다.
     * @param {Array} sorted - 정렬된 숫자 배열.
     * @param {number} percentile - 백분위수 (0-100).
     * @returns {number} 백분위수 값.
     */
    calculatePercentile(sorted, percentile) {
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        if (upper >= sorted.length) return sorted[sorted.length - 1];
        
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    /**
     * 평균 참여도를 계산합니다.
     * @param {Array} videos - 비디오 배열.
     * @param {string} metric - 측정 지표.
     * @returns {number} 평균 참여도.
     */
    calculateAverageEngagementRate(videos, metric) {
        const rates = videos
            .filter(v => v.statistics?.viewCount && v.statistics[metric])
            .map(v => parseInt(v.statistics[metric]) / parseInt(v.statistics.viewCount));
        
        if (rates.length === 0) return 0;
        
        return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    }

    /**
     * 상위 참여도 비디오를 가져옵니다.
     * @param {Array} videos - 비디오 배열.
     * @param {number} limit - 가져올 개수.
     * @returns {Array} 상위 참여도 비디오 배열.
     */
    getTopEngagedVideos(videos, limit) {
        return videos
            .filter(v => v.statistics?.viewCount)
            .map(v => ({
                title: v.snippet?.title,
                channelTitle: v.snippet?.channelTitle,
                engagementRate: (
                    (parseInt(v.statistics.likeCount || 0) + parseInt(v.statistics.commentCount || 0)) /
                    parseInt(v.statistics.viewCount)
                ).toFixed(4)
            }))
            .sort((a, b) => parseFloat(b.engagementRate) - parseFloat(a.engagementRate))
            .slice(0, limit);
    }

    /**
     * 분포를 포맷팅합니다.
     * @param {object} distribution - 분포 객체.
     * @returns {string} 포맷팅된 분포 문자열.
     */
    formatDistribution(distribution) {
        return `Q1: ${Formatters.formatNumber(distribution.q1)}, Q3: ${Formatters.formatNumber(distribution.q3)}, IQR: ${Formatters.formatNumber(distribution.iqr)}`;
    }

    /**
     * 초를 시간 형식으로 변환합니다.
     * @param {number} seconds - 초.
     * @returns {string} 시간 형식 문자열.
     */
    formatSeconds(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * 트렌드를 계산합니다.
     * @param {Array} values - 값 배열.
     * @returns {string} 트렌드 방향.
     */
    calculateTrend(values) {
        if (values.length < 2) return 'insufficient_data';
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg * 1.1) return 'increasing';
        if (secondAvg < firstAvg * 0.9) return 'decreasing';
        return 'stable';
    }

    /**
     * 기본 통계 모달을 닫습니다.
     */
    closeBasicStatsModal() {
        if (this.basicStatsModal) {
            this.uiManager.closeModal(this.basicStatsModal);
        }
    }

    /**
     * 스팸 분석 모달을 닫습니다.
     */
    closeSpamAnalysisModal() {
        if (this.spamAnalysisModal) {
            this.uiManager.closeModal(this.spamAnalysisModal);
        }
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
}

export default AnalysisManager;