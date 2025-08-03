/**
 * @fileoverview YouTube 데이터 계산 관련 유틸리티
 * 백엔드 Python 로직을 JavaScript로 변환한 계산 함수들
 */

class YouTubeCalculations {
    /**
     * 떡상률 계산: (조회수/구독자수)/업로드경과일수
     * 백엔드 _calculate_daily_rate() 함수와 동일한 로직 - 여러 날짜 형식 지원
     * @param {string} publishedAtStr - 업로드 날짜 문자열
     * @param {string|number} countStr - 조회수 문자열 또는 숫자
     * @param {string|number} subscriberCountStr - 구독자수 문자열 또는 숫자 (선택)
     * @returns {number} 계산된 떡상률
     */
    static calculateDailyRate(publishedAtStr, countStr, subscriberCountStr = null) {
        if (!publishedAtStr || !countStr) {
            return 0;
        }

        try {
            // 백엔드와 동일한 여러 날짜 형식을 순서대로 시도
            const dateFormats = [
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,           // 2023-01-01T12:00:00Z
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,            // 2023-01-01T12:00:00
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/,      // 2023-01-01T12:00:00.123456Z
                /^\d{4}-\d{2}-\d{2}$/,                              // 2023-01-01
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, // 2023-01-01T12:00:00+09:00
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+$/,       // 2023-01-01T12:00:00.123456
            ];
            
            let publishDate = null;
            
            // 백엔드와 동일하게 여러 형식으로 파싱 시도
            for (const format of dateFormats) {
                if (format.test(publishedAtStr)) {
                    publishDate = new Date(publishedAtStr);
                    if (!isNaN(publishDate.getTime())) {
                        break;
                    }
                }
            }
            
            // 모든 형식이 실패하면 JavaScript Date()로 한번 더 시도 (백엔드의 dateutil.parser와 유사)
            if (publishDate === null || isNaN(publishDate.getTime())) {
                publishDate = new Date(publishedAtStr);
                if (isNaN(publishDate.getTime())) {
                    console.warn(`Failed to parse date: ${publishedAtStr}`);
                    return 0;
                }
            }
            
            const now = new Date();
            
            // 백엔드와 동일하게 시간대 정보가 있는 경우 UTC로 변환
            // JavaScript Date는 자동으로 로컬 시간대를 처리하므로 UTC로 정규화
            if (publishedAtStr.includes('+') || publishedAtStr.includes('Z')) {
                // 이미 시간대 정보가 포함된 경우, UTC 시간으로 처리
                publishDate = new Date(publishDate.getTime() - publishDate.getTimezoneOffset() * 60000);
            }
            
            // 미래 날짜인 경우 0 반환 (백엔드와 동일)
            if (publishDate > now) {
                return 0;
            }
            
            // 경과 일수 계산 (백엔드와 동일한 방식)
            let diffDays = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
            const numericalCount = this.safeParseInt(countStr);

            if (diffDays <= 0 || numericalCount < 0) {
                return 0;
            }
            
            // 백엔드와 동일한 0으로 나누기 방지 (1분 미만인 경우)
            if (diffDays < 0.001) {  // 1분 미만인 경우
                diffDays = 0.001;
            }
            
            let dailyRate;
            
            // 백엔드와 동일한 구독자수 고려한 떡상률 계산 -> (조회수/구독자수)/등록경과일수
            if (subscriberCountStr && subscriberCountStr !== '0') {
                try {
                    const subscriberCount = parseInt(subscriberCountStr);
                    if (subscriberCount > 0) {  // 0으로 나누기 방지
                        const viewPerSubscriber = numericalCount / subscriberCount;
                        dailyRate = viewPerSubscriber / diffDays;
                    } else {
                        dailyRate = numericalCount / diffDays;
                    }
                } catch (error) {
                    // 구독자수 파싱 실패시 기존 방식 사용 (백엔드와 동일)
                    dailyRate = numericalCount / diffDays;
                }
            } else {
                // 구독자수가 없거나 0인 경우 -> 조회수/등록경과일수 (백엔드와 동일)
                dailyRate = numericalCount / diffDays;
            }
            
            // 백엔드와 동일한 비정상적으로 큰 값 방지
            if (dailyRate > 1000000) {  // 일일 100만 이상은 비정상
                console.warn(`Abnormally high daily rate: ${dailyRate} for count: ${numericalCount}, days: ${diffDays}`);
                return Math.min(dailyRate, 1000000);
            }
            
            return dailyRate;
            
        } catch (error) {
            console.warn(`Failed to calculate daily rate for ${publishedAtStr}, ${countStr}. Error:`, error);
            return 0;
        }
    }

    /**
     * ISO 8601 duration을 초로 변환
     * 백엔드 _parse_duration_to_seconds() 함수와 동일한 로직
     * @param {string} durationStr - ISO 8601 형식의 duration (예: "PT15M33S", "PT1H30M45S")
     * @returns {number} 초 단위로 변환된 시간
     */
    static parseDurationToSeconds(durationStr) {
        if (!durationStr) {
            return 0;
        }
        
        const pattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const match = durationStr.match(pattern);
        
        if (!match) {
            console.warn(`Invalid duration format: ${durationStr}`);
            return 0;
        }
        
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        console.debug(`Duration parsed: ${durationStr} -> ${totalSeconds}초`);
        
        return totalSeconds;
    }

