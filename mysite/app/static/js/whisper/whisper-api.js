// TipMaster Whisper API 연동 JavaScript
// Flask 백엔드와 Colab 서버 연동을 처리합니다.

class WhisperAPI {
    // onSetConnectButtonState 콜백을 추가하여 UI 버튼 상태를 업데이트할 수 있도록 함
    constructor(onSetConnectButtonState) {
        this.baseUrl = '/youtube/api/whisper';
        this.isConnected = false;
        this.currentTaskId = null;
        this.progressInterval = null;
        this.onSetConnectButtonState = onSetConnectButtonState; // 콜백 함수 저장
        
        // 타임아웃 및 재시도 관리
        this.progressTimeout = null;
        this.lastProgressUpdate = null;
        this.maxProgressStuckTime = 20000; // 20초
        this.currentRetryCount = 0;
        this.maxRetryCount = 2;
        
        // 자동 재연결 설정
        this.autoReconnectEnabled = true;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 2000; // 2초
        this.currentReconnectAttempt = 0;
        this.lastColabUrl = null; // 마지막 성공한 Colab URL 저장
        this.reconnectCallback = null; // 재연결 상태 UI 업데이트용
        
        // 작업 재시작용 데이터 저장
        this.pendingTask = null; // { file, settings, callbacks }
        this.taskResumeCallback = null; // 작업 재시작 콜백
        this.isResuming = false; // 재시작 중 플래그
        this.resumeAttempts = 0; // 재시작 시도 횟수
        this.maxResumeAttempts = 3; // 최대 재시작 시도
        
        this.initializeAPI();
    }

    async initializeAPI() {
        console.log('🚀 Whisper API 초기화');
        
        // 기존 연결 상태 확인
        try {
            await this.checkConnectionStatus();
        } catch (error) {
            console.warn('초기 연결 상태 확인 실패:', error);
        }
    }

    // ==================== 연결 관리 ====================

