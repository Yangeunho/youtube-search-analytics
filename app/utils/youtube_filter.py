import re
import logging
from typing import List, Dict, Any, Optional
import datetime

# 로깅 설정
logger = logging.getLogger(__name__)

# 필터링 설정 (외부에서 쉽게 수정 가능)
FILTER_CONFIG = {
    # 제외할 키워드들 (제목 및 설명에서)
    'exclude_keywords': ['쇼츠', 'shorts', '#shorts'],
    
    # 제외할 채널 ID들
    'exclude_channel_ids': [
        # 'UC_YOUR_EXCLUDE_CHANNEL_ID_HERE',  # 예시
    ],
    
    # 최소 설명 길이
    'min_description_length': 10,
    
    # 최소 제목 길이
    'min_title_length': 5,
    
    # 제외할 카테고리 ID들 (필요시 추가)
    'exclude_category_ids': [],
    
    # 한국어 콘텐츠만 허용할지 여부
    'korean_only': False,
    
    # 최소 조회수 (기본값)
    'min_view_count': 0,
    
    # 최소 좋아요 수 (기본값)
    'min_like_count': 0,

    # 최소 구독자 수 (기본값) - 추가
    'min_subscriber_count': 0, 

    # 채널 개설 연도 (기본값 0: 필터링 안함) - 추가
    'channel_year': 0,
}