    /**
     * 확산률 계산: 조회수 / 구독자수
     * 백엔드 _calculate_growth_ratio() 함수와 동일한 로직
     * @param {string|number} viewCountStr - 조회수 문자열 또는 숫자
     * @param {string|number} subscriberCountStr - 구독자수 문자열 또는 숫자
     * @returns {number} 계산된 확산률
     */
    static calculateGrowthRatio(viewCountStr, subscriberCountStr) {
        try {
            if (!viewCountStr || !subscriberCountStr) {
                return 0;
            }
            
            const viewCount = parseInt(viewCountStr);
            const subscriberCount = parseInt(subscriberCountStr);
            
            if (subscriberCount <= 0) {
                return 0;
            }
            
            const growthRatio = viewCount / subscriberCount;
            
            // 비정상적으로 큰 값 방지 (백엔드와 동일한 상한선)
            if (growthRatio > 10000) {  // 구독자 대비 조회수가 1만배 이상은 비정상
                console.debug(`Growth ratio capped at 10000: ${growthRatio.toFixed(2)} (view: ${viewCount}, subscriber: ${subscriberCount})`);
                return Math.min(growthRatio, 10000);
            }
            
            return growthRatio;
            
        } catch (error) {
            console.warn(`Failed to calculate growth ratio for ${viewCountStr}, ${subscriberCountStr}. Error:`, error);
            return 0;
        }
    }

    /**
     * 비디오 데이터에 떡상률과 확산률을 추가하는 헬퍼 함수
     * @param {object} video - 비디오 데이터 객체
     * @param {object} channelInfo - 채널 정보 객체
     * @returns {object} 계산된 값이 추가된 비디오 데이터
     */
    static enrichVideoWithCalculations(video, channelInfo = {}) {
        if (!video || !video.snippet || !video.statistics) {
            return video;
        }

        // 떡상률 계산: (조회수/구독자수)/업로드경과일수
        const publishedAt = video.snippet.publishedAt;
        const viewCount = video.statistics.viewCount || '0';
        const subscriberCount = channelInfo.statistics?.subscriberCount || '0';

        const dailyRate = this.calculateDailyRate(publishedAt, viewCount, subscriberCount);
        const growthRatio = this.calculateGrowthRatio(viewCount, subscriberCount);

        // 백엔드와 동일한 필드명 사용
        video.rawVideoAccelerationRate = dailyRate;
        video.rawChannelAccelerationRate = growthRatio;

        return video;
    }

    /**
     * 다수의 비디오 데이터에 계산값을 일괄 추가
     * @param {Array<object>} videos - 비디오 데이터 배열
     * @param {object} channelsDict - 채널 ID를 키로 하는 채널 정보 딕셔너리
     * @returns {Array<object>} 계산값이 추가된 비디오 데이터 배열
     */
    static enrichVideosWithCalculations(videos, channelsDict = {}) {
        if (!Array.isArray(videos)) {
            return videos;
        }

        return videos.map(video => {
            const channelId = video.snippet?.channelId;
            const channelInfo = channelsDict[channelId] || {};
            return this.enrichVideoWithCalculations(video, channelInfo);
        });
    }

    /**
     * 날짜 문자열 유효성 검증
     * @param {string} dateStr - 검증할 날짜 문자열
     * @returns {boolean} 유효성 여부
     */
    static isValidDateString(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return false;
        }
        
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    }

    /**
     * 숫자 문자열을 안전하게 정수로 변환
     * @param {string|number} value - 변환할 값
     * @param {number} defaultValue - 기본값 (기본: 0)
     * @returns {number} 변환된 정수
     */
    static safeParseInt(value, defaultValue = 0) {
        if (value === null || value === undefined || value === '') {
            return defaultValue;
        }
        
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * 디버그 정보 출력
     * @param {string} publishedAt - 업로드 날짜
     * @param {string|number} viewCount - 조회수
     * @param {string|number} subscriberCount - 구독자수
     * @returns {object} 디버그 정보 객체
     */
    static getCalculationDebugInfo(publishedAt, viewCount, subscriberCount) {
        const now = new Date();
        const publishDate = new Date(publishedAt);
        const diffDays = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
        
        return {
            publishedAt: publishedAt,
            publishDate: publishDate.toISOString(),
            currentTime: now.toISOString(),
            diffDays: diffDays,
            viewCount: parseInt(viewCount),
            subscriberCount: parseInt(subscriberCount),
            dailyRate: this.calculateDailyRate(publishedAt, viewCount, subscriberCount),
            growthRatio: this.calculateGrowthRatio(viewCount, subscriberCount)
        };
    }
}

export default YouTubeCalculations;