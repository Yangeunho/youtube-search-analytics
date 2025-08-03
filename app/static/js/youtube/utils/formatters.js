/**
 * @fileoverview 데이터 포맷팅 유틸리티 함수들을 제공합니다.
 * 숫자, 시간, 날짜, 텍스트 등을 사용자 친화적인 형식으로 변환합니다.
 */

class Formatters {
    /**
     * 숫자를 K, M, B 단위로 포맷팅합니다. (조회수, 좋아요, 댓글용)
     * @param {number|string|null|undefined} num - 포맷팅할 숫자.
     * @returns {string} 포맷팅된 문자열.
     */
    static formatNumber(num) {
        if (num === null || typeof num === 'undefined' || isNaN(num)) return '0';
        const number = parseInt(num, 10);
        if (number >= 1000000000) return (number / 1000000000).toFixed(1) + 'B';
        if (number >= 1000000) return (number / 1000000).toFixed(1) + 'M';
        if (number >= 1000) return (number / 1000).toFixed(1) + 'K';
        return number.toString(); // 천 단위 구분자 제거, 숫자 그대로 표시
    }

    /**
     * ISO 8601 형식의 기간 문자열을 'HH:MM:SS' 또는 'MM:SS' 형식으로 포맷팅합니다.
     * 예: PT1H2M3S -> 1:02:03, PT3M5S -> 3:05
     * @param {string} duration - ISO 8601 기간 문자열 (예: PT1H2M3S).
     * @returns {string} 포맷팅된 시간 문자열.
     */
    static formatDuration(duration) {
        if (!duration) return '00:00';

        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '00:00';

        const hours = parseInt(match[1] || 0, 10);
        const minutes = parseInt(match[2] || 0, 10);
        const seconds = parseInt(match[3] || 0, 10);

        let formatted = '';
        if (hours > 0) {
            formatted += `${hours}:`;
        }
        formatted += `${minutes.toString().padStart(2, '0')}:`;
        formatted += seconds.toString().padStart(2, '0');

        return formatted;
    }

    /**
     * ISO 8601 기간 문자열을 초 단위로 파싱합니다.
     * @param {string} duration - ISO 8601 기간 문자열.
     * @returns {number} 총 초.
     */

    /**
     * ISO 8601 날짜/시간 문자열을 'YYYY-MM-DD HH:MM' 형식으로 포맷팅합니다.
     * @param {string} isoString - ISO 8601 날짜/시간 문자열.
     * @returns {string} 포맷팅된 날짜/시간 문자열.
     */
    static formatDateTime(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch (error) {
            console.error('날짜/시간 포맷팅 오류:', error);
            return '';
        }
    }