def filter_youtube_results(items: List[Dict[str, Any]], 
                          custom_config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    YouTube 검색 결과 아이템 목록을 필터링하는 함수입니다.
    
    Args:
        items (List[Dict]): YouTube API에서 반환된 동영상 검색 결과 아이템들의 리스트.
        custom_config (Dict, optional): 커스텀 필터링 설정. 기본값은 FILTER_CONFIG 사용.

    Returns:
        List[Dict]: 필터링 조건을 만족하는 동영상 아이템들의 리스트.
        
    Raises:
        TypeError: items가 리스트가 아닌 경우
        ValueError: items가 빈 리스트이거나 잘못된 구조인 경우
    """
    # 입력 검증
    if not isinstance(items, list):
        logger.error("필터링 입력 오류: items는 리스트 타입이어야 합니다.")
        raise TypeError("items는 리스트 타입이어야 합니다.")
    
    if not items:
        logger.info("필터링 대상이 없습니다 (빈 리스트)")
        return []  # 빈 리스트는 그대로 반환
    
    # 설정 병합 (커스텀 설정이 있으면 기본 설정을 덮어씀)
    config = FILTER_CONFIG.copy()
    if custom_config:
        config.update(custom_config)
        logger.debug(f"커스텀 필터 설정 적용: {custom_config}")
    
    filtered_items = []
    original_count = len(items)
    
    try:
        for item in items:
            if _should_include_item(item, config):
                filtered_items.append(item)
                
        logger.info(f"필터링 완료: {original_count}개 -> {len(filtered_items)}개")
        
    except Exception as e:
        logger.error(f"필터링 중 오류 발생: {str(e)}")
        # 오류 발생 시 원본 리스트 반환 (안전장치)
        return items
    
    return filtered_items

def _should_include_item(item: Dict[str, Any], config: Dict[str, Any]) -> bool:
    """
    개별 아이템이 필터링 조건을 만족하는지 확인합니다.
    
    Args:
        item (Dict): YouTube 동영상 아이템
        config (Dict): 필터링 설정
        
    Returns:
        bool: 포함할지 여부
    """
    try:
        snippet = item.get('snippet', {})
        channel_snippet = item.get('channelSnippet', {}) # channelSnippet 추가
        channel_statistics = item.get('channelStatistics', {}) # channelStatistics 추가
        
        # 기본 정보 추출 및 안전한 처리
        title = snippet.get('title', '').strip()
        description = snippet.get('description', '').strip()
        channel_id = snippet.get('channelId', '')
        channel_title = snippet.get('channelTitle', '').strip()
        
        # 1. 기본 데이터 유효성 검사
        if not title or not channel_id:
            logger.debug(f"기본 데이터 누락: title={bool(title)}, channel_id={bool(channel_id)}")
            return False
        
        # 2. 제목 길이 필터
        min_title_length = config.get('min_title_length', 5)
        if len(title) < min_title_length:
            logger.debug(f"제목 길이 부족: '{title}' ({len(title)} < {min_title_length})")
            return False
        
        # 3. 설명 길이 필터
        min_desc_length = config.get('min_description_length', 10)
        if len(description) < min_desc_length:
            logger.debug(f"설명 길이 부족: {len(description)} < {min_desc_length}")
            return False
        
        # 4. 제외 키워드 필터 (대소문자 구분 없음)
        title_lower = title.lower()
        description_lower = description.lower()
        
        exclude_keywords = config.get('exclude_keywords', [])
        for keyword in exclude_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in title_lower or keyword_lower in description_lower:
                logger.debug(f"제외 키워드 발견: '{keyword}' in '{title}'")
                return False
        
        # 5. 제외 채널 필터
        exclude_channels = config.get('exclude_channel_ids', [])
        if channel_id in exclude_channels:
            logger.debug(f"제외 채널: {channel_title} ({channel_id})")
            return False
        
        # 6. 한국어 콘텐츠 필터 (옵션)
        if config.get('korean_only', False):
            if not _is_korean_content(title, description):
                logger.debug(f"한국어 콘텐츠 아님: '{title}'")
                return False
        
        # 7. 통계 정보 기반 필터링 (있는 경우)
        if 'statistics' in item:
            if not _check_statistics_filter(item['statistics'], config):
                return False

        # 8. 채널 통계 정보 기반 필터링 (새로 추가)
        if 'channelStatistics' in item:
            if not _check_channel_statistics_filter(channel_statistics, config):
                return False

        # 9. 채널 스니펫 (개설일) 기반 필터링 (새로 추가)
        if 'channelSnippet' in item:
            if not _check_channel_snippet_filter(channel_snippet, config):
                return False
        
        # 10. 콘텐츠 세부 정보 기반 필터링 (있는 경우)
        if 'contentDetails' in item:
            if not _check_content_details_filter(item['contentDetails'], config):
                return False
        
        return True
        
    except Exception as e:
        logger.warning(f"아이템 필터링 검사 중 오류: {str(e)}")
        return False  # 오류 발생 시 제외

def _is_korean_content(title: str, description: str) -> bool:
    """한국어 콘텐츠인지 확인합니다."""
    # 한글 유니코드 범위: 가-힣, ㄱ-ㅎ, ㅏ-ㅣ
    korean_pattern = re.compile(r'[가-힣ㄱ-ㅎㅏ-ㅣ]')
    
    # 제목이나 설명에 한글이 포함되어 있는지 확인
    title_korean = bool(korean_pattern.search(title))
    desc_korean = bool(korean_pattern.search(description))
    
    # 제목에 한글이 있거나, 설명에 충분한 한글이 있으면 한국어 콘텐츠로 판단
    if title_korean:
        return True
    
    if desc_korean:
        # 설명에서 한글 비율 계산
        korean_chars = len(korean_pattern.findall(description))
        total_chars = len(description.replace(' ', ''))
        if total_chars > 0:
            korean_ratio = korean_chars / total_chars
            return korean_ratio > 0.1  # 10% 이상이 한글이면 한국어 콘텐츠로 판단
    
    return False

def _check_statistics_filter(statistics: Dict[str, Any], config: Dict[str, Any]) -> bool:
    """통계 정보 기반 필터링을 수행합니다."""
    try:
        # 최소 조회수 필터
        min_views = config.get('min_view_count', 0)
        if min_views > 0:
            view_count = int(statistics.get('viewCount', 0))
            if view_count < min_views:
                logger.debug(f"조회수 부족: {view_count} < {min_views}")
                return False
        
        # 최소 좋아요 수 필터
        min_likes = config.get('min_like_count', 0)
        if min_likes > 0:
            like_count = int(statistics.get('likeCount', 0))
            if like_count < min_likes:
                logger.debug(f"좋아요 수 부족: {like_count} < {min_likes}")
                return False
        
        # 좋아요/싫어요 비율 필터 (옵션)
        min_like_ratio = config.get('min_like_ratio', 0)
        if min_like_ratio > 0:
            like_count = int(statistics.get('likeCount', 0))
            dislike_count = int(statistics.get('dislikeCount', 0))
            
            if like_count + dislike_count > 0:
                like_ratio = like_count / (like_count + dislike_count)
                if like_ratio < min_like_ratio:
                    logger.debug(f"좋아요 비율 부족: {like_ratio:.2f} < {min_like_ratio}")
                    return False
        
        return True
        
    except (ValueError, TypeError) as e:
        logger.warning(f"통계 데이터 파싱 오류: {e}")
        return True  # 통계 데이터 파싱 오류 시 통과

def _check_channel_statistics_filter(channel_statistics: Dict[str, Any], config: Dict[str, Any]) -> bool:
    """채널 통계 정보(구독자 수) 기반 필터링을 수행합니다."""
    try:
        min_subscribers = config.get('min_subscriber_count', 0)
        if min_subscribers > 0:
            subscriber_count = int(channel_statistics.get('subscriberCount', 0))
            if subscriber_count < min_subscribers:
                logger.debug(f"구독자 수 부족: {subscriber_count} < {min_subscribers}")
                return False
        return True
    except (ValueError, TypeError) as e:
        logger.warning(f"채널 통계 데이터 파싱 오류: {e}")
        return True

def _check_channel_snippet_filter(channel_snippet: Dict[str, Any], config: Dict[str, Any]) -> bool:
    """채널 스니펫 정보(개설 연도) 기반 필터링을 수행합니다."""
    try:
        channel_year_filter = config.get('channel_year', 0)
        if channel_year_filter > 0:
            published_at = channel_snippet.get('publishedAt')
            if published_at:
                channel_creation_year = int(published_at.split('-')[0]) # 'YYYY-MM-DD...' ->虜
                if channel_creation_year < channel_year_filter: # 지정된 연도 이전에 개설된 채널 제외 (예: 2020 입력 시 2019년 개설 채널 제외)
                    logger.debug(f"채널 개설 연도 필터: {channel_creation_year} < {channel_year_filter}")
                    return False
            else:
                logger.debug("채널 개설일 정보 없음, 필터링에서 제외")
                return False # 개설일 정보 없으면 필터링 조건 미충족으로 간주
        return True
    except (ValueError, TypeError) as e:
        logger.warning(f"채널 개설 연도 파싱 오류: {e}")
        return True # 파싱 오류 시 통과 (또는 제외 정책에 따라 false)

def _check_content_details_filter(content_details: Dict[str, Any], config: Dict[str, Any]) -> bool:
    """콘텐츠 세부 정보 기반 필터링을 수행합니다."""
    try:
        # 동영상 길이 필터
        duration = content_details.get('duration', '')
        if duration:
            duration_seconds = _parse_duration(duration)
            
            # 최소 길이 필터
            min_duration = config.get('min_duration_seconds', 0)
            if min_duration > 0 and duration_seconds < min_duration:
                logger.debug(f"영상 길이 부족: {duration_seconds}초 < {min_duration}초")
                return False
            
            # 최대 길이 필터
            max_duration = config.get('max_duration_seconds', 0)
            if max_duration > 0 and duration_seconds > max_duration:
                logger.debug(f"영상 길이 초과: {duration_seconds}초 > {max_duration}초")
                return False
        
        return True
        
    except Exception as e:
        logger.warning(f"콘텐츠 세부사항 파싱 오류: {e}")
        return True  # 파싱 오류 시 통과

def _parse_duration(duration: str) -> int:
    """
    ISO 8601 duration 형식을 초 단위로 변환합니다.
    
    Args:
        duration (str): ISO 8601 형식의 duration (예: "PT15M33S")
        
    Returns:
        int: 초 단위로 변환된 시간
        
    Examples:
        >>> _parse_duration("PT15M33S")
        933
        >>> _parse_duration("PT1H30M45S")
        5445
    """
    # PT15M33S -> 933초
    pattern = re.compile(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?')
    match = pattern.match(duration)
    
    if not match:
        logger.warning(f"잘못된 duration 형식: {duration}")
        return 0
    
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    
    total_seconds = hours * 3600 + minutes * 60 + seconds
    logger.debug(f"Duration 파싱: {duration} -> {total_seconds}초")
    
    return total_seconds

# 미리 정의된 필터 프리셋들 (개선된 버전)
FILTER_PRESETS = {
    'strict': {
        'exclude_keywords': ['쇼츠', 'shorts', '#shorts', 'short', 'meme', '밈', 'asmr'],
        'min_description_length': 50,
        'min_title_length': 10,
        'min_view_count': 1000,
        'min_like_count': 50,
        'korean_only': True,
        'min_duration_seconds': 60,  # 1분 이상
    },
    'relaxed': {
        'exclude_keywords': ['쇼츠', 'shorts'],
        'min_description_length': 5,
        'min_title_length': 3,
        'korean_only': False,
        'min_view_count': 0,
    },
    'quality_focused': {
        'min_view_count': 10000,
        'min_like_count': 100,
        'min_like_ratio': 0.8,
        'min_duration_seconds': 300,  # 5분 이상
        'max_duration_seconds': 3600,  # 1시간 이하
        'min_description_length': 100,
    },
    'korean_only': {
        'korean_only': True,
        'exclude_keywords': ['shorts', '#shorts', 'meme'],
        'min_description_length': 20,
        'min_view_count': 100,
    },
    'popular_only': {
        'min_view_count': 50000,
        'min_like_count': 500,
        'min_duration_seconds': 180,  # 3분 이상
        'exclude_keywords': ['쇼츠', 'shorts', '#shorts'],
    },
    'educational': {
        'min_duration_seconds': 300,  # 5분 이상
        'max_duration_seconds': 3600,  # 1시간 이하
        'min_description_length': 100,
        'exclude_keywords': ['쇼츠', 'shorts', 'meme', '밈', 'funny', '웃긴'],
        'min_view_count': 1000,
    }
}

def apply_preset_filter(items: List[Dict[str, Any]], preset_name: str) -> List[Dict[str, Any]]:
    """
    미리 정의된 필터 프리셋을 적용합니다.
    
    Args:
        items: 필터링할 YouTube 비디오 아이템 리스트
        preset_name: 적용할 프리셋 이름
        
    Returns:
        필터링된 아이템 리스트
        
    Raises:
        ValueError: 알 수 없는 프리셋 이름인 경우
    """
    if preset_name not in FILTER_PRESETS:
        available_presets = ', '.join(FILTER_PRESETS.keys())
        raise ValueError(f"알 수 없는 프리셋: {preset_name}. 사용 가능한 프리셋: {available_presets}")
    
    logger.info(f"프리셋 필터 적용: {preset_name}")
    return filter_youtube_results(items, FILTER_PRESETS[preset_name])

def get_filter_statistics(original_items: List[Dict[str, Any]], 
                         filtered_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    필터링 전후의 통계를 계산합니다.
    
    Args:
        original_items: 필터링 전 아이템 리스트
        filtered_items: 필터링 후 아이템 리스트
        
    Returns:
        필터링 통계 정보
    """
    if not original_items:
        return {
            'original_count': 0,
            'filtered_count': 0,
            'filtered_ratio': 0.0,
            'removed_count': 0
        }
    
    original_count = len(original_items)
    filtered_count = len(filtered_items)
    removed_count = original_count - filtered_count
    filtered_ratio = (filtered_count / original_count) * 100 if original_count > 0 else 0.0
    
    return {
        'original_count': original_count,
        'filtered_count': filtered_count,
        'filtered_ratio': round(filtered_ratio, 2),
        'removed_count': removed_count,
        'removal_ratio': round(100 - filtered_ratio, 2)
    }

def validate_filter_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    필터 설정이 유효한지 검증하고 정규화합니다.
    
    Args:
        config: 검증할 필터 설정
        
    Returns:
        검증되고 정규화된 필터 설정
        
    Raises:
        ValueError: 잘못된 설정값이 있는 경우
    """
    validated_config = config.copy()
    
    # 숫자 필드 검증
    numeric_fields = {
        'min_view_count': (0, float('inf')),
        'min_like_count': (0, float('inf')),
        'min_subscriber_count': (0, float('inf')), # 추가
        'min_description_length': (0, 1000),
        'min_title_length': (1, 200),
        'min_duration_seconds': (0, 86400),  # 24시간
        'max_duration_seconds': (1, 86400),
        'min_like_ratio': (0.0, 1.0),
        'channel_year': (0, datetime.date.today().year + 5) # 현재 연도 + 5년까지 허용
    }
    
    for field, (min_val, max_val) in numeric_fields.items():
        if field in validated_config:
            try:
                value = float(validated_config[field])
                if not (min_val <= value <= max_val):
                    raise ValueError(f"{field} 값이 범위를 벗어남: {value} (허용 범위: {min_val}-{max_val})")
                validated_config[field] = int(value) if field != 'min_like_ratio' else value
            except (ValueError, TypeError) as e:
                logger.warning(f"잘못된 {field} 값: {validated_config[field]}, 기본값 사용")
                validated_config[field] = FILTER_CONFIG.get(field, 0)
    
    # 리스트 필드 검증
    list_fields = ['exclude_keywords', 'exclude_channel_ids', 'exclude_category_ids']
    for field in list_fields:
        if field in validated_config:
            if not isinstance(validated_config[field], list):
                logger.warning(f"{field}는 리스트여야 함, 기본값 사용")
                validated_config[field] = FILTER_CONFIG.get(field, [])
    
    # 불린 필드 검증
    boolean_fields = ['korean_only']
    for field in boolean_fields:
        if field in validated_config:
            validated_config[field] = bool(validated_config[field])
    
    # 상호 의존성 검증
    if ('min_duration_seconds' in validated_config and 
        'max_duration_seconds' in validated_config):
        min_dur = validated_config['min_duration_seconds']
        max_dur = validated_config['max_duration_seconds']
        if min_dur >= max_dur:
            logger.warning(f"최소 길이({min_dur})가 최대 길이({max_dur})보다 큼, 최대 길이 조정")
            validated_config['max_duration_seconds'] = min_dur + 60
    
    logger.debug(f"필터 설정 검증 완료: {validated_config}")
    return validated_config

def create_custom_filter(name: str, config: Dict[str, Any]) -> None:
    """
    커스텀 필터 프리셋을 생성합니다.
    
    Args:
        name: 새 프리셋 이름
        config: 필터 설정
        
    Raises:
        ValueError: 잘못된 설정인 경우
    """
    validated_config = validate_filter_config(config)
    FILTER_PRESETS[name] = validated_config
    logger.info(f"커스텀 필터 프리셋 생성: {name}")

def remove_custom_filter(name: str) -> bool:
    """
    커스텀 필터 프리셋을 제거합니다.
    
    Args:
        name: 제거할 프리셋 이름
        
    Returns:
        제거 성공 여부
    """
    if name in FILTER_PRESETS:
        del FILTER_PRESETS[name]
        logger.info(f"커스텀 필터 프리셋 제거: {name}")
        return True
    else:
        logger.warning(f"존재하지 않는 프리셋: {name}")
        return False

def get_available_presets() -> List[str]:
    """
    사용 가능한 모든 필터 프리셋 이름을 반환합니다.
    
    Returns:
        프리셋 이름 리스트
    """
    return list(FILTER_PRESETS.keys())

def analyze_filter_impact(items: List[Dict[str, Any]], 
                         config: Dict[str, Any]) -> Dict[str, Any]:
    """
    특정 필터 설정이 결과에 미치는 영향을 분석합니다.
    
    Args:
        items: 분석할 아이템 리스트
        config: 분석할 필터 설정
        
    Returns:
        필터 영향 분석 결과
    """
    if not items:
        return {'error': '분석할 데이터가 없습니다.'}
    
    original_count = len(items)
    filtered_items = filter_youtube_results(items, config)
    filtered_count = len(filtered_items)
    
    # 제거된 아이템들 분석
    removed_items = [item for item in items if item not in filtered_items]
    
    # 제거 이유 분석
    removal_reasons = {
        'short_title': 0,
        'short_description': 0,
        'excluded_keywords': 0,
        'low_views': 0,
        'low_likes': 0,
        'low_subscribers': 0, # 추가
        'old_channel': 0, # 추가
        'non_korean': 0,
        'duration_issues': 0
    }
    
    for item in removed_items:
        snippet = item.get('snippet', {})
        channel_snippet = item.get('channelSnippet', {})
        channel_statistics = item.get('channelStatistics', {})
        title = snippet.get('title', '')
        description = snippet.get('description', '')
        
        # 제거 이유 카운트
        if len(title) < config.get('min_title_length', 5):
            removal_reasons['short_title'] += 1
        
        if len(description) < config.get('min_description_length', 10):
            removal_reasons['short_description'] += 1
        
        # 제외 키워드 체크
        for keyword in config.get('exclude_keywords', []):
            if keyword.lower() in title.lower() or keyword.lower() in description.lower():
                removal_reasons['excluded_keywords'] += 1
                break
        
        # 통계 기반 제거 이유
        statistics = item.get('statistics', {})
        if int(statistics.get('viewCount', 0)) < config.get('min_view_count', 0):
            removal_reasons['low_views'] += 1
        
        if int(statistics.get('likeCount', 0)) < config.get('min_like_count', 0):
            removal_reasons['low_likes'] += 1

        # 채널 통계 기반 제거 이유 (구독자 수)
        if int(channel_statistics.get('subscriberCount', 0)) < config.get('min_subscriber_count', 0):
            removal_reasons['low_subscribers'] += 1

        # 채널 개설 연도 기반 제거 이유
        channel_year_filter = config.get('channel_year', 0)
        if channel_year_filter > 0:
            published_at = channel_snippet.get('publishedAt')
            if published_at:
                channel_creation_year = int(published_at.split('-')[0])
                if channel_creation_year < channel_year_filter:
                    removal_reasons['old_channel'] += 1
        
        # 한국어 체크
        if config.get('korean_only', False) and not _is_korean_content(title, description):
            removal_reasons['non_korean'] += 1
    
    return {
        'original_count': original_count,
        'filtered_count': filtered_count,
        'removal_count': len(removed_items),
        'retention_rate': round((filtered_count / original_count) * 100, 2),
        'removal_reasons': removal_reasons,
        'top_removal_reason': max(removal_reasons.items(), key=lambda x: x[1])[0] if removal_reasons else None
    }

# 편의 함수들
def quick_filter_popular(items: List[Dict[str, Any]], min_views: int = 10000) -> List[Dict[str, Any]]:
    """인기 동영상만 빠르게 필터링"""
    return filter_youtube_results(items, {'min_view_count': min_views})

def quick_filter_korean(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """한국어 동영상만 빠르게 필터링"""
    return filter_youtube_results(items, {'korean_only': True})

def quick_filter_long_videos(items: List[Dict[str, Any]], min_minutes: int = 10) -> List[Dict[str, Any]]:
    """긴 동영상만 빠르게 필터링"""
    return filter_youtube_results(items, {'min_duration_seconds': min_minutes * 60})

def quick_exclude_shorts(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """숏츠 동영상 빠르게 제외"""
    return filter_youtube_results(items, {
        'exclude_keywords': ['쇼츠', 'shorts', '#shorts'],
        'min_duration_seconds': 60  # 1분 이상
    })

# 모듈 정보
__version__ = "1.0.0"
__author__ = "YouTube Search Tool"

# 모듈 로드 시 로깅
logger.info(f"YouTube 필터링 모듈 로드됨 (v{__version__})")
logger.debug(f"사용 가능한 프리셋: {', '.join(get_available_presets())}")

# 테스트 함수 (개발용)
def _test_filter():
    """필터링 함수 테스트 (개발/디버깅용)"""
    test_items = [
        {
            'snippet': {
                'title': '테스트 비디오 1',
                'description': '이것은 테스트 설명입니다. 충분히 긴 설명입니다.',
                'channelId': 'UC123',
                'channelTitle': '테스트 채널',
                'publishedAt': '2024-01-01T00:00:00Z' # 테스트용으로 추가
            },
            'statistics': {'viewCount': '5000', 'likeCount': '100'},
            'contentDetails': {'duration': 'PT5M30S'},
            'channelSnippet': {'publishedAt': '2018-01-01T00:00:00Z'}, # 테스트용으로 추가
            'channelStatistics': {'subscriberCount': '100000'} # 테스트용으로 추가
        }
    ]
    
    result = filter_youtube_results(test_items)
    print(f"테스트 결과: {len(result)}개 아이템 통과")
    return result

if __name__ == "__main__":
    # 모듈을 직접 실행할 때 테스트
    _test_filter()
