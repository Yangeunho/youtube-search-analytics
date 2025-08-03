/**
 * @fileoverview 브라우저 localStorage 기반 사용량 추적 시스템
 * IP 기반 서버 추적을 대체하여 더 빠르고 안정적인 체험 사용량 관리
 */

class BrowserUsageTracker {
    constructor() {
        // 🔧 설정값 (기존과 동일하게 유지)
        this.dailyLimit = 5;  // 일일 체험 검색 한도
        this.resetTime = { hour: 9, minute: 30 };  // YouTube API 할당량 초기화 시간
        
        // 🚀 캐시 최적화
        this._todayKeyCache = null;
        this._todayKeyCacheTime = 0;
        this._cacheValidTime = 60000; // 1분간 캐시 유효
        
        // 초기화 시 오래된 데이터 정리
        this._cleanupOldData();
        
        console.log('🚀 BrowserUsageTracker 초기화 완료');
    }

    /**
     * 오늘 날짜 키 생성 (YouTube API 할당량 초기화 스케줄 기준)
     * 오전 9시 30분 이전이면 어제 날짜 사용
     */
    _getTodayKey() {
        const now = Date.now();
        
        // 🚀 캐시 확인 (성능 최적화)
        if (this._todayKeyCache && (now - this._todayKeyCacheTime) < this._cacheValidTime) {
            return this._todayKeyCache;
        }
        
        const currentDate = new Date();
        const resetTime = new Date();
        resetTime.setHours(this.resetTime.hour, this.resetTime.minute, 0, 0);

        // 오전 9시 30분 이전이면 어제 날짜 사용
        let targetDate;
        if (currentDate < resetTime) {
            targetDate = new Date(currentDate);
            targetDate.setDate(targetDate.getDate() - 1);
        } else {
            targetDate = currentDate;
        }
        
        const key = `youtube_usage_${targetDate.toDateString()}`;
        
        // 🚀 캐시 저장
        this._todayKeyCache = key;
        this._todayKeyCacheTime = now;
        
        return key;
    }

    /**
     * 현재 사용량 조회
     * @returns {number} 현재 사용 횟수 (0-5)
     */
    getUsageCount() {
        try {
            const key = this._getTodayKey();
            const stored = localStorage.getItem(key);
            const count = parseInt(stored || '0');
            
            // 🔒 안전성 검증
            if (isNaN(count) || count < 0) {
                console.warn('잘못된 사용량 데이터 감지, 초기화:', stored);
                this._setUsageCount(0);
                return 0;
            }
            
            // 🔒 한도 초과 데이터 수정
            if (count > this.dailyLimit) {
                console.warn('한도 초과 데이터 감지, 한도로 조정:', count);
                this._setUsageCount(this.dailyLimit);
                return this.dailyLimit;
            }
            
            return count;
        } catch (error) {
            console.error('사용량 조회 실패:', error);
            return 0;
        }
    }

    /**
     * 사용량 설정 (내부 메서드)
     * @private
     * @param {number} count - 설정할 사용량
     */
    _setUsageCount(count) {
        try {
            const key = this._getTodayKey();
            const validCount = Math.max(0, Math.min(count, this.dailyLimit));
            localStorage.setItem(key, validCount.toString());
        } catch (error) {
            console.error('사용량 저장 실패:', error);
        }
    }

    /**
     * 검색 가능 여부 확인
     * @returns {boolean} 검색 가능 여부
     */
    canSearch() {
        return this.getUsageCount() < this.dailyLimit;
    }

    /**
     * 남은 검색 횟수 조회
     * @returns {number} 남은 횟수 (0-5)
     */
    getRemainingCount() {
        return Math.max(0, this.dailyLimit - this.getUsageCount());
    }

