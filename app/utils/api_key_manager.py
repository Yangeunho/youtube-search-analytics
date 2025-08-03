"""
API 키 관리 시스템 (최종 안정화 버전)
"""
import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from threading import Lock
import pytz

logger = logging.getLogger(__name__)

class ApiKeyManager:
    TIMEZONE = pytz.timezone('Asia/Seoul')
    RESET_TIME_HOUR = 9
    RESET_TIME_MINUTE = 30
    
    def __init__(self, api_keys_file_path: str = None, status_file_path: str = None):
        if api_keys_file_path is None:
            api_keys_file_path = '/var/www/mysite/app/config/api_keys.txt'
        if status_file_path is None:
            status_file_path = '/var/www/mysite/app/config/api_key_status.json'
        
        self.api_keys_file_path = api_keys_file_path
        self.status_file_path = status_file_path
        self.lock = Lock()
        
        os.makedirs(os.path.dirname(self.api_keys_file_path), exist_ok=True)
        if not os.path.exists(self.api_keys_file_path):
            with open(self.api_keys_file_path, 'w', encoding='utf-8') as f:
                f.write('# YouTube API Keys\n')

        self.api_keys = self._load_api_keys()
        self.key_status = self._load_key_status()
        
        logger.info(f"ApiKeyManager initialized: {len(self.api_keys)} keys loaded")
    
    def _load_api_keys(self) -> List[str]:
        try:
            with open(self.api_keys_file_path, 'r', encoding='utf-8-sig') as f:
                return [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]
        except Exception as e:
            logger.error(f"API 키 로드 실패: {e}")
            return []
    
    def _save_api_keys_to_file(self) -> bool:
        try:
            with open(self.api_keys_file_path, 'w', encoding='utf-8') as f:
                f.write("# YouTube API Keys\n")
                if self.api_keys:
                    f.write("\n".join(self.api_keys))
            return True
        except Exception as e:
            logger.error(f"api_keys.txt 파일 저장 실패: {e}")
            return False

    def _load_key_status(self) -> Dict:
        try:
            if os.path.exists(self.status_file_path):
                with open(self.status_file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._check_and_reset_daily_status(data)
                    return data
            return {}
        except Exception as e:
            logger.error(f"API 키 상태 로드 실패: {e}")
            return {}
            
    def _save_key_status(self):
        try:
            with open(self.status_file_path, 'w', encoding='utf-8') as f:
                json.dump(self.key_status, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"API 키 상태 저장 실패: {e}")

    def _get_today_key(self) -> str:
        now = datetime.now(self.TIMEZONE)
        reset_time = now.replace(hour=self.RESET_TIME_HOUR, minute=self.RESET_TIME_MINUTE, second=0, microsecond=0)
        if now < reset_time:
            now -= timedelta(days=1)
        return now.strftime('%Y-%m-%d')
    
    def _check_and_reset_daily_status(self, data: Dict):
        today_key = self._get_today_key()
        if today_key not in data:
            data.clear()
            data[today_key] = {}
            logger.info(f"🔄 새 날짜({today_key}), 모든 키 상태를 초기화합니다.")

    def get_key_statistics(self) -> Dict:
        with self.lock:
            today_key = self._get_today_key()
            today_data = self.key_status.get(today_key, {})
            
            self.api_keys = self._load_api_keys()
            total_keys = len(self.api_keys)
            active_keys_count = 0
            total_usage = 0
            
            for api_key in self.api_keys:
                key_data = today_data.get(api_key, {})
                if isinstance(key_data, dict):
                    if key_data.get('is_active', True):
                        active_keys_count += 1
                    total_usage += key_data.get('usage_count', 0)
                else:
                    active_keys_count += 1

            return {
                'total_keys': total_keys,
                'active_keys': active_keys_count,
                'failed_keys': total_keys - active_keys_count,
                'total_usage': total_usage
            }

    def get_failed_keys_info(self) -> Dict:
        with self.lock:
            today_key = self._get_today_key()
            today_data = self.key_status.get(today_key, {})
            
            self.api_keys = self._load_api_keys()
            failed_keys = []
            active_keys_count = 0

            for api_key in self.api_keys:
                key_data = today_data.get(api_key, {})
                if isinstance(key_data, dict) and not key_data.get('is_active', True):
                    failed_keys.append({
                        'key_preview': api_key[:10] + '...',
                        'error': key_data.get('last_error', 'Unknown'),
                        'failed_at': key_data.get('failed_at', 'Unknown'),
                        'usage_count': key_data.get('usage_count', 0)
                    })
                else:
                    active_keys_count += 1
            
            return {
                'total_keys': len(self.api_keys),
                'active_keys': active_keys_count,
                'failed_keys': failed_keys
            }

    def reset_failed_keys(self) -> int:
        with self.lock:
            today_key = self._get_today_key()
            if today_key not in self.key_status: return 0
            
            reset_count = 0
            for key, key_data in self.key_status[today_key].items():
                if isinstance(key_data, dict) and not key_data.get('is_active', True):
                    key_data['is_active'] = True
                    key_data['last_error'] = None
                    key_data['reset_at'] = datetime.now(self.TIMEZONE).isoformat()
                    reset_count += 1
            
            if reset_count > 0: self._save_key_status()
            return reset_count

    def get_next_available_key(self, exclude_key: str = None) -> Optional[str]:
        with self.lock:
            self.api_keys = self._load_api_keys() 
            today_key = self._get_today_key()
            if today_key not in self.key_status: self.key_status[today_key] = {}
            
            for api_key in self.api_keys:
                if exclude_key and api_key == exclude_key: continue
                if self.key_status[today_key].get(api_key, {}).get('is_active', True):
                    return api_key
            return None

    def mark_key_as_failed(self, api_key: str, error_message: str = None):
        with self.lock:
            today_key = self._get_today_key()
            if today_key not in self.key_status: self.key_status[today_key] = {}
            
            status = self.key_status[today_key].get(api_key, {})
            status.update({ 'is_active': False, 'last_error': error_message, 'failed_at': datetime.now(self.TIMEZONE).isoformat() })
            self.key_status[today_key][api_key] = status
            self._save_key_status()

    def add_key(self, new_key: str) -> bool:
        with self.lock:
            self.api_keys = self._load_api_keys()
            clean_new_key = new_key.strip()
            if clean_new_key in self.api_keys: return False
            
            self.api_keys.append(clean_new_key)
            if self._save_api_keys_to_file(): return True
            else: self.api_keys.remove(clean_new_key); return False

    def delete_key(self, key_to_delete: str) -> bool:
        with self.lock:
            self.api_keys = self._load_api_keys()
            clean_key_to_delete = key_to_delete.strip()

            if clean_key_to_delete not in self.api_keys: return False
            
            self.api_keys.remove(clean_key_to_delete)
            
            today_key = self._get_today_key()
            if today_key in self.key_status and clean_key_to_delete in self.key_status[today_key]:
                del self.key_status[today_key][clean_key_to_delete]

            if self._save_api_keys_to_file():
                self._save_key_status()
                return True
            else:
                self.api_keys.append(clean_key_to_delete)
                return False

    def increment_key_usage(self, api_key: str):
        """API 키 사용량 증가"""
        with self.lock:
            today_key = self._get_today_key()
            if today_key not in self.key_status:
                self.key_status[today_key] = {}
            
            if api_key not in self.key_status[today_key]:
                self.key_status[today_key][api_key] = {}
            
            current_usage = self.key_status[today_key][api_key].get('usage_count', 0)
            self.key_status[today_key][api_key]['usage_count'] = current_usage + 1
            self.key_status[today_key][api_key]['last_used'] = datetime.now(self.TIMEZONE).isoformat()
            
            self._save_key_status()
            logger.info(f"API key usage incremented: {api_key[:10]}..., count: {current_usage + 1}")

    def has_active_keys(self) -> bool:
        """사용 가능한 활성 API 키가 있는지 확인"""
        with self.lock:
            self.api_keys = self._load_api_keys()
            if not self.api_keys:
                return False
            
            today_key = self._get_today_key()
            if today_key not in self.key_status:
                self.key_status[today_key] = {}
            
            for api_key in self.api_keys:
                if self.key_status[today_key].get(api_key, {}).get('is_active', True):
                    return True
            
            return False

# 전역 인스턴스 생성
api_key_manager = ApiKeyManager()