    async connectToColab(colabUrl) {
        try {
            console.log('🔗 Colab 연결 시도:', colabUrl);
            // UI 업데이트 콜백이 전달되었다면 호출
            if (this.onSetConnectButtonState) {
                this.onSetConnectButtonState(true, '연결 중...'); 
            }
            
            const response = await fetch(`${this.baseUrl}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    colab_url: colabUrl
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // 연결 요청이 성공하면 즉시 연결된 것으로 간주 - 추가 확인 생략
                console.log('✅ Colab 연결 요청 성공 (서버 응답):', data.server_info);
                
                // 연결 성공 시 마지막 URL 저장 및 재연결 카운터 초기화
                this.lastColabUrl = colabUrl;
                this.currentReconnectAttempt = 0;
                
                // 재시작 상태도 초기화 
                this.isResuming = false;
                this.resumeAttempts = 0;
                
                // 연결 상태를 성공으로 설정
                this.updateConnectionStatus(true);
                
                return { success: true, message: data.message, serverInfo: data.server_info };
            } else {
                console.error('❌ Colab 연결 실패 (서버 응답):', data.message);
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('🚨 연결 요청 오류:', error);
            return {
                success: false,
                message: error.message || '네트워크 오류가 발생했습니다.'
            };
        } finally {
            // UI 업데이트 콜백이 전달되었다면 호출
            if (this.onSetConnectButtonState) {
                this.onSetConnectButtonState(false, '연결'); 
            }
        }
    }

    async disconnectFromColab() {
        try {
            const response = await fetch(`${this.baseUrl}/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            this.isConnected = false;
            
            return data;
        } catch (error) {
            console.error('연결 해제 오류:', error);
            this.isConnected = false;
            return { success: false, message: '연결 해제 중 오류가 발생했습니다.' };
        }
    }

    async checkConnectionStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/status`);
            const data = await response.json();
            
            this.isConnected = data.connected;
            return data;
        } catch (error) {
            console.error('연결 상태 확인 오류:', error);
            this.isConnected = false;
            return { connected: false, message: '상태 확인 실패' };
        }
    }

    // ==================== 파일 처리 ====================

    async uploadAndProcess(file, settings) {
        try {
            // 업로드 전 서버 연결 상태 재확인
            const statusCheck = await this.checkConnectionStatus();
            if (!statusCheck.connected) {
                this.updateConnectionStatus(false); // UI 상태도 동기화
                
                // 연결 실패 시 작업을 대기열에 저장 - 콜백은 비워두고 나중에 설정
                console.log('연결 실패 - 작업을 대기열에 저장');
                this.setPendingTask(file, settings, {
                    onUpdate: null, // 나중에 설정될 예정
                    onComplete: null,
                    onError: null
                });
                
                const reconnectSuccess = await this.attemptAutoReconnect('업로드 전 연결 재확인 실패');
                if (!reconnectSuccess) {
                    this.clearPendingTask(); // 대기 작업 제거
                    throw new Error('Colab 서버에 연결되지 않았습니다. 재연결에 실패했습니다.');
                }
                // 재연결 성공 시 resumePendingTask()가 자동 호출됨
            }

            console.log('📤 파일 업로드 시작:', file.name, settings);

            // FormData 생성
            const formData = new FormData();
            formData.append('file', file);
            formData.append('language', settings.language || 'auto');
            formData.append('model', settings.model || 'base');
            formData.append('output_format', settings.outputFormat || 'srt');
            formData.append('timestamp', settings.timestamp || 'segment');

            const response = await fetch(`${this.baseUrl}/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.currentTaskId = data.task_id;
                console.log('✅ 업로드 성공, 작업 ID:', this.currentTaskId);
                return {
                    success: true,
                    taskId: data.task_id,
                    message: data.message,
                    filename: data.filename,
                    settings: data.settings
                };
            } else {
                console.error('❌ 업로드 실패:', data.message);
                
                // 서버에서 Colab 연결 오류를 리턴한 경우 UI 상태 업데이트 및 재연결 시도
                if (data.message && data.message.includes('Colab')) {
                    this.updateConnectionStatus(false);
                    
                    // 비동기 재연결 시도 (리턴 전에 시작)
                    setTimeout(() => {
                        this.attemptAutoReconnect('업로드 오류로 인한 연결 끊김 감지');
                    }, 100);
                }
                
                return {
                    success: false,
                    message: data.message
                };
            }
        } catch (error) {
            console.error('🚨 업로드 오류:', error);
            
            // 연결 오류인 경우 UI 상태 업데이트
            if (error.message && error.message.includes('Colab 서버에 연결되지 않았습니다')) {
                this.updateConnectionStatus(false);
            }
            
            return {
                success: false,
                message: error.message || '파일 업로드 중 오류가 발생했습니다.'
            };
        }
    }

    // ==================== 진행률 모니터링 ====================

    async getTaskStatus(taskId) {
        try {
            const response = await fetch(`${this.baseUrl}/task/${taskId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { error: '작업을 찾을 수 없습니다.' };
                }
                if (response.status === 400) {
                    // 400 에러는 Colab 연결 문제일 가능성이 높음
                    console.log('진행률 모니터링 400 에러 - Colab 연결 문제 추정');
                    return { error: 'connection_issue', needsReconnect: true };
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('작업 상태 확인 오류:', error);
            
            // 네트워크 오류도 연결 문제로 간주
            if (error.message && error.message.includes('HTTP')) {
                return { error: 'connection_issue', needsReconnect: true };
            }
            
            return { error: '작업 상태를 확인할 수 없습니다.' };
        }
    }

    startProgressMonitoring(taskId, onUpdate, onComplete, onError) {
        // 기존 모니터링이 있으면 중단
        if (this.progressInterval) {
            console.log('⚠️ 기존 진행률 모니터링 중단 후 새 모니터링 시작');
            this.stopProgressMonitoring();
        }
        
        // 타임아웃 설정 초기화
        this.lastProgressUpdate = Date.now();
        this.currentRetryCount = 0;
        this.startProgressTimeout(taskId, onUpdate, onComplete, onError);
        
        console.log('📊 진행률 모니터링 시작:', taskId);
        
        this.progressInterval = setInterval(async () => {
            const requestTime = new Date().toISOString();
            
            try {
                console.log(`[${requestTime}] 진행률 상태 요청 시작`);
                const status = await this.getTaskStatus(taskId);
                
                const responseTime = new Date().toISOString();
                console.log(`[${responseTime}] 진행률 상태 응답 도착:`, status?.status || 'unknown');

                if (status.error) {
                    console.error('❌ 상태 확인 실패:', status.error);
                    
                    // 연결 문제인 경우 재연결 시도
                    if (status.needsReconnect) {
                        console.log('진행률 모니터링 중 연결 문제 감지 - 재연결 시도');
                        
                        console.log('진행률 모니터링 오류로 인한 재연결 시도...');
                        
                        // 현재 모니터링 중단
                        this.stopProgressMonitoring();
                        
                        // 재연결 시도를 비동기로 수행
                        setTimeout(async () => {
                            const reconnectSuccess = await this.attemptAutoReconnect('진행률 모니터링 오류');
                            
                            if (reconnectSuccess) {
                                console.log('재연결 성공 - 진행률 모니터링은 resumePendingTask에서 재시작됨');
                            } else {
                                console.log('재연결 실패 - 진행률 모니터링 완전 중단');
                            }
                        }, 100);
                        
                        return; // 즉시 리턴하여 중복 처리 방지
                    }
                    
                    this.stopProgressMonitoring();
                    onError(status.error);
                    return;
                }

                // 진행률 업데이트 콜백 호출 - 즉시 실행
                if (typeof onUpdate === 'function') {
                    try {
                        onUpdate(status);
                        // 진행률 업데이트 시간 기록
                        this.lastProgressUpdate = Date.now();
                    } catch (error) {
                        console.error('진행률 업데이트 콜백 오류:', error);
                    }
                } else {
                    console.error('❌ onUpdate이 함수가 아닙니다:', typeof onUpdate);
                }

                // 완룉 상태 확인
                if (status.status === 'completed') {
                    console.log('✅ 작업 완료:', taskId);
                    
                    // 완료 시 진행바 100%로 설정
                    if (typeof onUpdate === 'function') {
                        const finalStatus = { ...status, progress: 100 };
                        onUpdate(finalStatus);
                    }
                    
                    this.stopProgressMonitoring();
                    onComplete(status);
                    return; // 완료 후 즉시 리턴하여 중복 처리 방지
                } else if (status.status === 'error') {
                    console.error('❌ 작업 실패:', status.message);
                    
                    // 특정 오류에 대해 자동 재시도
                    const errorMessage = status.message || '';
                    const isRetryableError = (
                        errorMessage.includes('NoneType') ||
                        errorMessage.includes('cannot reshape tensor') ||
                        errorMessage.includes('NaN values') ||
                        errorMessage.includes('index out of range') ||
                        errorMessage.includes('CUDA out of memory')
                    );
                    
                    if (isRetryableError && this.currentRetryCount < this.maxRetryCount) {
                        this.currentRetryCount++;
                        console.log(`🔄 AI 처리 오류 감지 - 자동 재시도 ${this.currentRetryCount}/${this.maxRetryCount}`);
                        console.log(`⚠️ 오류 내용: ${errorMessage}`);
                        
                        this.stopProgressMonitoring();
                        
                        // 잠시 대기 후 작업 재시작
                        setTimeout(() => {
                            this.handleProgressTimeout(taskId, onUpdate, onComplete, onError);
                        }, 3000); // 3초 후 재시도
                        
                        return;
                    }
                    
                    this.stopProgressMonitoring();
                    
                    // 사용자 친화적 오류 메시지
                    let userMessage = '작업 처리 중 오류가 발생했습니다.';
                    if (errorMessage.includes('NoneType')) {
                        userMessage = 'AI 모델 처리 중 데이터 오류가 발생했습니다. 다시 시도해주세요.';
                    } else if (errorMessage.includes('cannot reshape tensor')) {
                        userMessage = 'AI 모델이 파일 형식을 인식하지 못했습니다. 다른 파일을 시도해주세요.';
                    } else if (errorMessage.includes('CUDA out of memory')) {
                        userMessage = 'GPU 메모리 부족으로 처리가 중단되었습니다. 잠시 후 다시 시도해주세요.';
                    }
                    
                    onError(userMessage);
                }
            } catch (error) {
                const errorTime = new Date().toISOString();
                console.error(`[${errorTime}] 진행률 모니터링 오류:`, error);
                
                // 오류 발생 시도 즉시 중단하지 말고 다음 주기에 재시도
                console.log('다음 주기에 진행률 확인 재시도...');
                
                // 너무 많은 연속 오류 시에만 중단
                if (!this.progressErrorCount) this.progressErrorCount = 0;
                this.progressErrorCount++;
                
                if (this.progressErrorCount >= 3) {
                    console.error('연속 3회 진행률 확인 실패 - 모니터링 중단');
                    this.stopProgressMonitoring();
                    onError('진행률 확인 중 오류가 발생했습니다.');
                }
            }
        }, 1500); // 1.5초마다 확인 (더 빠른 업데이트)
    }

    // 진행률 타임아웃 모니터링 시작
    startProgressTimeout(taskId, onUpdate, onComplete, onError) {
        this.progressTimeout = setTimeout(() => {
            const currentTime = Date.now();
            const timeSinceLastUpdate = currentTime - this.lastProgressUpdate;
            
            console.log(`⏱️ 진행률 타임아웃 검사: ${timeSinceLastUpdate}ms 경과`);
            
            if (timeSinceLastUpdate >= this.maxProgressStuckTime) {
                console.log(`⚠️ 진행률 멈춤 감지 (${timeSinceLastUpdate/1000}초) - 재시도 ${this.currentRetryCount + 1}/${this.maxRetryCount}`);
                
                if (this.currentRetryCount < this.maxRetryCount) {
                    this.currentRetryCount++;
                    this.handleProgressTimeout(taskId, onUpdate, onComplete, onError);
                } else {
                    console.log('❌ 최대 재시도 횟수 초과 - 작업 중단');
                    this.stopProgressMonitoring();
                    onError('작업이 너무 오래 걸리어 중단되었습니다. 다시 시도해주세요.');
                }
            } else {
                // 아직 시간이 남았으면 다시 타이머 설정
                this.startProgressTimeout(taskId, onUpdate, onComplete, onError);
            }
        }, this.maxProgressStuckTime);
    }

    // 진행률 타임아웃 처리
    async handleProgressTimeout(taskId, onUpdate, onComplete, onError) {
        console.log('🔄 진행률 타임아웃으로 인한 재시도');
        
        // 현재 모니터링 중단
        this.stopProgressMonitoring();
        
        try {
            // 연결 상태 확인
            const status = await this.checkConnectionStatus();
            
            if (status.connected) {
                console.log('✅ 연결 상태 양호 - 작업 상태 재확인');
                
                // 작업 상태 직접 확인
                const taskStatus = await this.getTaskStatus(taskId);
                
                if (taskStatus.status === 'completed') {
                    console.log('✅ 작업이 실제로 완료됨 - 완료 처리');
                    onComplete(taskStatus);
                } else if (taskStatus.status === 'error') {
                    console.log('❌ 작업이 실패로 판명 - 오류 처리');
                    onError(taskStatus.message || '작업 처리 중 오류가 발생했습니다.');
                } else {
                    console.log('🔄 작업이 아직 진행 중 - 모니터링 재시작');
                    // 진행 중이면 모니터링 재시작
                    this.lastProgressUpdate = Date.now(); // 시간 초기화
                    this.startProgressMonitoring(taskId, onUpdate, onComplete, onError);
                }
            } else {
                console.log('❌ 연결 끊김 감지 - 재연결 시도');
                
                // 재연결 시도
                const reconnectSuccess = await this.attemptAutoReconnect('진행률 타임아웃');
                
                if (!reconnectSuccess) {
                    onError('연결이 끊어져 작업을 완료할 수 없습니다.');
                }
            }
        } catch (error) {
            console.error('진행률 타임아웃 처리 오류:', error);
            onError('진행률 확인 중 오류가 발생했습니다.');
        }
    }

    stopProgressMonitoring() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
            this.progressErrorCount = 0; // 에러 카운터 초기화
            
            const stopTime = new Date().toISOString();
            console.log(`[${stopTime}] ⏹️ 진행률 모니터링 중지`);
        }
        
        // 타임아웃 정리
        if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
        }
    }

    // ==================== 다운로드 ====================

    async downloadResult(taskId, format) {
        try {
            console.log('📥 다운로드 시작:', taskId, format);
            
            const response = await fetch(`${this.baseUrl}/download/${taskId}/${format}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '다운로드에 실패했습니다.');
            }

            // 파일 다운로드 처리
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            
            let filename = `subtitle.${format}`;
            if (contentDisposition && contentDisposition.includes('filename=')) {
                const matches = contentDisposition.match(/filename="?([^"]+)"?/);
                if (matches && matches[1]) {
                    filename = matches[1];
                }
            }

            // 브라우저에서 파일 다운로드
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log('✅ 다운로드 완료:', filename);
            return { success: true, filename };
            
        } catch (error) {
            console.error('❌ 다운로드 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // ==================== 정리 ====================

    async cleanupTask(taskId) {
        try {
            const response = await fetch(`${this.baseUrl}/cleanup/${taskId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            console.log('🧹 작업 정리:', taskId, data.success ? '성공' : '실패');
            return data;
        } catch (error) {
            console.error('정리 오류:', error);
            return { success: false, message: '정리 중 오류가 발생했습니다.' };
        }
    }

    // ==================== 유틸리티 ====================

    async ping() {
        try {
            const response = await fetch(`${this.baseUrl}/ping`);
            const data = await response.json();
            return data.status === 'ok';
        } catch (error) {
            console.error('핑 테스트 실패:', error);
            return false;
        }
    }

    async getServiceInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/info`);
            return await response.json();
        } catch (error) {
            console.error('서비스 정보 조회 실패:', error);
            return null;
        }
    }

    // ==================== 자동 재연결 ====================

    async attemptAutoReconnect(reason = '연결 끊김 감지') {
        if (!this.autoReconnectEnabled || !this.lastColabUrl) {
            console.log('자동 재연결 비활성화 또는 저장된 URL 없음');
            return false;
        }

        if (this.currentReconnectAttempt >= this.maxReconnectAttempts) {
            console.log(`재연결 최대 시도 횟수(${this.maxReconnectAttempts})를 초과했습니다.`);
            this.notifyReconnectStatus('failed', `재연결 실패: 최대 ${this.maxReconnectAttempts}회 시도 초과`);
            return false;
        }

        this.currentReconnectAttempt++;
        console.log(`🔄 자동 재연결 시도 ${this.currentReconnectAttempt}/${this.maxReconnectAttempts} - ${reason}`);
        
        this.notifyReconnectStatus('attempting', `재연결 시도 중... (${this.currentReconnectAttempt}/${this.maxReconnectAttempts})`);

        try {
            // 지연 후 재연결 시도
            await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
            
            const result = await this.connectToColab(this.lastColabUrl);
            
            if (result.success) {
                console.log('✅ 자동 재연결 성공!');
                this.notifyReconnectStatus('success', '재연결 성공!');
                
                // 재연결 성공 후 대기 중인 작업이 있으면 자동 재시작
                if (this.pendingTask && !this.isResuming) {
                    console.log('🔄 대기 중인 작업 자동 재시작 예약');
                    this.isResuming = true; // 재시작 플래그 설정
                    setTimeout(() => {
                        console.log('🚀 대기 작업 재시작 실행');
                        this.resumePendingTask();
                    }, 1000); // 1초 대기 후 재시작
                } else if (this.isResuming) {
                    console.log('⚠️ 이미 재시작 중 - 중복 실행 방지');
                } else {
                    console.log('ℹ️ 대기 중인 작업이 없음');
                }
                
                return true;
            } else {
                console.log(`❌ 재연결 시도 ${this.currentReconnectAttempt} 실패:`, result.message);
                
                // 다음 시도 예약
                if (this.currentReconnectAttempt < this.maxReconnectAttempts) {
                    setTimeout(() => this.attemptAutoReconnect('재시도'), this.reconnectDelay);
                }
                
                return false;
            }
        } catch (error) {
            console.error(`재연결 시도 ${this.currentReconnectAttempt} 오류:`, error);
            
            // 다음 시도 예약
            if (this.currentReconnectAttempt < this.maxReconnectAttempts) {
                setTimeout(() => this.attemptAutoReconnect('재시도'), this.reconnectDelay);
            }
            
            return false;
        }
    }

    // 재연결 상태 알림
    notifyReconnectStatus(status, message) {
        if (this.reconnectCallback) {
            this.reconnectCallback(status, message);
        }
    }

    // 재연결 콜백 등록
    onReconnectStatusChange(callback) {
        this.reconnectCallback = callback;
    }

    // 작업 재시작 콜백 등록
    onTaskResume(callback) {
        this.taskResumeCallback = callback;
    }

    // 대기 중인 작업 저장
    setPendingTask(file, settings, callbacks) {
        this.pendingTask = {
            file: file,
            settings: settings,
            onUpdate: callbacks.onUpdate,
            onComplete: callbacks.onComplete,
            onError: callbacks.onError
        };
        console.log('📦 작업 대기열에 저장:', file.name);
    }

    // 대기 중인 작업 재시작
    async resumePendingTask() {
        if (!this.pendingTask) {
            console.log('재시작할 작업이 없습니다.');
            this.isResuming = false;
            return;
        }
        
        // 중복 실행 방지
        if (this.resumeAttempts >= this.maxResumeAttempts) {
            console.error(`❌ 최대 재시작 시도 횟수(${this.maxResumeAttempts}) 초과 - 작업 취소`);
            this.clearPendingTask();
            this.isResuming = false;
            return;
        }
        
        this.resumeAttempts++;
        console.log(`🚀 대기 중인 작업 재시작 시도 ${this.resumeAttempts}/${this.maxResumeAttempts}:`, this.pendingTask.file.name);

        const task = { ...this.pendingTask }; // 복사본 생성
        
        console.log('콜백 함수 상태:', {
            onUpdate: typeof task.onUpdate,
            onComplete: typeof task.onComplete, 
            onError: typeof task.onError
        });
        
        // 콜백 함수가 null인 경우 기본 함수로 대체
        if (!task.onUpdate) {
            console.log('콜백 함수가 null - 기본 함수로 대체');
            task.onUpdate = (status) => console.log('기본 진행률 업데이트:', status);
            task.onComplete = (status) => {
                console.log('기본 작업 완료:', status);
                this.clearPendingTask(); // 완료 시 대기 작업 정리
                this.isResuming = false;
            };
            task.onError = (error) => {
                console.error('기본 오류 처리:', error);
                this.clearPendingTask(); // 오류 시 대기 작업 정리
                this.isResuming = false;
                
                // 전역 UI 상태 업데이트 호출
                if (this.taskResumeCallback) {
                    // UI를 오류 상태로 업데이트하는 콜백 호출
                    console.log('전역 UI 오류 상태 업데이트');
                }
            };
        }
        
        // UI 콜백 호출 (재시작 알림)
        if (this.taskResumeCallback) {
            this.taskResumeCallback(task.file.name);
        }

        try {
            // 작업 재시작
            const result = await this.uploadAndProcess(task.file, task.settings);
            
            if (result.success) {
                console.log('재시작 성공 - 진행률 모니터링 시작');
                
                // 성공 시 대기 작업 정리 및 재시작 완료
                this.clearPendingTask();
                this.isResuming = false;
                this.resumeAttempts = 0;
                
                // 진행률 모니터링 재시작
                this.startProgressMonitoring(
                    result.taskId,
                    task.onUpdate,
                    task.onComplete,
                    task.onError
                );
            } else {
                // 재시작 실패
                console.error('재시작 실패:', result.message);
                this.isResuming = false;
                if (task.onError) task.onError(result.message);
            }
        } catch (error) {
            console.error('작업 재시작 오류:', error);
            this.isResuming = false;
            if (task.onError) task.onError('작업 재시작 중 오류가 발생했습니다.');
        }
    }

    // 대기 작업 취소
    clearPendingTask() {
        if (this.pendingTask) {
            console.log('대기 중인 작업 취소:', this.pendingTask.file.name);
            this.pendingTask = null;
        }
        // 재시작 관련 상태 초기화
        this.isResuming = false;
        this.resumeAttempts = 0;
    }

    // ==================== 이벤트 처리 ====================

    // 연결 상태 변경시 호출할 콜백 등록
    onConnectionChange(callback) {
        this.connectionChangeCallback = callback;
    }

    // 연결 상태 업데이트 - UI 블로킹 방지를 위한 비동기 처리
    updateConnectionStatus(connected) {
        const wasConnected = this.isConnected;
        this.isConnected = connected;
        
        if (wasConnected !== connected && this.connectionChangeCallback) {
            // 즉시 실행하지 않고 다음 이벤트 루프에서 실행하여 UI 블로킹 방지
            setTimeout(() => {
                this.connectionChangeCallback(connected);
            }, 0);
        }
    }
}

// ==================== UI 통합 클래스 ====================

class WhisperGeneratorWithAPI {
    constructor() {
        // WhisperAPI 인스턴스를 생성할 때 setConnectButtonState 함수를 콜백으로 전달
        this.api = new WhisperAPI(this.setConnectButtonState.bind(this));
        this.selectedFile = null;
        this.isProcessing = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.setupConnectionStatusMonitoring();
        this.setupAutoReconnectMonitoring();
        this.setupTaskResumeMonitoring();
    }
    
    // 오류 발생 시 UI 상태 정상화
    resetUIState() {
        this.setProcessingState(false);
        // 진행바 초기화
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = '0%';
        }
        if (this.elements.progressText) {
            this.elements.progressText.textContent = '';
        }
        // 결과 섹션 숨김
        if (this.elements.resultSection) {
            this.elements.resultSection.style.display = 'none';
        }
        if (this.elements.progressSection) {
            this.elements.progressSection.style.display = 'none';
        }
    }

    initializeElements() {
        this.elements = {
            // Colab 연결
            colabStatus: document.getElementById('colabStatus'),
            connectLink: document.getElementById('connectLink'),
            colabModal: document.getElementById('colabModal'),
            modalClose: document.getElementById('modalClose'),
            colabUrlInput: document.getElementById('colabUrlInput'),
            connectBtn: document.getElementById('connectBtn'),
            modalMessage: document.getElementById('modalMessage'),
            
            // 파일 업로드
            uploadSection: document.getElementById('uploadSection'),
            dropZone: document.getElementById('dropZone'),
            audioFile: document.getElementById('audioFile'),
            selectedFile: document.getElementById('selectedFile'),
            fileName: document.getElementById('fileName'),
            fileSize: document.getElementById('fileSize'),
            removeFile: document.getElementById('removeFile'),
            
            // 설정
            settingsSection: document.getElementById('settingsSection'),
            language: document.getElementById('language'),
            model: document.getElementById('model'),
            outputFormat: document.getElementById('outputFormat'),
            timestamp: document.getElementById('timestamp'),
            
            // 처리
            processSection: document.getElementById('processSection'),
            processButton: document.getElementById('processButton'),
            progressSection: document.getElementById('progressSection'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            resultSection: document.getElementById('resultSection'),
            downloadLinks: document.getElementById('downloadLinks'),
            segmentCount: document.getElementById('segmentCount'), 
            processingTime: document.getElementById('processingTime'),
            detectedLanguage: document.getElementById('detectedLanguage'),
            
            // 메시지
            messageBox: document.getElementById('messageBox')
        };
    }

    attachEventListeners() {
        // 모달 관련
        this.elements.connectLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModal();
        });
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.connectBtn?.addEventListener('click', () => this.connectColab());
        
        // 모달 외부 클릭시 닫기
        this.elements.colabModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.colabModal) {
                this.closeModal();
            }
        });

        // Enter 키로 연결
        this.elements.colabUrlInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connectColab();
            }
        });

        // 파일 업로드
        this.elements.dropZone?.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.dropZone?.addEventListener('dragleave', () => this.handleDragLeave());
        this.elements.dropZone?.addEventListener('drop', (e) => this.handleDrop(e));
        this.elements.dropZone?.addEventListener('click', () => this.elements.audioFile?.click());
        this.elements.audioFile?.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.removeFile?.addEventListener('click', () => this.removeFile());

        // 처리 시작
        this.elements.processButton?.addEventListener('click', () => this.startProcessing());
    }

    setupConnectionStatusMonitoring() {
        // API 연결 상태 변경 시 UI 업데이트
        this.api.onConnectionChange((connected) => {
            this.updateColabStatus(connected);
            if (connected) {
                this.enableSection('upload');
                this.enableSection('settings'); // 연결 성공 시 설정 섹션 활성화
                this.enableSection('process');  // 연결 성공 시 처리 섹션 활성화
            } else {
                this.disableSection('upload');
                this.disableSection('settings');
                this.disableSection('process');
            }
        });

        // 페이지 로드시 연결 상태 확인
        this.checkInitialConnectionStatus();
    }

    async checkInitialConnectionStatus() {
        try {
            const status = await this.api.checkConnectionStatus();
            this.updateColabStatus(status.connected);
            if (status.connected) {
                this.enableSection('upload');
                this.enableSection('settings'); // 초기 연결 시 설정 섹션 활성화
                this.enableSection('process');  // 초기 연결 시 처리 섹션 활성화
            }
        } catch (error) {
            console.warn('초기 연결 상태 확인 실패:', error);
        }
    }

    setupAutoReconnectMonitoring() {
        // 이제 setupTaskResumeMonitoring에서 처리됨
        // 이 함수는 비워두고 호환성을 위해 유지
    }

    setupTaskResumeMonitoring() {
        // 작업 재시작 알림 모니터링
        this.api.onTaskResume((fileName) => {
            this.showMessage(`🚀 자동 재시작: ${fileName}`, 'info');
            // 처리 상태로 변경
            this.setProcessingState(true);
        });
        
        // 재연결 상태 모니터링에 오류 상태 추가
        this.api.onReconnectStatusChange((status, message) => {
            console.log(`재연결 상태: ${status} - ${message}`);
            
            switch (status) {
                case 'attempting':
                    this.showMessage(`🔄 ${message}`, 'info');
                    break;
                case 'success':
                    this.showMessage(`✅ ${message}`, 'success');
                    break;
                case 'failed':
                    // 재연결 실패 시 UI 상태 정상화
                    this.showMessage(`❌ ${message}`, 'error');
                    this.setProcessingState(false); // 처리 상태 해제
                    break;
            }
        });
    }

    // ==================== 모달 관리 ===========================

    openModal() {
        if (this.elements.colabModal) {
            this.elements.colabModal.style.display = 'block';
            // 모달이 열릴 때 입력 필드 초기화
            if (this.elements.colabUrlInput) {
                this.elements.colabUrlInput.value = '';
            }
            this.hideModalMessage(); // 모달 메시지 숨기기
            console.log('Modal opened.');
        }
    }

    closeModal() {
        if (this.elements.colabModal) {
            this.elements.colabModal.style.display = 'none';
            console.log('Modal closed.');
        }
        this.hideModalMessage();
    }

    // ==================== Colab 연결 ====================

    async connectColab() {
        const url = this.elements.colabUrlInput?.value.trim();
        
        if (!this.validateColabUrl(url)) {
            this.showModalMessage('올바른 ngrok URL을 입력하세요.', 'error');
            return;
        }
        
        this.setConnectButtonState(true, '연결 중...');
        this.hideModalMessage(); // 연결 시도 전 기존 에러 메시지 숨김
        
        try {
            const result = await this.api.connectToColab(url);
            
            if (result.success) {
                // 연결 성공 시 즉시 UI 업데이트 (중복 호출 방지)
                this.closeModal();
                this.showMessage('Colab 서버에 연결되었습니다.', 'success');
                
                // 서버 정보 표시 (선택사항)
                if (result.serverInfo) {
                    console.log('서버 정보:', result.serverInfo);
                }
            } else {
                // API에서 연결 실패를 보고했으므로, 모달에 에러 메시지 표시
                this.showModalMessage(result.message, 'error');
            }
        } catch (error) {
            // 네트워크 오류 등 예외 발생 시 모달에 에러 메시지 표시
            this.showModalMessage(error.message || '연결 중 오류가 발생했습니다.', 'error');
        } finally {
            // 버튼 상태 복원
            this.setConnectButtonState(false, '연결');
        }
    }

    validateColabUrl(url) {
        if (!url) return false;
        
        const patterns = [
            /^https:\/\/[a-zA-Z0-9\-]+\.ngrok(-free)?\.app$/,
            /^https:\/\/[a-zA-Z0-9\-]+\.ngrok\.io$/,
            /^https:\/\/[a-zA-Z0-9\-]+\.loca\.lt$/,
            /^https:\/\/[a-zA-Z0-9\-]+\.gradio\.live$/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }

    // 이 함수는 WhisperAPI에서 호출할 수 있도록 외부에 노출
    setConnectButtonState(disabled, text) {
        if (this.elements.connectBtn) {
            this.elements.connectBtn.disabled = disabled;
            this.elements.connectBtn.textContent = text;
        }
    }

    updateColabStatus(connected) {
        if (!this.elements.colabStatus) return;
        
        // UI 블로킹 방지를 위한 비동기 업데이트
        requestAnimationFrame(() => {
            if (connected) {
                this.elements.colabStatus.className = 'colab-status connected';
                this.elements.colabStatus.innerHTML = '<span>✅ Colab 서버 연결됨</span>';
            } else {
                this.elements.colabStatus.className = 'colab-status disconnected';
                this.elements.colabStatus.innerHTML = '<span>⚠️ Colab 서버 연결 필요</span><a href="#" class="connect-link" id="connectLink">연결하기</a>';
                
                // 새로 생성된 링크에 이벤트 리스너 재등록
                const newConnectLink = this.elements.colabStatus.querySelector('#connectLink');
                if (newConnectLink) {
                    newConnectLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.openModal();
                    });
                }
            }
        });
    }

    // ==================== 파일 처리 ====================

    handleDragOver(e) {
        e.preventDefault();
        this.elements.dropZone?.classList.add('dragover');
    }

    handleDragLeave() {
        this.elements.dropZone?.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.elements.dropZone?.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        if (e.target.files.length > 0) {
            this.handleFile(e.target.files[0]);
        }
    }

    handleFile(file) {
        if (!this.validateFile(file)) return;

        this.selectedFile = file;
        if (this.elements.fileName) this.elements.fileName.textContent = file.name;
        if (this.elements.fileSize) this.elements.fileSize.textContent = this.formatFileSize(file.size);
        
        if (this.elements.selectedFile) this.elements.selectedFile.style.display = 'block';
        if (this.elements.dropZone) this.elements.dropZone.style.display = 'none';
        
        this.enableSection('settings');
        this.enableSection('process');
    }

    validateFile(file) {
        const allowedExtensions = [
            '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg',
            '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.webm'
        ];

        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) {
            this.showMessage('지원되지 않는 파일 형식입니다.', 'error');
            return false;
        }

        if (file.size > 500 * 1024 * 1024) { // 500MB
            this.showMessage('파일 크기가 500MB를 초과합니다.', 'error');
            return false;
        }
        
        // 너무 작은 파일 검사
        if (file.size < 1000) { // 1KB 미만
            this.showMessage('파일이 너무 작습니다. 올바른 오디오/동영상 파일인지 확인해주세요.', 'error');
            return false;
        }

        return true;
    }

    removeFile() {
        this.selectedFile = null;
        if (this.elements.selectedFile) this.elements.selectedFile.style.display = 'none';
        if (this.elements.dropZone) this.elements.dropZone.style.display = 'block';
        if (this.elements.audioFile) this.elements.audioFile.value = '';
        
        this.disableSection('settings');
        this.disableSection('process');
    }

    // ==================== 처리 시작 ====================

    async startProcessing() {
        // 내부 상태로 연결 상태 확인 (서버 재확인 생략)
        if (!this.api.isConnected) {
            this.showMessage('Colab 서버에 연결되지 않았습니다. 연결 후 다시 시도해주세요.', 'error');
            return;
        }

        if (!this.selectedFile) {
            this.showMessage('음성/동영상 파일을 선택해주세요.', 'error');
            return;
        }

        // 설정 수집
        const settings = {
            language: this.elements.language?.value || 'auto',
            model: this.elements.model?.value || 'base',
            outputFormat: this.elements.outputFormat?.value || 'srt',
            timestamp: this.elements.timestamp?.value || 'segment'
        };

        this.setProcessingState(true);

        try {
            // 파일 업로드 및 처리 시작
            const result = await this.api.uploadAndProcess(this.selectedFile, settings);
            
            if (result.success) {
                console.log('처리 시작:', result.taskId);
                
                    // 콜백 정보를 API에 전달 (재연결 시 사용)
                const callbacks = {
                    onUpdate: (status) => this.onProgressUpdate(status),
                    onComplete: (status) => this.onProcessingComplete(status),
                    onError: (error) => this.onProcessingError(error)
                };
                
                console.log('콜백 함수 설정:', typeof callbacks.onUpdate, typeof callbacks.onComplete, typeof callbacks.onError);
                
                // 대기열에 콜백 업데이트
                if (this.api.pendingTask) {
                    console.log('대기 작업에 콜백 함수 업데이트');
                    this.api.pendingTask.onUpdate = callbacks.onUpdate;
                    this.api.pendingTask.onComplete = callbacks.onComplete;
                    this.api.pendingTask.onError = callbacks.onError;
                }
                
                // 진행률 모니터링 시작
                this.api.startProgressMonitoring(
                    result.taskId,
                    callbacks.onUpdate,
                    callbacks.onComplete,
                    callbacks.onError
                );
            } else {
                // 서버에서 전달된 실패 메시지를 표시
                this.showMessage(result.message, 'error');
                this.setProcessingState(false);
            }
        } catch (error) {
            console.error('처리 시작 오류:', error);
            this.showMessage('처리 시작 중 오류가 발생했습니다.', 'error');
            this.setProcessingState(false);
        }
    }

    onProgressUpdate(status) {
        // 현재 시간 로깅으로 진행률 업데이트 시점 추적
        const currentTime = new Date().toISOString();
        const progress = status.progress || 0;
        console.log(`[${currentTime}] 진행률 업데이트: ${progress}% - ${status.message || '처리 중...'}`);
        
        // 진행바 업데이트 - 더 직접적인 방법 사용
        if (this.elements.progressFill) {
            console.log(`UI 진행바 업데이트: ${progress}%`);
            this.elements.progressFill.style.width = progress + '%';
            // 브라우저에 업데이트 강제 적용
            this.elements.progressFill.offsetHeight; // reflow 강제 실행
        }
        
        if (this.elements.progressText) {
            this.elements.progressText.textContent = status.message || '처리 중...';
        }
        
        // 진행바 업데이트 확인
        if (this.elements.progressFill) {
            const currentWidth = this.elements.progressFill.style.width;
            console.log(`진행바 현재 너비: ${currentWidth}`);
        }
    }

    onProcessingComplete(status) {
        console.log('처리 완료:', status);
        
        this.setProcessingState(false);
        this.showResults(status);
        this.showMessage('자막 생성이 완료되었습니다!', 'success');

        // 결과 통계 업데이트 - 다양한 키명 시도
        if (this.elements.segmentCount) {
            const segmentCount = status.segment_count || status.segments || status.subtitle_count || status.count || 0;
            this.elements.segmentCount.textContent = segmentCount;
        }
        if (this.elements.processingTime) {
            // 다양한 키명과 단위 고려
            let processingTime = status.processing_time || status.duration || status.elapsed_time || status.time_taken;
            if (processingTime !== undefined && processingTime !== null) {
                // 이미 분 단위인지 초 단위인지 판단
                const minutes = processingTime > 1000 ? (processingTime / 60000).toFixed(1) : // 밀리초 단위
                               processingTime > 60 ? (processingTime / 60).toFixed(1) :     // 초 단위
                               processingTime; // 이미 분 단위
                this.elements.processingTime.textContent = minutes;
            } else {
                this.elements.processingTime.textContent = '0';
            }
        }
        if (this.elements.detectedLanguage) {
            const language = status.detected_language || status.language || status.lang || '-';
            this.elements.detectedLanguage.textContent = language;
        }
    }

    onProcessingError(error) {
        console.error('처리 오류:', error);
        
        // UI 상태 완전 정상화
        this.resetUIState();
        
        // Whisper 테니서 오류 감지 및 사용자 친화적 메시지 제공
        let userFriendlyMessage = error;
        
        if (typeof error === 'string' && error.includes('cannot reshape tensor of 0 elements')) {
            userFriendlyMessage = '파일에 음성 내용이 없거나 너무 짧습니다. 다른 파일을 선택해주세요.';
            console.log('🔍 비어있는 오디오 파일 감지 - 사용자 안내 메시지 표시');
        } else if (typeof error === 'string' && error.includes('ambiguous')) {
            userFriendlyMessage = '오디오 파일 형식에 문제가 있습니다. 다른 형식의 파일을 시도해주세요.';
        } else if (typeof error === 'string' && (error.includes('nan') || error.includes('NaN') || error.includes('Invalid values'))) {
            userFriendlyMessage = 'AI 모델 처리 오류가 발생했습니다. 다른 파일을 시도하거나 다른 AI 모델을 선택해주세요.';
            console.log('🤖 Whisper NaN 오류 감지 - 사용자 친화적 메시지 표시');
        } else if (typeof error === 'string' && error.includes('NoneType')) {
            userFriendlyMessage = '서버 내부 오류가 발생했습니다. 다른 파일을 시도하거나 잠시 후 다시 시도해주세요.';
            console.log('🔧 NoneType 오류 감지 - 서버 내부 문제');
        }
        
        this.showMessage(userFriendlyMessage, 'error');
        
        // 대기 중인 작업도 제거 (오류 발생 시 재시도 방지)
        if (this.api) {
            this.api.clearPendingTask();
            // 모니터링도 완전 중단
            this.api.stopProgressMonitoring();
        }
        
        console.log('🚫 오류 발생으로 인한 UI 완전 정리 완료');
        
        // 5초 후 UI 자동 리프레시 (나쁜 상태에서 복구)
        setTimeout(() => {
            console.log('🔄 UI 자동 리프레시');
            this.resetUIState();
        }, 5000);
    }

    setProcessingState(isProcessing) {
        this.isProcessing = isProcessing;
        
        if (this.elements.processButton) {
            this.elements.processButton.disabled = isProcessing;
            this.elements.processButton.textContent = isProcessing ? '처리 중...' : '🚀 자막 추출 시작';
        }
        
        if (this.elements.progressSection) {
            this.elements.progressSection.style.display = isProcessing ? 'block' : 'none';
        }
        
        if (!isProcessing && this.elements.progressFill) {
            this.elements.progressFill.style.width = '0%';
        }
    }

    showResults(status) {
        if (!this.elements.resultSection || !this.elements.downloadLinks) return;
        
        console.log('다운로드 링크 생성 시작:', status);
        
        this.elements.resultSection.style.display = 'block';
        
        // 다운로드 링크 생성 - output_files에서 사용 가능한 포맷 확인
        let availableFormats = [];
        
        if (status.output_files) {
            // 서버에서 제공한 파일 목록 사용
            availableFormats = Object.keys(status.output_files);
            console.log('서버에서 제공한 포맷:', availableFormats);
        } else {
            // 기본 포맷 사용
            const outputFormat = this.elements.outputFormat?.value || 'srt';
            availableFormats = outputFormat === 'all' ? ['srt', 'vtt', 'txt'] : [outputFormat];
            console.log('기본 포맷 사용:', availableFormats);
        }
        
        this.elements.downloadLinks.innerHTML = '';
        
        availableFormats.forEach(format => {
            const link = document.createElement('a');
            link.className = 'download-btn';
            link.href = '#';
            link.textContent = `${format.toUpperCase()} 다운로드`;
            link.onclick = async (e) => {
                e.preventDefault();
                console.log(`다운로드 시도: ${format}, TaskID: ${this.api.currentTaskId}`);
                await this.downloadFile(this.api.currentTaskId, format);
            };
            this.elements.downloadLinks.appendChild(link);
        });
        
        console.log(`다운로드 링크 ${availableFormats.length}개 생성 완료`);
    }

    async downloadFile(taskId, format) {
        try {
            console.log(`다운로드 API 호출 시작: ${taskId}/${format}`);
            
            const result = await this.api.downloadResult(taskId, format);
            
            if (result.success) {
                console.log('다운로드 성공:', result.filename);
                this.showMessage(`${format.toUpperCase()} 파일이 다운로드되었습니다.`, 'info');
            } else {
                console.error('다운로드 실패:', result.message);
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('다운로드 오류:', error);
            this.showMessage('다운로드 중 오류가 발생했습니다.', 'error');
        }
    }

    // ==================== 섹션 활성화/비활성화 ====================

    enableSection(section) {
        const sectionElement = this.elements[`${section}Section`];
        if (sectionElement) {
            sectionElement.classList.remove('disabled');
        }
    }

    disableSection(section) {
        const sectionElement = this.elements[`${section}Section`];
        if (sectionElement) {
            sectionElement.classList.add('disabled');
        }
    }

    // ==================== 메시지 표시 ====================

    showMessage(text, type) {
        if (!this.elements.messageBox) return;
        
        this.elements.messageBox.textContent = text;
        this.elements.messageBox.className = `message ${type}`;
        this.elements.messageBox.style.display = 'block';
        
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (this.elements.messageBox) {
                    this.elements.messageBox.style.display = 'none';
                }
            }, 4000);
        }
    }

    showModalMessage(text, type) {
        if (!this.elements.modalMessage) return;
        
        this.elements.modalMessage.textContent = text;
        this.elements.modalMessage.className = `message ${type}`;
        this.elements.modalMessage.style.display = 'block';
    }

    hideModalMessage() {
        if (this.elements.modalMessage) {
            this.elements.modalMessage.style.display = 'none';
        }
    }

    // ==================== 유틸리티 ====================

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// ==================== 초기화 ====================

// DOM 로드 완료시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎤 TipMaster Whisper 자막 생성기 초기화');
    
    // 전역 인스턴스 생성 (디버깅용)
    window.whisperApp = new WhisperGeneratorWithAPI();
    
    console.log('✅ 초기화 완료');
});
