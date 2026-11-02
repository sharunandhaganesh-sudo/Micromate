import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Languages,
  Activity,
  Cpu,
  BarChart2,
  Radio,
  Sliders,
} from 'lucide-react';
import { MicroMateAvatar, MicroMateEmotion } from './MicroMateAvatar';
import { apiClient } from '../../api/client';
import { MicroMateStatus } from '../../types';

interface Message {
  id: string;
  sender: 'user' | 'micromate';
  text: string;
  timestamp: string;
  emotion?: MicroMateEmotion;
  quickActions?: Array<{ label: string; action: string }>;
}

export const MicroMateChat: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ta' | 'hi'>('en');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<MicroMateStatus | null>(null);
  const [showProactiveToast, setShowProactiveToast] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'micromate',
      text: "Hello! I'm MicroMate, your weather assistant! ☘️ Ask me about the current temperature, humidity, rainfall, wind, or station health.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      emotion: 'happy',
      quickActions: [
        { label: 'Current Temp', action: "What's the current temperature?" },
        { label: 'Rainfall', action: 'Is it raining?' },
        { label: 'Humidity', action: "What's the humidity?" },
        { label: 'Any Alerts?', action: 'Are there any weather alerts?' },
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll MicroMate status every 30s
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await apiClient.getMicroMateStatus();
        setStatus(data);
      } catch (err) {
        console.warn('MicroMate status fetch failed', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Speech synthesis
  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_☘️⚠️🌡️💧💨]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.2;
      if (language === 'ta') utterance.lang = 'ta-IN';
      else if (language === 'hi') utterance.lang = 'hi-IN';
      else utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error', e);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await apiClient.chatWithMicroMate({
        prompt: query,
        language: language,
      });
      const replyText = response.response || response.reply || 'Observation updated!';
      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'micromate',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: (response.emotion as MicroMateEmotion) || 'happy',
        quickActions: response.suggestions?.map((qa: string) => ({ label: qa, action: qa })) || [],
      };
      setMessages((prev) => [...prev, botMsg]);
      speakText(replyText);
    } catch (err: any) {
      const errMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'micromate',
        text: "I couldn't reach the weather service right now. Please verify if the backend server is running!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'worried',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentEmotion: MicroMateEmotion = (status?.emotion as MicroMateEmotion) || 'happy';

  return (
    <>
      {/* Floating Mascot Launcher in Bottom-Right (Raised on mobile to not obstruct bottom navigation) */}
      <div className="fixed bottom-16 md:bottom-5 right-4 md:right-5 z-40 md:z-50 flex flex-col items-end pointer-events-auto">
        {/* Proactive Speech Bubble Notification */}
        {!isOpen && showProactiveToast && status?.active_message && (
          <div className="mb-2 max-w-xs bg-white border border-primary-200 text-navy-900 p-3.5 rounded-2xl shadow-elevated flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-xl">☘️</span>
            <div className="flex-1 text-xs">
              <p className="font-bold text-primary-700 flex items-center gap-1">
                MicroMate
                <span className="text-[10px] px-1.5 py-0.2 bg-primary-50 text-primary-600 rounded-full border border-primary-200 font-mono">
                  {status.thingspeak_sync_status?.toUpperCase() || 'ONLINE'}
                </span>
              </p>
              <p className="text-navy-700 mt-1 line-clamp-2 leading-relaxed">{status.active_message}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowProactiveToast(false);
              }}
              aria-label="Dismiss message"
              className="text-slate-400 hover:text-navy-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mascot Trigger Button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open MicroMate Weather Assistant"
            className="group relative flex items-center gap-2.5 p-2 bg-white hover:bg-slate-50 border border-primary-200 rounded-full shadow-elevated ring-2 ring-primary-400/30 hover:ring-primary-500 transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            <MicroMateAvatar emotion={currentEmotion} size="sm" isFloating />
            <div className="pr-3 hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                MicroMate
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-primary-600 font-medium">Weather Assistant</span>
            </div>
          </button>
        )}
      </div>

      {/* Expanded Modern Light Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-4 right-4 z-50 bg-white border border-surface-border rounded-2xl shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
            isMinimized
              ? 'w-80 h-16'
              : 'w-[95vw] sm:w-[400px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-primary-50 to-white p-3.5 border-b border-surface-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MicroMateAvatar emotion={currentEmotion} size="sm" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-navy-900 flex items-center gap-1">
                    MicroMate
                    <span className="text-emerald-500 text-xs">☘️</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono border border-emerald-200">
                    {status?.state?.toUpperCase() || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-[11px] text-primary-600 font-medium">Weather Assistant Robot</p>
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center gap-1">
              {/* Language Selector */}
              <div className="relative group">
                <button
                  aria-label="Language options"
                  className="p-1.5 text-navy-500 hover:text-navy-900 rounded-lg hover:bg-slate-100 transition"
                  title="Language Selector"
                >
                  <Languages className="w-4 h-4" />
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white border border-surface-border rounded-xl p-1 shadow-elevated hidden group-hover:flex flex-col gap-1 z-50 w-28">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg text-left ${
                      language === 'en' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-navy-600 hover:bg-slate-50'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLanguage('ta')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg text-left ${
                      language === 'ta' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-navy-600 hover:bg-slate-50'
                    }`}
                  >
                    தமிழ் (Tamil)
                  </button>
                  <button
                    onClick={() => setLanguage('hi')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg text-left ${
                      language === 'hi' ? 'bg-primary-50 text-primary-700 font-bold' : 'text-navy-600 hover:bg-slate-50'
                    }`}
                  >
                    हिन्दी (Hindi)
                  </button>
                </div>
              </div>

              {/* TTS Speech Toggle */}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-1.5 rounded-lg transition ${
                  voiceEnabled
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-navy-500 hover:text-navy-900 hover:bg-slate-100'
                }`}
                title={voiceEnabled ? 'Voice enabled' : 'Voice muted'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Minimize/Restore */}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-navy-500 hover:text-navy-900 rounded-lg hover:bg-slate-100 transition"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-navy-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Message Feed Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`flex gap-2 max-w-[85%] ${
                        msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {msg.sender === 'micromate' && (
                        <div className="shrink-0 mt-0.5">
                          <MicroMateAvatar emotion={msg.emotion || 'happy'} size="sm" />
                        </div>
                      )}
                      <div>
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-primary-600 text-white rounded-tr-none shadow-xs'
                              : 'bg-white text-navy-900 border border-surface-border rounded-tl-none shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-navy-400 mt-1 block px-1">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>

                    {/* Quick action chips from bot */}
                    {msg.quickActions && msg.quickActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
                        {msg.quickActions.map((qa, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(qa.action)}
                            className="text-[11px] bg-white hover:bg-primary-50 text-navy-700 hover:text-primary-700 border border-surface-border hover:border-primary-200 px-3 py-1 rounded-full shadow-xs transition"
                          >
                            {qa.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-primary-600 bg-white border border-surface-border p-2.5 rounded-xl w-fit shadow-xs">
                    <MicroMateAvatar emotion="thinking" size="sm" />
                    <span>MicroMate is checking live telemetry...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Cloud Ingestion Bar */}
              <div className="bg-white px-3.5 py-1.5 border-t border-surface-border flex items-center justify-between text-[11px] text-navy-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-primary-600" />
                  Cloud: <strong>ThingSpeak</strong>
                </span>
                <span className="text-emerald-600 font-semibold">Active Sync</span>
              </div>

              {/* Chat Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-white border-t border-surface-border flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Ask MicroMate (${language.toUpperCase()})...`}
                  disabled={isLoading}
                  className="flex-1 bg-slate-50 border border-surface-border rounded-xl px-3.5 py-2 text-xs text-navy-900 placeholder-navy-400 focus:outline-none focus:border-primary-500 focus:bg-white transition"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-xl transition shadow-xs"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
