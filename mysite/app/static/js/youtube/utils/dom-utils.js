/**
 * @fileoverview DOM(Document Object Model) 요소를 조작하고 관리하는 유틸리티 함수들을 제공합니다.
 * 요소 찾기, 클래스 조작, 콘텐츠 설정, 로컬 스토리지 상호작용 등을 포함합니다.
 */

class DomUtils {
    /**
     * ID를 사용하여 단일 DOM 요소를 가져옵니다.
     * @param {string} id - 찾을 요소의 ID.
     * @returns {HTMLElement|null} 찾은 요소 또는 null.
     */
    static getElementById(id) {
        return document.getElementById(id);
    }

    /**
     * CSS 선택자를 사용하여 첫 번째 일치하는 DOM 요소를 가져옵니다.
     * @param {string} selector - CSS 선택자.
     * @returns {HTMLElement|null} 찾은 요소 또는 null.
     */
    static querySelector(selector) {
        return document.querySelector(selector);
    }

    /**
     * CSS 선택자를 사용하여 모든 일치하는 DOM 요소의 NodeList를 가져옵니다.
     * @param {string} selector - CSS 선택자.
     * @returns {NodeListOf<HTMLElement>} 찾은 요소들의 NodeList.
     */
    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * 요소에 CSS 클래스를 추가합니다.
     * @param {HTMLElement} element - 클래스를 추가할 요소.
     * @param {string} className - 추가할 클래스 이름.
     */
    static addClass(element, className) {
        if (element) {
            element.classList.add(className);
        }
    }

    /**
     * 요소에서 CSS 클래스를 제거합니다.
     * @param {HTMLElement} element - 클래스를 제거할 요소.
     * @param {string} className - 제거할 클래스 이름.
     */
    static removeClass(element, className) {
        if (element) {
            element.classList.remove(className);
        }
    }

    /**
     * 요소에 CSS 클래스가 있는지 확인합니다.
     * @param {HTMLElement} element - 확인할 요소.
     * @param {string} className - 확인할 클래스 이름.
     * @returns {boolean} 클래스 존재 여부.
     */
    static hasClass(element, className) {
        return element ? element.classList.contains(className) : false;
    }

    /**
     * 요소의 텍스트 콘텐츠를 설정합니다.
     * @param {HTMLElement} element - 텍스트를 설정할 요소.
     * @param {string} text - 설정할 텍스트.
     */
    static setTextContent(element, text) {
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * 요소의 innerHTML 콘텐츠를 설정합니다.
     * @param {HTMLElement} element - innerHTML을 설정할 요소.
     * @param {string} html - 설정할 HTML 문자열.
     */
    static setInnerHTML(element, html) {
        if (element) {
            element.innerHTML = html;
        }
    }

    /**
     * 요소를 보이게 합니다 (display: block).
     * @param {HTMLElement} element - 보일 요소.
     */
    static showElement(element) {
        if (element) {
            element.style.display = 'block';
        }
    }

    /**
     * 요소를 숨깁니다 (display: none).
     * @param {HTMLElement} element - 숨길 요소.
     */
    static hideElement(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    /**
     * 로컬 스토리지에 데이터를 저장합니다.
     * @param {string} key - 데이터 키.
     * @param {any} value - 저장할 데이터.
     */
    static saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('로컬 스토리지에 저장 실패:', e);
        }
    }

    /**
     * 로컬 스토리지에서 데이터를 로드합니다.
     * @param {string} key - 데이터 키.
     * @param {any} defaultValue - 데이터를 찾지 못했을 때 반환할 기본값.
     * @returns {any} 로드된 데이터 또는 기본값.
     */
    static loadFromLocalStorage(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('로컬 스토리지에서 로드 실패:', e);
            return defaultValue;
        }
    }

    /**
     * 로컬 스토리지에서 데이터를 제거합니다.
     * @param {string} key - 제거할 데이터 키.
     */
    static removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('로컬 스토리지에서 제거 실패:', e);
        }
    }

    /**
     * 비디오 ID를 기반으로 YouTube 비디오를 새 탭에서 엽니다.
     * @param {string} videoId - YouTube 비디오 ID.
     */
    static openVideo(videoId) {
        if (videoId) {
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        } else {
            console.warn('비디오 ID가 없어 비디오를 열 수 없습니다.');
        }
    }

    /**
     * 텍스트를 클립보드에 복사합니다.
     * @param {string} text - 복사할 텍스트.
     * @returns {Promise<void>} 클립보드 복사 작업이 완료되면 resolve되는 Promise.
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            console.log('클립보드에 복사되었습니다:', text);
        } catch (err) {
            console.error('클립보드 복사 실패:', err);
            throw err; // 실패 시 에러를 다시 던져서 호출자에게 알림
        }
    }

    /**
     * 선택된 요소들의 개수를 카운트합니다
     * @param {string} selector - CSS 선택자
     * @returns {number} 선택된 요소 개수
     */
    static countSelected(selector) {
        return document.querySelectorAll(selector + ':checked').length;
    }

    /**
     * 라디오 버튼의 선택된 값을 가져옵니다
     * @param {string} name - 라디오 버튼 name 속성
     * @returns {string|null} 선택된 값
     */
    static getRadioValue(name) {
        const radio = document.querySelector(`input[name="${name}"]:checked`);
        return radio ? radio.value : null;
    }
}

export default DomUtils;