    /**
     * ISO 8601 날짜 문자열을 'YYYY-MM-DD' 형식으로 포맷팅합니다.
     * @param {string} isoString - ISO 8601 날짜 문자열.
     * @returns {string} 포맷팅된 날짜 문자열.
     */
    static formatDate(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('날짜 포맷팅 오류:', error);
            return '';
        }
    }

    /**
     * ISO 8601 날짜/시간 문자열을 상대적 시간으로 포맷팅합니다.
     * 예: "2시간 전", "3일 전", "1년 전"
     * @param {string} isoString - ISO 8601 날짜/시간 문자열.
     * @returns {string} 상대적 시간 문자열.
     */
    static formatRelativeTime(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);
            const diffWeeks = Math.floor(diffDays / 7);
            const diffMonths = Math.floor(diffDays / 30);
            const diffYears = Math.floor(diffDays / 365);

            if (diffYears > 0) return `${diffYears}년 전`;
            if (diffMonths > 0) return `${diffMonths}개월 전`;
            if (diffWeeks > 0) return `${diffWeeks}주 전`;
            if (diffDays > 0) return `${diffDays}일 전`;
            if (diffHours > 0) return `${diffHours}시간 전`;
            if (diffMinutes > 0) return `${diffMinutes}분 전`;
            if (diffSeconds > 30) return `${diffSeconds}초 전`;
            return '방금 전';
        } catch (error) {
            console.error('상대적 시간 포맷팅 오류:', error);
            return '';
        }
    }

    /**
     * 텍스트가 너무 길 경우 잘라내고 '...'을 추가합니다.
     * @param {string} text - 원본 텍스트.
     * @param {number} maxLength - 최대 길이.
     * @returns {string} 잘라낸 텍스트.
     */
    
    static truncateText(text, maxLength) {
        if (!text || typeof text !== 'string') return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * 백엔드에서 계산된 영상떡상률을 표시용으로 포맷팅합니다.
     * @param {number} rate - 백엔드에서 계산된 떡상률 (조회수/일)
     * @returns {string} 포맷팅된 문자열
     */
    static formatVideoAccelerationRate(rate) {
        if (rate === null || rate === undefined) {
            return 'N/A';
        }
        const numRate = Number(rate);
        if (isNaN(numRate)) {  // ✅ 추가
            return 'N/A';
        }
        return numRate.toFixed(2);
    }
    
    /**
     * 백엔드에서 계산된 채널성장률을 표시용으로 포맷팅합니다. (K 단위, 소수점 2자리)
     * @param {number} rate - 백엔드에서 계산된 성장률 (구독자수/일)
     * @returns {string} 포맷팅된 문자열
     */
    static formatChannelAccelerationRate(rate) {
        if (rate === null || rate === undefined || isNaN(rate)) {
            return '0.00K';
        }
        const numRate = Number(rate);
        if (isNaN(numRate)) {
            return '0.00K';
        }
        
        // 모든 값을 K 단위로 표시, 소수점 2자리
        const kValue = numRate / 1000;
        return kValue.toFixed(2) + 'K';
    }

    /**
     * 영상 떡상율을 K 단위로 포맷팅합니다 (모든 값을 K로 통일).
     * @param {number} rate - 백엔드에서 계산된 떡상률 (조회수/일)
     * @returns {string} K 단위로 포맷팅된 문자열
     */
    static formatVideoRate(rate) {
        if (rate === null || typeof rate === 'undefined' || isNaN(rate)) {
            return '0K';
        }
        
        const number = parseFloat(rate);
        const kValue = Math.abs(number) / 1000;
        const isNegative = number < 0;
        
        let result;
        if (kValue >= 100) {
            result = Math.round(kValue) + 'K';
        } else if (kValue >= 10) {
            result = kValue.toFixed(1) + 'K';
        } else {
            result = kValue.toFixed(2) + 'K';
        }
        
        return isNegative ? '-' + result : result;
    }
    
    /**
     * 파일 크기를 사람이 읽기 쉬운 형식으로 포맷팅합니다.
     * @param {number} bytes - 바이트 수.
     * @param {number} decimals - 소수점 자릿수 (기본값: 2).
     * @returns {string} 포맷팅된 파일 크기 문자열.
     */

    static formatFileSize(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * 퍼센트 값을 포맷팅합니다.
     * @param {number} value - 퍼센트 값 (0-1 또는 0-100).
     * @param {number} decimals - 소수점 자릿수 (기본값: 1).
     * @param {boolean} isDecimal - 입력값이 소수점 형태인지 여부 (기본값: false).
     * @returns {string} 포맷팅된 퍼센트 문자열.
     */
    static formatPercent(value, decimals = 1, isDecimal = false) {
        if (typeof value !== 'number' || isNaN(value)) return '0%';
        
        const percent = isDecimal ? value * 100 : value;
        return percent.toFixed(decimals) + '%';
    }

    /**
     * 통화를 포맷팅합니다.
     * @param {number} amount - 금액.
     * @param {string} currency - 통화 코드 (기본값: 'KRW').
     * @param {string} locale - 로케일 (기본값: 'ko-KR').
     * @returns {string} 포맷팅된 통화 문자열.
     */
    static formatCurrency(amount, currency = 'KRW', locale = 'ko-KR') {
        if (typeof amount !== 'number' || isNaN(amount)) return '₩0';
        
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (error) {
            console.error('통화 포맷팅 오류:', error);
            return `₩${amount.toLocaleString()}`;
        }
    }

    /**
     * URL을 안전하게 포맷팅합니다.
     * @param {string} url - 원본 URL.
     * @param {number} maxLength - 최대 길이 (기본값: 50).
     * @returns {string} 포맷팅된 URL.
     */
    static formatUrl(url, maxLength = 50) {
        if (!url || typeof url !== 'string') return '';
        
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const path = urlObj.pathname + urlObj.search;
            
            if (domain.length + path.length <= maxLength) {
                return domain + path;
            }
            
            const availablePathLength = maxLength - domain.length - 3; // 3 for '...'
            if (availablePathLength > 0) {
                return domain + this.truncateText(path, availablePathLength);
            }
            
            return this.truncateText(domain, maxLength);
        } catch (error) {
            return this.truncateText(url, maxLength);
        }
    }

    /**
     * 선택 정보를 포맷팅합니다.
     * @param {number} selectedCount - 선택된 개수
     * @param {number} totalCount - 전체 개수
     * @returns {string} 포맷팅된 선택 정보
     */
    static formatSelectionInfo(selectedCount, totalCount) {
        if (selectedCount === 0) {
            return `전체 ${totalCount}개`;
        }
        return `선택된 ${selectedCount}개 (전체 ${totalCount}개)`;
    }

    /**
     * 분석 범위를 포맷팅합니다.
     * @param {string} mode - 분석 모드 ('all' 또는 'selected')
     * @param {number} count - 분석 대상 개수
     * @returns {string} 포맷팅된 분석 범위
     */
    static formatAnalysisScope(mode, count) {
        const emoji = mode === 'selected' ? '✅' : '📊';
        const text = mode === 'selected' ? '선택 항목만' : '전체 분석';
        return `${emoji} ${text} (${count}개)`;
    }
}

export default Formatters;