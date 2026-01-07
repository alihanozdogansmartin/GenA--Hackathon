import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Phone, Send, Trash2, Activity, Wifi, WifiOff, PlayCircle, StopCircle } from 'lucide-react';

function AgentView() {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [logs, setLogs] = useState([]);
  
  const wsRef = useRef(null);
  const conversationEndRef = useRef(null);

  // WebSocket bağlantısı kur
  const connectWebSocket = () => {
    const clientId = `${Date.now()}`;
    const socket = new WebSocket(`ws://localhost:8000/ws/agent/${clientId}`);
    
    socket.onopen = () => {
      console.log('✅ WebSocket connected as AGENT');
      setConnected(true);
      addLog('Bağlantı kuruldu', 'success');
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Received:', data);
      handleWebSocketMessage(data);
    };
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      addLog('Bağlantı hatası', 'error');
    };
    
    socket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
      setWs(null);
      addLog('Bağlantı kesildi', 'warning');
    };
    
    wsRef.current = socket;
    setWs(socket);
  };

  // WebSocket mesajlarını işle
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connected':
        addLog('WebSocket bağlantısı başarılı', 'success');
        break;
      
      case 'new_message':
        // Yeni mesaj geldiğinde konuşmaya ekle
        const text = data.text;
        const match = text.match(/^(Müşteri|Temsilci):\s*(.+)$/);
        if (match) {
          const [, role, messageText] = match;
          setConversation(prev => {
            // Aynı mesajı tekrar eklememek için kontrol et
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.text === messageText && lastMsg.role === role) {
              return prev;
            }
            return [...prev, { role, text: messageText, timestamp: Date.now() }];
          });
        }
        addLog('Yeni mesaj alındı', 'info');
        break;
      
      case 'text_added':
        addLog('Metin eklendi', 'info');
        break;
      
      case 'analyzing':
        setAnalyzing(true);
        addLog('Analiz yapılıyor...', 'info');
        break;
      
      case 'analysis_result':
        setAnalyzing(false);
        setAnalysis(data.analysis);
        addLog('Analiz tamamlandı', 'success');
        break;
      
      case 'cleared':
        setConversation([]);
        setAnalysis(null);
        addLog('Konuşma temizlendi', 'info');
        break;
      
      case 'live_mode_changed':
        addLog(`Canlı mod ${data.enabled ? 'açıldı' : 'kapatıldı'}`, 'info');
        break;
      
      case 'error':
        setAnalyzing(false);
        addLog(`Hata: ${data.message}`, 'error');
        break;
      
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  // Log ekle
  const addLog = (message, type = 'info') => {
    const newLog = {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [...prev.slice(-9), newLog]);
  };

  // WebSocket'e mesaj gönder
  const sendWebSocketMessage = (data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      console.log('📤 Sent:', data);
      return true;
    } else {
      console.error('❌ WebSocket not connected');
      addLog('WebSocket bağlı değil', 'error');
      return false;
    }
  };

  // Müşteri mesajı ekle (simülasyon için)
  const addCustomerMessage = (text) => {
    const newMessage = { role: 'Müşteri', text, timestamp: Date.now() };
    setConversation(prev => [...prev, newMessage]);
    
    sendWebSocketMessage({
      type: 'add_text',
      text: `Müşteri: ${text}`
    });
  };

  // Temsilci yanıtı ekle
  const addAgentMessage = () => {
    if (!message.trim()) return;
    
    console.log('🟢 Sending message:', message);
    
    // WebSocket'e gönder (broadcast olarak dönecek)
    const sent = sendWebSocketMessage({
      type: 'add_text',
      text: `Temsilci: ${message}`
    });
    
    if (sent) {
      setMessage('');
    }
  };

  // Manuel analiz yap
  const requestAnalysis = () => {
    sendWebSocketMessage({ type: 'analyze' });
  };

  // Konuşmayı temizle
  const clearConversation = () => {
    sendWebSocketMessage({ type: 'clear' });
  };

  // Live mode toggle
  const toggleLiveMode = () => {
    const newLiveMode = !liveMode;
    setLiveMode(newLiveMode);
    sendWebSocketMessage({
      type: 'live_mode',
      enabled: newLiveMode
    });
  };

  // Bağlantıyı kes
  const disconnect = () => {
    if (ws) {
      ws.close();
    }
  };

  // Cleanup
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto scroll
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const getScoreColor = (score) => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Vodafone Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
              <Phone className="w-10 h-10 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-bold text-white">
                Vodafone
              </h1>
              <p className="text-red-500 font-semibold">Temsilci Paneli</p>
            </div>
            <Activity className={`w-10 h-10 ${connected ? 'text-green-400 animate-pulse' : 'text-gray-600'}`} />
          </div>
          <p className="text-gray-300 text-lg">AI Destekli Müşteri Memnuniyeti & Performans Analizi</p>
        </div>

        {/* Connection Controls */}
        <div className="bg-gray-800 border-2 border-red-600 rounded-2xl shadow-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {connected ? (
                  <Wifi className="w-6 h-6 text-green-400" />
                ) : (
                  <WifiOff className="w-6 h-6 text-red-400" />
                )}
                <span className={`font-bold text-lg ${connected ? 'text-green-400' : 'text-red-400'}`}>
                  {connected ? '✓ Bağlı' : '✗ Bağlı Değil'}
                </span>
              </div>
              
              {!connected && (
                <button
                  onClick={connectWebSocket}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Bağlan
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleLiveMode}
                disabled={!connected}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-colors font-semibold shadow-lg ${
                  liveMode 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {liveMode ? <StopCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                {liveMode ? 'Canlı Analiz Açık' : 'Canlı Analiz Kapalı'}
              </button>
              
              <button
                onClick={clearConversation}
                disabled={!connected || conversation.length === 0}
                className="flex items-center gap-2 px-5 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
              >
                <Trash2 className="w-5 h-5" />
                Temizle
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sol Panel - Konuşma */}
          <div className="space-y-6">
            {/* Konuşma Alanı */}
            <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl shadow-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                Müşteri Konuşması
              </h2>
              
              <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-900 rounded-xl border border-gray-700">
                {conversation.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    Henüz konuşma başlamadı...
                  </p>
                ) : (
                  conversation.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-3 p-4 rounded-xl ${
                        msg.role === 'Müşteri' 
                          ? 'bg-blue-600 ml-8' 
                          : 'bg-red-600 mr-8'
                      }`}
                    >
                      <span className="font-bold text-sm text-white">{msg.role}:</span>
                      <p className="text-white mt-1">{msg.text}</p>
                    </div>
                  ))
                )}
                <div ref={conversationEndRef} />
              </div>

              {/* Temsilci Yanıt Gönderme */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAgentMessage()}
                    placeholder="Müşteriye yanıt yazın..."
                    disabled={!connected}
                    className="flex-1 px-5 py-4 bg-gray-700 border-2 border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 placeholder-gray-400"
                  />
                  <button
                    onClick={addAgentMessage}
                    disabled={!connected || !message.trim()}
                    className="px-8 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold shadow-lg"
                  >
                    <Send className="w-5 h-5" />
                    Gönder
                  </button>
                </div>

                {!liveMode && (
                  <button
                    onClick={requestAnalysis}
                    disabled={!connected || conversation.length === 0 || analyzing}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold text-lg rounded-xl hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {analyzing ? '🤖 AI Analiz Yapılıyor...' : '💡 AI Analiz Başlat'}
                  </button>
                )}
              </div>
            </div>

            {/* Log Alanı */}
            <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl shadow-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Sistem Logları</h2>
              <div className="h-48 overflow-y-auto p-4 bg-gray-900 rounded-xl font-mono text-sm border border-gray-700">
                {logs.map((log, idx) => (
                  <div key={idx} className="mb-2">
                    <span className="text-gray-500">[{log.timestamp}]</span>
                    <span className={`ml-2 ${
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-orange-400' :
                      'text-blue-400'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ Panel - Analiz Sonuçları */}
          <div className="space-y-6">
            {analyzing ? (
              <div className="bg-gray-800 border-2 border-red-600 rounded-2xl shadow-2xl p-10 text-center">
                <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-red-600 mx-auto mb-6"></div>
                <p className="text-white text-xl font-bold">🤖 AI Performansınızı Analiz Ediyor...</p>
                <p className="text-gray-400 mt-2">Lütfen bekleyin</p>
              </div>
            ) : analysis ? (
              <div className="bg-gray-800 border-2 border-red-600 rounded-2xl shadow-2xl p-8">
                <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                  <span className="text-4xl">📊</span>
                  Analiz Sonuçları
                </h2>
                
                {/* Score Cards */}
                <div className="grid grid-cols-2 gap-5 mb-8">
                  <div className="text-center p-8 bg-gradient-to-br from-red-900 to-red-800 rounded-2xl border-2 border-red-600 shadow-lg">
                    <div 
                      className="text-6xl font-bold mb-3 text-white"
                    >
                      {analysis.overallScore}/10
                    </div>
                    <p className="text-red-200 font-bold text-lg">Genel Skor</p>
                  </div>
                  
                  <div className="text-center p-8 bg-gradient-to-br from-green-900 to-green-800 rounded-2xl border-2 border-green-600 shadow-lg">
                    <div className="text-5xl font-bold mb-3 text-white">
                      {analysis.sentiment}/10
                    </div>
                    <p className="text-green-200 font-bold">Müşteri Memnuniyeti</p>
                  </div>
                  
                  <div className="text-center p-8 bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl border-2 border-blue-600 shadow-lg">
                    <div className="text-5xl font-bold mb-3 text-white">
                      {analysis.resolution}/10
                    </div>
                    <p className="text-blue-200 font-bold">Çözüm Başarısı</p>
                  </div>
                  
                  <div className="text-center p-8 bg-gradient-to-br from-purple-900 to-purple-800 rounded-2xl border-2 border-purple-600 shadow-lg">
                    <div className="text-5xl font-bold mb-3 text-white">
                      {analysis.agentPerformance}/10
                    </div>
                    <p className="text-purple-200 font-bold">Performansınız</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold mb-5 text-white flex items-center gap-2">
                    <span>📊</span> Detaylı Metrikler
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-base">
                    <div className="bg-gray-800 p-4 rounded-xl">
                      <span className="text-gray-400">Yanıt Süresi:</span>
                      <span className="ml-2 font-bold text-white">{analysis.metrics.responseTime}</span>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl">
                      <span className="text-gray-400">Empati Seviyesi:</span>
                      <span className="ml-2 font-bold text-white">{analysis.metrics.empathyLevel}</span>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl">
                      <span className="text-gray-400">Problem Çözüldü:</span>
                      <span className="ml-2 font-bold text-white">
                        {analysis.metrics.problemResolved ? '✓ Evet' : '✗ Hayır'}
                      </span>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl">
                      <span className="text-gray-400">Müşteri Duygusu:</span>
                      <span className="ml-2 font-bold text-white">{analysis.metrics.customerEmotion}</span>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                {analysis.insights && analysis.insights.length > 0 && (
                  <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold mb-5 text-white flex items-center gap-2">
                      <span>🤖</span> AI Önerileri & Geri Bildirim
                    </h3>
                    <div className="space-y-3">
                      {analysis.insights.map((insight, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border-2 ${
                          insight.type === 'success' ? 'bg-green-900/50 border-green-600' :
                          insight.type === 'warning' ? 'bg-orange-900/50 border-orange-600' :
                          'bg-blue-900/50 border-blue-600'
                        }`}>
                          <p className="text-white font-medium">{insight.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-5 text-white flex items-center gap-2">
                    <span>📈</span> Performans Dağılımı
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: 'Memnuniyet', skor: analysis.sentiment },
                      { name: 'Çözüm', skor: analysis.resolution },
                      { name: 'Performans', skor: analysis.agentPerformance },
                      { name: 'Genel', skor: analysis.overallScore }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis domain={[0, 10]} stroke="#9CA3AF" />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #E60000', borderRadius: '8px' }} />
                      <Bar dataKey="skor" fill="#E60000" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl shadow-2xl p-10 text-center">
                <Activity className="w-20 h-20 text-gray-600 mx-auto mb-6" />
                <p className="text-white text-xl font-bold mb-3">Henüz analiz yapılmadı</p>
                <p className="text-gray-400 mt-2">
                  {liveMode 
                    ? '🔴 Canlı mod aktif - Her mesajda otomatik AI analiz yapılacak'
                    : 'Konuşma ekleyin ve "AI Analiz Başlat" butonuna basın'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentView;
