import React, { useState, useEffect, useRef } from 'react';
import { Phone, Send, Wifi, WifiOff } from 'lucide-react';

function CustomerView() {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  
  const wsRef = useRef(null);
  const conversationEndRef = useRef(null);

  // WebSocket bağlantısı kur
  const connectWebSocket = () => {
    const clientId = `${Date.now()}`;
    const socket = new WebSocket(`ws://localhost:8000/ws/customer/${clientId}`);
    
    socket.onopen = () => {
      console.log('✅ WebSocket connected as CUSTOMER');
      setConnected(true);
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Received:', data);
      
      // Yeni mesaj geldiğinde konuşmaya ekle
      if (data.type === 'new_message') {
        const text = data.text;
        // "Müşteri: mesaj" veya "Temsilci: mesaj" formatını parse et
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
      }
    };
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    socket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
      setWs(null);
    };
    
    wsRef.current = socket;
    setWs(socket);
  };

  // WebSocket'e mesaj gönder
  const sendWebSocketMessage = (data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      console.log('📤 Sent:', data);
      return true;
    } else {
      console.error('❌ WebSocket not connected');
      return false;
    }
  };

  // Müşteri mesajı gönder
  const sendMessage = () => {
    if (!message.trim()) return;
    
    console.log('🔵 Sending message:', message);
    
    // WebSocket'e gönder (broadcast olarak dönecek)
    const sent = sendWebSocketMessage({
      type: 'add_text',
      text: `Müşteri: ${message}`
    });
    
    if (sent) {
      setMessage('');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-900 p-8">
      <div className="max-w-3xl mx-auto">
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
              <p className="text-red-500 font-semibold">Müşteri Hizmetleri</p>
            </div>
            {connected ? (
              <Wifi className="w-8 h-8 text-green-400 animate-pulse" />
            ) : (
              <WifiOff className="w-8 h-8 text-red-400" />
            )}
          </div>
          <p className="text-gray-300 text-lg">Size nasıl yardımcı olabiliriz?</p>
        </div>

        {/* Connection Status */}
        <div className="bg-gray-800 border-2 border-red-600 rounded-2xl shadow-2xl p-5 mb-6">
          <div className="flex items-center justify-center gap-3">
            <div className={`w-4 h-4 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
            <span className={`font-bold text-lg ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? '✓ Temsilciye Bağlı' : '⏳ Bağlantı Kuruluyor...'}
            </span>
          </div>
        </div>

        {/* Konuşma Alanı */}
        <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 rounded-full"></span>
            Canlı Görüşme
          </h2>
          
          <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-900 rounded-xl border border-gray-700">
            {conversation.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 mb-2 text-lg">Görüşmeye başlamak için mesajınızı yazın</p>
                <p className="text-sm text-gray-500">Vodafone müşteri temsilcileri size yardımcı olmaya hazır</p>
              </div>
            ) : (
              conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-3 p-4 rounded-xl ${msg.role === 'Müşteri' ? 'bg-red-600 ml-8' : 'bg-gray-700 mr-8'}`}
                >
                  <p className="text-white font-medium">{msg.text}</p>
                  <span className="text-xs text-gray-300 mt-2 block">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={conversationEndRef} />
          </div>

          {/* Mesaj Gönderme */}
          <div className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Mesajınızı yazın..."
              disabled={!connected}
              className="flex-1 px-5 py-4 bg-gray-700 border-2 border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 placeholder-gray-400"
            />
            <button
              onClick={sendMessage}
              disabled={!connected || !message.trim()}
              className="px-8 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold shadow-lg"
            >
              <Send className="w-5 h-5" />
              Gönder
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">
              💬 Mesajlarınız Vodafone müşteri temsilcisi tarafından yanıtlanacaktır
            </p>
            <p className="text-red-500 text-xs mt-2 font-semibold">
              Powered by AI • Vodafone Hackathon 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerView;