    /**
     * 사용량 증가 (검색 실행 후 호출)
     * @returns {number} 남은 횟수
     * @throws {Error} 한도 초과 시
     */
    incrementUsage() {
        const currentUsage = this.getUsageCount();
        
        if (currentUsage >= this.dailyLimit) {
            throw new Error(`일일 체험 한도(${this.dailyLimit}회)를 초과했습니다.`);
        }

        const newUsage = currentUsage + 1;
        this._setUsageCount(newUsage);
        
        // 🧹 사용량 증가 시 오래된 데이터 정리 (성능 최적화)
        if (newUsage === 1) { // 하루 첫 사용 시에만
            this._cleanupOldData();
        }
        
        const remaining = this.getRemainingCount();
        console.log(`📊 사용량 증가: ${newUsage}/${this.dailyLimit}, 남은 횟수: ${remaining}회`);
        
        return remaining;
    }

    /**
     * 오래된 localStorage 데이터 정리 (7일 이전)
     * @private
     */
    _cleanupOldData() {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith('youtube_usage_')
            );
            
            if (keys.length === 0) return;
            
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            let cleanedCount = 0;
            keys.forEach(key => {
                try {
                    const dateStr = key.replace('youtube_usage_', '');
                    const date = new Date(dateStr);
                    
                    if (isNaN(date.getTime()) || date < sevenDaysAgo) {
                        localStorage.removeItem(key);
                        cleanedCount++;
                    }
                } catch (e) {
                    // 잘못된 형식의 키는 제거
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`🧹 오래된 사용량 데이터 정리: ${cleanedCount}개 항목 제거`);
            }
        } catch (error) {
            console.error('데이터 정리 실패:', error);
        }
    }

    /**
     * 다음 리셋 시간 계산
     * @returns {Date} 다음 리셋 시간
     */
    getNextResetTime() {
        const now = new Date();
        const nextReset = new Date();
        nextReset.setHours(this.resetTime.hour, this.resetTime.minute, 0, 0);
        
        // 오늘 리셋 시간이 지났으면 내일로
        if (now >= nextReset) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        return nextReset;
    }

    /**
     * 상태 정보 반환 (기존 API와 호환)
     * @returns {Object} 사용량 상태 정보
     */
    getStatus() {
        const usageCount = this.getUsageCount();
        const remainingCount = this.getRemainingCount();
        const canSearch = this.canSearch();
        
        return {
            // 🔄 기존 API와 호환되는 형식
            user_remaining_searches: remainingCount,
            user_usage_count: usageCount,
            daily_limit: this.dailyLimit,
            can_use_server_key: canSearch,
            has_active_server_keys: true, // 브라우저 기반에서는 항상 true
            
            // 🆕 추가 정보
            canSearch: canSearch,
            usageCount: usageCount,
            remainingCount: remainingCount,
            resetTime: this.getNextResetTime().toLocaleString('ko-KR'),
            isLocalStorage: true // 브라우저 저장소 기반임을 표시
        };
    }

    /**
     * 강제 리셋 (개발/테스트용)
     * @returns {boolean} 성공 여부
     */
    reset() {
        try {
            const key = this._getTodayKey();
            localStorage.removeItem(key);
            
            // 캐시 무효화
            this._todayKeyCache = null;
            this._todayKeyCacheTime = 0;
            
            console.log('🔄 사용량 리셋 완료');
            return true;
        } catch (error) {
            console.error('사용량 리셋 실패:', error);
            return false;
        }
    }

    /**
     * 디버그 정보 반환
     * @returns {Object} 디버그 정보
     */
    getDebugInfo() {
        return {
            todayKey: this._getTodayKey(),
            storedValue: localStorage.getItem(this._getTodayKey()),
            usageCount: this.getUsageCount(),
            remainingCount: this.getRemainingCount(),
            canSearch: this.canSearch(),
            cacheValid: this._todayKeyCache !== null,
            nextResetTime: this.getNextResetTime(),
            allStorageKeys: Object.keys(localStorage).filter(key => 
                key.startsWith('youtube_usage_')
            )
        };
    }
}

// 🚀 전역 인스턴스 (싱글톤 패턴)
const browserUsageTracker = new BrowserUsageTracker();

export default browserUsageTracker;